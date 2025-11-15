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

interface GenerateAudioRequest {
  episodeId: string;
  dialogueId: string;
  speed?: 'normal' | 'slow';
  pauseMode?: boolean;
}

export async function generateEpisodeAudio(request: GenerateAudioRequest) {
  const { episodeId, dialogueId, speed = 'normal', pauseMode = false } = request;

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

  for (const sentence of dialogue.sentences) {
    const speaker = sentence.speaker;

    // Prepare text (with SSML if needed)
    let text = sentence.text;
    const useSSML = pauseMode || speed === 'slow';

    if (pauseMode) {
      text = createSSMLWithPauses(text, '1.5s');
    } else if (speed === 'slow') {
      text = createSSMLSlow(text, 0.75);
    }

    // Generate audio
    const audioBuffer = await synthesizeSpeech({
      text,
      voiceId: speaker.voiceId,
      languageCode: episode.targetLanguage === 'ja' ? 'ja-JP' : episode.targetLanguage,
      speed: speed === 'slow' ? 0.75 : 1.0,
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
  }

  // Concatenate all audio files
  const finalAudioBuffer = await concatenateAudio(audioFiles.map(f => f.buffer));

  // Upload to GCS
  const audioUrl = await uploadAudio(
    finalAudioBuffer,
    episodeId,
    speed === 'slow' ? 'slow' : pauseMode ? 'pause' : 'normal'
  );

  // Update episode with audio URL
  await prisma.episode.update({
    where: { id: episodeId },
    data: { audioUrl },
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

    // Create concat list file
    const listFile = path.join(tempDir, 'list.txt');
    const listContent = tempFiles.map(f => `file '${f}'`).join('\n');
    await fs.writeFile(listFile, listContent);

    // Concatenate with ffmpeg
    const outputFile = path.join(tempDir, 'output.mp3');

    await new Promise<void>((resolve, reject) => {
      ffmpeg()
        .input(listFile)
        .inputOptions(['-f concat', '-safe 0'])
        .outputOptions(['-c copy'])
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
