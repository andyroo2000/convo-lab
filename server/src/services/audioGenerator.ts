import { prisma } from '../db/client.js';
import { synthesizeSpeech, createSSMLWithPauses, createSSMLSlow } from './ttsClient.js';
import { uploadAudio } from './storageClient.js';
import ffmpeg from 'fluent-ffmpeg';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';

// Configure ffmpeg/ffprobe paths
try {
  const ffprobePath = execSync('which ffprobe').toString().trim();
  const ffmpegPath = execSync('which ffmpeg').toString().trim();
  if (ffprobePath) ffmpeg.setFfprobePath(ffprobePath);
  if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath);
} catch (e) {
  console.warn('Could not find ffmpeg/ffprobe in PATH');
}

// Audio speed presets mapping
const SPEED_PRESETS: Record<string, number> = {
  'very-slow': 0.65,
  'slow': 0.85,
  'medium': 1.0,
  'normal': 1.15,
};

interface GenerateAudioRequest {
  episodeId: string;
  dialogueId: string;
  speed?: 'very-slow' | 'slow' | 'medium' | 'normal';
  pauseMode?: boolean;
}

export async function generateEpisodeAudio(request: GenerateAudioRequest) {
  const { episodeId, dialogueId, speed = 'medium', pauseMode = false } = request;

  // Convert speed preset to numeric value
  const numericSpeed = SPEED_PRESETS[speed] || 1.0;

  // Get dialogue with sentences and speakers
  const dialogue = await prisma.dialogue.findUnique({
    where: { id: dialogueId },
    include: {
      sentences: {
        orderBy: { order: 'asc' },
        include: {
          speaker: true,
        },
      },
      speakers: true,
    },
  });

  if (!dialogue) {
    throw new Error('Dialogue not found');
  }

  const episode = await prisma.episode.findUnique({
    where: { id: episodeId },
  });

  if (!episode) {
    throw new Error('Episode not found');
  }

  // Generate audio for each sentence
  const audioFiles: Array<{ buffer: Buffer; duration: number }> = [];
  const sentenceTimings: Array<{
    sentenceId: string;
    startTime: number;
    endTime: number;
  }> = [];

  let currentTime = 0;
  const PAUSE_BETWEEN_TURNS_MS = 1000; // 1 second pause between turns

  for (let i = 0; i < dialogue.sentences.length; i++) {
    const sentence = dialogue.sentences[i];
    const speaker = sentence.speaker;

    // Prepare text (with SSML if needed)
    let text = sentence.text;
    const useSSML = pauseMode;

    if (pauseMode) {
      text = createSSMLWithPauses(text, '1.5s');
    }

    // Generate audio
    const audioBuffer = await synthesizeSpeech({
      text,
      voiceId: speaker.voiceId,
      languageCode: episode.targetLanguage === 'ja' ? 'ja-JP' : episode.targetLanguage,
      speed: numericSpeed,
      useSSML,
    });

    // Get duration (estimate based on buffer size, or use actual audio analysis)
    const duration = await getAudioDuration(audioBuffer);

    audioFiles.push({ buffer: audioBuffer, duration });

    // Store timing information
    sentenceTimings.push({
      sentenceId: sentence.id,
      startTime: currentTime,
      endTime: currentTime + duration,
    });

    currentTime += duration;

    // Update sentence with timing
    await prisma.sentence.update({
      where: { id: sentence.id },
      data: {
        startTime: Math.floor(sentenceTimings[sentenceTimings.length - 1].startTime),
        endTime: Math.floor(sentenceTimings[sentenceTimings.length - 1].endTime),
      },
    });

    // Add pause duration to currentTime (except after the last sentence)
    if (i < dialogue.sentences.length - 1) {
      currentTime += PAUSE_BETWEEN_TURNS_MS;
    }
  }

  // Concatenate all audio files
  const finalAudioBuffer = await concatenateAudio(audioFiles.map(f => f.buffer));

  // Upload to GCS
  const audioUrl = await uploadAudio(
    finalAudioBuffer,
    episodeId,
    speed === 'slow' ? 'slow' : pauseMode ? 'pause' : 'normal'
  );

  // Update episode with audio URL and speed
  await prisma.episode.update({
    where: { id: episodeId },
    data: {
      audioUrl,
      audioSpeed: speed,
    },
  });

  return {
    audioUrl,
    duration: currentTime,
    sentenceTimings,
  };
}

async function getAudioDuration(audioBuffer: Buffer): Promise<number> {
  // Use ffprobe to get actual audio duration
  const tempDir = path.join(os.tmpdir(), `audio-probe-${Date.now()}`);
  await fs.mkdir(tempDir, { recursive: true });

  const tempFile = path.join(tempDir, 'temp.mp3');

  try {
    await fs.writeFile(tempFile, audioBuffer);

    const duration = await new Promise<number>((resolve, reject) => {
      ffmpeg.ffprobe(tempFile, (err, metadata) => {
        if (err) {
          reject(err);
          return;
        }

        const durationSeconds = metadata.format.duration || 0;
        resolve(durationSeconds * 1000); // Convert to milliseconds
      });
    });

    // Cleanup temp directory after ffprobe completes
    await fs.rm(tempDir, { recursive: true, force: true });

    return duration;
  } catch (error) {
    // Cleanup on error
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (e) {
      // Ignore cleanup errors
    }
    throw error;
  }
}

async function concatenateAudio(audioBuffers: Buffer[]): Promise<Buffer> {
  if (audioBuffers.length === 1) {
    return audioBuffers[0];
  }

  // Create temp directory for processing
  const tempDir = path.join(os.tmpdir(), `audio-concat-${Date.now()}`);
  await fs.mkdir(tempDir, { recursive: true });

  try {
    // Write all buffers to temp files
    const tempFiles = await Promise.all(
      audioBuffers.map(async (buffer, index) => {
        const filepath = path.join(tempDir, `segment-${index}.mp3`);
        await fs.writeFile(filepath, buffer);
        return filepath;
      })
    );

    // Generate 1 second of silence
    const silenceFile = path.join(tempDir, 'silence.mp3');
    console.log('Generating 1 second silence file for pauses between dialogue turns...');
    await new Promise<void>((resolve, reject) => {
      ffmpeg()
        .input('/dev/zero')
        .inputOptions(['-f s16le', '-ar 44100', '-ac 2', '-t 1'])
        .outputOptions(['-c:a libmp3lame', '-b:a 128k'])
        .output(silenceFile)
        .on('end', () => {
          console.log('Silence file generated successfully');
          resolve();
        })
        .on('error', (err) => {
          console.error('Error generating silence file:', err);
          reject(err);
        })
        .run();
    });

    // Create concat list file with silence between segments
    const listFile = path.join(tempDir, 'list.txt');
    const listItems: string[] = [];
    tempFiles.forEach((file, index) => {
      listItems.push(`file '${file}'`);
      // Add silence after each segment except the last one
      if (index < tempFiles.length - 1) {
        listItems.push(`file '${silenceFile}'`);
      }
    });
    const listContent = listItems.join('\n');
    console.log(`Creating concat list with ${tempFiles.length} audio segments and ${tempFiles.length - 1} silence gaps`);
    console.log('Concat list content:', listContent);
    await fs.writeFile(listFile, listContent);

    // Concatenate with ffmpeg
    const outputFile = path.join(tempDir, 'output.mp3');

    await new Promise<void>((resolve, reject) => {
      ffmpeg()
        .input(listFile)
        .inputOptions(['-f concat', '-safe 0'])
        .outputOptions([
          '-c:a libmp3lame',
          '-b:a 128k',
          '-ar 44100',
          '-ac 2'
        ])
        .output(outputFile)
        .on('end', () => resolve())
        .on('error', (err) => reject(err))
        .run();
    });

    // Read final file
    const finalBuffer = await fs.readFile(outputFile);

    return finalBuffer;
  } finally {
    // Cleanup temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (e) {
      // Ignore cleanup errors
    }
  }
}
