import ffmpeg from 'fluent-ffmpeg';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import { uploadAudio } from './storageClient.js';
import { synthesizeBatchedTexts } from './batchedTTSClient.js';
import { synthesizeSpeech, createSSMLWithPauses, createSSMLSlow } from './ttsClient.js';
import { prisma } from '../db/client.js';

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
  slow: 0.7,
  medium: 0.85,
  normal: 1.0,
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
    const { speaker } = sentence;

    // Prepare text (with SSML if needed)
    let { text } = sentence;
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
  const finalAudioBuffer = await concatenateAudio(audioFiles.map((f) => f.buffer));

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
  // Validate buffer before processing
  if (!audioBuffer || audioBuffer.length === 0) {
    console.error('[getAudioDuration] Empty audio buffer received');
    throw new Error('Empty audio buffer received');
  }

  // Use ffprobe to get actual audio duration
  // Use crypto.randomUUID() for unique directory name to avoid collisions in parallel execution
  const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  const tempDir = path.join(os.tmpdir(), `audio-probe-${uniqueId}`);
  await fs.mkdir(tempDir, { recursive: true });

  const tempFile = path.join(tempDir, 'temp.mp3');

  try {
    console.log(`[getAudioDuration] Writing ${audioBuffer.length} bytes to ${tempFile}`);
    await fs.writeFile(tempFile, audioBuffer);

    // Verify file was written
    const stats = await fs.stat(tempFile);
    if (stats.size === 0) {
      throw new Error('Temp file was written but is empty');
    }
    console.log(`[getAudioDuration] File written successfully: ${stats.size} bytes`);

    const duration = await new Promise<number>((resolve, reject) => {
      ffmpeg.ffprobe(tempFile, (err, metadata) => {
        if (err) {
          console.error(`[getAudioDuration] ffprobe error:`, err);
          reject(err);
          return;
        }

        const durationSeconds = metadata.format.duration || 0;
        console.log(`[getAudioDuration] Duration: ${durationSeconds}s`);
        resolve(durationSeconds * 1000); // Convert to milliseconds
      });
    });

    // Cleanup temp directory after ffprobe completes
    await fs.rm(tempDir, { recursive: true, force: true });

    return duration;
  } catch (error) {
    console.error(`[getAudioDuration] Error processing audio:`, error);
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
    console.log(
      `Creating concat list with ${tempFiles.length} audio segments and ${tempFiles.length - 1} silence gaps`
    );
    console.log('Concat list content:', listContent);
    await fs.writeFile(listFile, listContent);

    // Concatenate with ffmpeg
    const outputFile = path.join(tempDir, 'output.mp3');

    await new Promise<void>((resolve, reject) => {
      ffmpeg()
        .input(listFile)
        .inputOptions(['-f concat', '-safe 0'])
        .outputOptions(['-c:a libmp3lame', '-b:a 128k', '-ar 44100', '-ac 2'])
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
 * Generate audio for a single speed configuration using batched TTS
 * Groups sentences by voice, synthesizes each voice group in one batch,
 * then reassembles audio in original sentence order.
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
  console.log(`[DIALOGUE] Generating ${config.key} (${config.value}x) audio with batched TTS...`);

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

  const languageCode = episode.targetLanguage === 'ja' ? 'ja-JP' : episode.targetLanguage;

  // Group sentences by voiceId for batching
  const voiceGroups = new Map<string, Array<{ index: number; text: string; sentenceId: string }>>();

  for (let j = 0; j < dialogue.sentences.length; j++) {
    const sentence = dialogue.sentences[j];
    const { voiceId } = sentence.speaker;

    if (!voiceGroups.has(voiceId)) {
      voiceGroups.set(voiceId, []);
    }
    voiceGroups.get(voiceId)!.push({
      index: j,
      text: sentence.text,
      sentenceId: sentence.id,
    });
  }

  console.log(
    `[DIALOGUE] Grouped ${dialogue.sentences.length} sentences into ${voiceGroups.size} voice batches`
  );

  // Generate audio for each voice group using batched TTS
  const audioBuffersByIndex = new Map<number, Buffer>();

  let completedVoices = 0;
  for (const [voiceId, sentences] of voiceGroups) {
    console.log(`[DIALOGUE] Batching ${sentences.length} sentences for voice ${voiceId}`);

    const audioBuffers = await synthesizeBatchedTexts(
      sentences.map((s) => s.text),
      {
        voiceId,
        languageCode,
        speed: config.value,
        pitch: 0,
      }
    );

    // Map buffers back to original sentence indices
    for (let i = 0; i < audioBuffers.length; i++) {
      audioBuffersByIndex.set(sentences[i].index, audioBuffers[i]);
    }

    completedVoices++;
    if (onProgress) {
      // Report progress based on voice batches completed (rough estimate)
      const progress = Math.round((completedVoices / voiceGroups.size) * 80);
      onProgress(progress);
    }
  }

  console.log(
    `[DIALOGUE] Complete: ${voiceGroups.size} TTS calls (was ${dialogue.sentences.length})`
  );

  // Reassemble audio in original sentence order and calculate timings
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
    const audioBuffer = audioBuffersByIndex.get(j)!;

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
  }

  if (onProgress) {
    onProgress(90);
  }

  // Concatenate all audio files
  const finalAudioBuffer = await concatenateAudio(audioFiles.map((f) => f.buffer));

  // Upload to GCS
  const audioUrl = await uploadAudio(finalAudioBuffer, episodeId, config.key);

  // Update episode with this speed's audio URL
  await prisma.episode.update({
    where: { id: episodeId },
    data: {
      [config.audioUrlField]: audioUrl,
    },
  });

  if (onProgress) {
    onProgress(100);
  }

  console.log(`[DIALOGUE] ✅ Generated ${config.key} (${config.value}x) audio: ${audioUrl}`);

  return {
    speed: config.key,
    audioUrl,
    duration: currentTime,
  };
}

/**
 * Generate audio at all three speeds (0.7x, 0.85x, 1.0x) for a dialogue SEQUENTIALLY
 * Changed from parallel to sequential to avoid overwhelming Cloud Run with 90+ concurrent
 * TTS calls and ffprobe processes (30 dialogue turns × 3 speeds).
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
    {
      key: 'slow',
      value: 0.7,
      audioUrlField: 'audioUrl_0_7',
      startTimeField: 'startTime_0_7',
      endTimeField: 'endTime_0_7',
    },
    {
      key: 'medium',
      value: 0.85,
      audioUrlField: 'audioUrl_0_85',
      startTimeField: 'startTime_0_85',
      endTimeField: 'endTime_0_85',
    },
    {
      key: 'normal',
      value: 1.0,
      audioUrlField: 'audioUrl_1_0',
      startTimeField: 'startTime_1_0',
      endTimeField: 'endTime_1_0',
    },
  ];

  const results: Array<{ speed: string; audioUrl: string; duration: number }> = [];

  // Generate speeds SEQUENTIALLY to avoid resource exhaustion
  for (let i = 0; i < speedConfigs.length; i++) {
    const config = speedConfigs[i];
    console.log(
      `[generateAllSpeedsAudio] Starting speed ${i + 1}/3: ${config.key} (${config.value}x)`
    );

    const result = await generateSingleSpeedAudio(
      episodeId,
      dialogueId,
      config,
      (individualProgress) => {
        // Calculate overall progress: each speed is 1/3 of total
        // speedIndex * 33.33 + (individualProgress / 3)
        const overallProgress = Math.round((i * 100 + individualProgress) / 3);

        if (onProgress) {
          onProgress(overallProgress);
        }
      }
    );

    results.push(result);
    console.log(`[generateAllSpeedsAudio] Completed speed ${i + 1}/3: ${config.key}`);
  }

  console.log(`[generateAllSpeedsAudio] All 3 speeds completed successfully`);
  return results;
}
