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
  'slow': 0.7,
  'medium': 0.85,
  'normal': 1.0,
  // Legacy support
  'very-slow': 0.65,
};

interface GenerateAudioRequest {
  episodeId: string;
  dialogueId: string;
  speed?: 'very-slow' | 'slow' | 'medium' | 'normal';
  pauseMode?: boolean;
}

interface SpeedConfig {
  key: 'slow' | 'medium' | 'normal';
  value: number;
  audioUrlField: 'audioUrl_0_7' | 'audioUrl_0_85' | 'audioUrl_1_0';
  startTimeField: 'startTime_0_7' | 'startTime_0_85' | 'startTime_1_0';
  endTimeField: 'endTime_0_7' | 'endTime_0_85' | 'endTime_1_0';
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

/**
 * Generate audio for a single speed configuration
 * @param episodeId - Episode ID
 * @param dialogueId - Dialogue ID
 * @param config - Speed configuration
 * @param onProgress - Callback for progress updates (0-100) specific to this speed
 */
async function generateSingleSpeedAudio(
  episodeId: string,
  dialogueId: string,
  config: SpeedConfig,
  onProgress?: (progress: number) => void
): Promise<{ speed: string; audioUrl: string; duration: number }> {
  console.log(`Generating ${config.key} (${config.value}x) audio...`);

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
  const PAUSE_BETWEEN_TURNS_MS = 1000;

  for (let j = 0; j < dialogue.sentences.length; j++) {
    const sentence = dialogue.sentences[j];
    const speaker = sentence.speaker;

    // Generate audio with specific speed
    const audioBuffer = await synthesizeSpeech({
      text: sentence.text,
      voiceId: speaker.voiceId,
      languageCode: episode.targetLanguage === 'ja' ? 'ja-JP' : episode.targetLanguage,
      speed: config.value,
      useSSML: false,
    });

    const duration = await getAudioDuration(audioBuffer);
    audioFiles.push({ buffer: audioBuffer, duration });

    sentenceTimings.push({
      sentenceId: sentence.id,
      startTime: currentTime,
      endTime: currentTime + duration,
    });

    currentTime += duration;

    // Update sentence with timing for this speed
    await prisma.sentence.update({
      where: { id: sentence.id },
      data: {
        [config.startTimeField]: Math.floor(sentenceTimings[sentenceTimings.length - 1].startTime),
        [config.endTimeField]: Math.floor(sentenceTimings[sentenceTimings.length - 1].endTime),
      },
    });

    if (j < dialogue.sentences.length - 1) {
      currentTime += PAUSE_BETWEEN_TURNS_MS;
    }

    // Report per-sentence progress for this speed
    if (onProgress) {
      const sentenceProgress = Math.round(((j + 1) / dialogue.sentences.length) * 100);
      onProgress(sentenceProgress);
    }
  }

  // Concatenate all audio files
  const finalAudioBuffer = await concatenateAudio(audioFiles.map(f => f.buffer));

  // Upload to GCS
  const audioUrl = await uploadAudio(
    finalAudioBuffer,
    episodeId,
    config.key
  );

  // Update episode with this speed's audio URL
  await prisma.episode.update({
    where: { id: episodeId },
    data: {
      [config.audioUrlField]: audioUrl,
    },
  });

  console.log(`✅ Generated ${config.key} (${config.value}x) audio: ${audioUrl}`);

  return {
    speed: config.key,
    audioUrl,
    duration: currentTime,
  };
}

/**
 * Generate audio at all three speeds (0.7x, 0.85x, 1.0x) for a dialogue IN PARALLEL
 * @param episodeId - Episode ID
 * @param dialogueId - Dialogue ID
 * @param onProgress - Callback for progress updates (0-100)
 */
export async function generateAllSpeedsAudio(
  episodeId: string,
  dialogueId: string,
  onProgress?: (progress: number) => void
) {
  const speedConfigs: SpeedConfig[] = [
    { key: 'slow', value: 0.7, audioUrlField: 'audioUrl_0_7', startTimeField: 'startTime_0_7', endTimeField: 'endTime_0_7' },
    { key: 'medium', value: 0.85, audioUrlField: 'audioUrl_0_85', startTimeField: 'startTime_0_85', endTimeField: 'endTime_0_85' },
    { key: 'normal', value: 1.0, audioUrlField: 'audioUrl_1_0', startTimeField: 'startTime_1_0', endTimeField: 'endTime_1_0' },
  ];

  // Track progress for each speed
  const speedProgress = { slow: 0, medium: 0, normal: 0 };

  // Generate all speeds in parallel
  const results = await Promise.all(
    speedConfigs.map(config =>
      generateSingleSpeedAudio(episodeId, dialogueId, config, (individualProgress) => {
        // Update this speed's progress
        speedProgress[config.key] = individualProgress;

        // Calculate aggregate progress (average of all 3 speeds)
        const aggregateProgress = Math.round(
          (speedProgress.slow + speedProgress.medium + speedProgress.normal) / 3
        );

        if (onProgress) {
          onProgress(aggregateProgress);
        }
      })
    )
  );

  return results;
}
