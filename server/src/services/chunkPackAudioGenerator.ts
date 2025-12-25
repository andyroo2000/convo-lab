import ffmpeg from 'fluent-ffmpeg';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import { TTS_VOICES } from "@languageflow/shared/src/constants-new.js";
import { generateSilence } from './ttsClient.js';
import { ChunkExampleData, ChunkStorySegmentData, ChunkExerciseData } from '../types/chunkPack.js';
import { uploadToGCS } from './storageClient.js';
import { synthesizeBatchedTexts } from './batchedTTSClient.js';

// Configure ffmpeg/ffprobe paths
try {
  const ffprobePath = execSync('which ffprobe').toString().trim();
  const ffmpegPath = execSync('which ffmpeg').toString().trim();
  if (ffprobePath) ffmpeg.setFfprobePath(ffprobePath);
  if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath);
} catch (e) {
  console.warn('Could not find ffmpeg/ffprobe in PATH');
}

// Get Japanese voices from shared constants (Google Cloud TTS)
const JAPANESE_VOICES = TTS_VOICES.ja.voices.map(v => v.id);

// Default Japanese voice for chunk packs
const DEFAULT_VOICE: string = JAPANESE_VOICES[0]; // First voice from available voices

/**
 * Remove furigana readings and decorative brackets from Japanese text for TTS
 * Handles formats like: 会議（かいぎ）or 会議(かいぎ) or 会議[かいぎ]
 * Also removes decorative corner brackets: 『は』-> は
 */
function removeFurigana(text: string): string {
  // Remove parenthesized readings (both full-width and half-width parentheses)
  // and bracket notation readings, and decorative corner brackets
  return text
    .replace(/（[ぁ-ん]+）/g, '')   // Full-width parentheses
    .replace(/\([ぁ-ん]+\)/g, '')   // Half-width parentheses
    .replace(/\[[ぁ-んァ-ヴー]+\]/g, '') // Bracket notation (supports hiragana and katakana)
    .replace(/『/g, '')             // Remove opening corner bracket
    .replace(/』/g, '')             // Remove closing corner bracket
    .replace(/\s+/g, ' ')           // Clean up extra spaces
    .trim();
}

/**
 * Generate audio for chunk pack examples at multiple speeds using batched TTS
 * Groups examples by voice, synthesizes each (voice, speed) combination in one batch.
 */
export async function generateExampleAudio(
  packId: string,
  examples: ChunkExampleData[]
): Promise<Map<string, { audioUrl_0_7: string; audioUrl_0_85: string; audioUrl_1_0: string }>> {
  console.log(`[CHUNK EXAMPLES] Generating audio for ${examples.length} examples at 3 speeds`);

  if (examples.length === 0) {
    return new Map();
  }

  const audioUrls = new Map<string, { audioUrl_0_7: string; audioUrl_0_85: string; audioUrl_1_0: string }>();
  const speeds = [
    { key: 'audioUrl_0_7' as const, speed: 0.7 },
    { key: 'audioUrl_0_85' as const, speed: 0.85 },
    { key: 'audioUrl_1_0' as const, speed: 1.0 },
  ];

  // Group examples by voice (cycling through JAPANESE_VOICES)
  const voiceGroups = new Map<string, Array<{ index: number; sentence: string; cleanText: string }>>();

  for (let i = 0; i < examples.length; i++) {
    const voiceId = JAPANESE_VOICES[i % JAPANESE_VOICES.length];
    const cleanText = removeFurigana(examples[i].sentence);

    if (!voiceGroups.has(voiceId)) {
      voiceGroups.set(voiceId, []);
    }
    voiceGroups.get(voiceId)!.push({ index: i, sentence: examples[i].sentence, cleanText });
  }

  console.log(`[CHUNK EXAMPLES] Grouped into ${voiceGroups.size} voice groups`);

  // Initialize result storage
  const exampleUrlsArray: Array<{ audioUrl_0_7?: string; audioUrl_0_85?: string; audioUrl_1_0?: string }> =
    examples.map(() => ({}));

  // For each speed, process all voice groups
  for (const { key, speed } of speeds) {
    console.log(`[CHUNK EXAMPLES] Processing speed ${speed}x...`);

    for (const [voiceId, group] of voiceGroups) {
      try {
        // Batch all texts for this voice at this speed
        const audioBuffers = await synthesizeBatchedTexts(
          group.map(g => g.cleanText),
          {
            voiceId,
            languageCode: 'ja-JP',
            speed,
            pitch: 0,
          }
        );

        // Upload each buffer and store URL
        for (let i = 0; i < audioBuffers.length; i++) {
          const originalIndex = group[i].index;
          const filename = `example-${originalIndex}-${speed}x.mp3`;
          const url = await uploadToGCS({
            buffer: audioBuffers[i],
            filename,
            contentType: 'audio/mpeg',
            folder: `chunk-packs/${packId}`,
          });

          exampleUrlsArray[originalIndex][key] = url;
        }
      } catch (error) {
        console.error(`[CHUNK EXAMPLES] Failed to generate ${speed}x audio for voice ${voiceId}:`, error);
      }
    }
  }

  // Convert array to map keyed by sentence
  for (let i = 0; i < examples.length; i++) {
    const urls = exampleUrlsArray[i];
    if (urls.audioUrl_0_7 && urls.audioUrl_0_85 && urls.audioUrl_1_0) {
      audioUrls.set(examples[i].sentence, urls as { audioUrl_0_7: string; audioUrl_0_85: string; audioUrl_1_0: string });
    }
  }

  const totalCalls = voiceGroups.size * speeds.length;
  console.log(`[CHUNK EXAMPLES] Complete: ${totalCalls} TTS calls (was ${examples.length * speeds.length})`);

  return audioUrls;
}

/**
 * Generate audio for chunk pack story segments with timings using batched TTS
 * Groups segments by speaker voice, synthesizes each voice group in one batch.
 */
export async function generateStoryAudio(
  packId: string,
  storyIndex: number,
  segments: ChunkStorySegmentData[]
): Promise<{
  combinedAudioUrl: string;
  segmentAudioData: Array<{
    audioUrl: string;
    startTime: number;
    endTime: number;
  }>;
}> {
  console.log(`[CHUNK STORY] Generating audio for story with ${segments.length} segments`);

  // Create temp directory
  const tempDir = path.join(os.tmpdir(), `chunk-story-${Date.now()}`);
  await fs.mkdir(tempDir, { recursive: true });

  try {
    // Detect speakers and assign voices
    const speakerVoices = new Map<string, string>();
    const availableVoices = JAPANESE_VOICES;
    let voiceIndex = 0;

    // Parse all speakers first
    for (const segment of segments) {
      const speakerMatch = segment.japaneseText.match(/^([^：:]+)[：:]/);
      if (speakerMatch) {
        const speaker = speakerMatch[1].trim();
        if (!speakerVoices.has(speaker)) {
          speakerVoices.set(speaker, availableVoices[voiceIndex % availableVoices.length]);
          voiceIndex++;
        }
      }
    }

    console.log(`[CHUNK STORY] Detected speakers:`, Array.from(speakerVoices.entries()));

    // Prepare segments with voice assignments and group by voice
    const voiceGroups = new Map<string, Array<{ index: number; cleanText: string }>>();
    const segmentVoices: string[] = [];

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      let textToSpeak = segment.japaneseText;
      let voiceId = DEFAULT_VOICE;

      const speakerMatch = segment.japaneseText.match(/^([^：:]+)[：:]\s*(.+)$/);
      if (speakerMatch) {
        const speaker = speakerMatch[1].trim();
        textToSpeak = speakerMatch[2].trim();
        voiceId = speakerVoices.get(speaker) || DEFAULT_VOICE;
      }

      const cleanText = removeFurigana(textToSpeak);
      segmentVoices[i] = voiceId;

      if (!voiceGroups.has(voiceId)) {
        voiceGroups.set(voiceId, []);
      }
      voiceGroups.get(voiceId)!.push({ index: i, cleanText });
    }

    console.log(`[CHUNK STORY] Grouped ${segments.length} segments into ${voiceGroups.size} voice batches`);

    // Generate audio for each voice group using batched TTS
    const audioBuffersByIndex = new Map<number, Buffer>();

    for (const [voiceId, group] of voiceGroups) {
      console.log(`[CHUNK STORY] Batching ${group.length} segments for voice ${voiceId}`);

      const audioBuffers = await synthesizeBatchedTexts(
        group.map(g => g.cleanText),
        {
          voiceId,
          languageCode: 'ja-JP',
          speed: 0.85, // Slower for learners
          pitch: 0,
        }
      );

      // Map buffers back to original segment indices
      for (let i = 0; i < audioBuffers.length; i++) {
        audioBuffersByIndex.set(group[i].index, audioBuffers[i]);
      }
    }

    console.log(`[CHUNK STORY] Complete: ${voiceGroups.size} TTS calls (was ${segments.length})`);

    // Reassemble in order, upload individual segments, calculate timings
    const audioSegmentFiles: string[] = [];
    const segmentTimings: Array<{ startTime: number; endTime: number; duration: number; url: string }> = [];
    let currentTime = 0;

    // Generate silence once and reuse
    const silenceBuffer = await generateSilence(0.6);
    const silencePath = path.join(tempDir, `silence-reusable.mp3`);
    await fs.writeFile(silencePath, silenceBuffer);
    const silenceDuration = await getAudioDurationFromFile(silencePath);

    for (let i = 0; i < segments.length; i++) {
      const buffer = audioBuffersByIndex.get(i)!;

      // Write to temp file
      const segmentPath = path.join(tempDir, `segment-${i}.mp3`);
      await fs.writeFile(segmentPath, buffer);
      audioSegmentFiles.push(segmentPath);

      // Upload individual segment
      const segmentFilename = `story-${storyIndex}-segment-${i}.mp3`;
      const segmentUrl = await uploadToGCS({
        buffer,
        filename: segmentFilename,
        contentType: 'audio/mpeg',
        folder: `chunk-packs/${packId}`,
      });

      // Get duration
      const duration = await getAudioDurationFromFile(segmentPath);

      // Record timing
      const startTime = currentTime;
      const endTime = currentTime + duration;
      segmentTimings.push({ startTime, endTime, duration, url: segmentUrl });
      currentTime = endTime;

      // Add silence between segments (600ms - reuse same file)
      if (i < segments.length - 1) {
        audioSegmentFiles.push(silencePath);
        currentTime += silenceDuration;
      }
    }

    // Concatenate all segments
    const combinedPath = path.join(tempDir, 'combined.mp3');
    await concatenateAudioFiles(audioSegmentFiles, combinedPath);

    // Upload combined audio
    const combinedBuffer = await fs.readFile(combinedPath);
    const combinedFilename = `story-${storyIndex}-combined.mp3`;
    const combinedUrl = await uploadToGCS({
      buffer: combinedBuffer,
      filename: combinedFilename,
      contentType: 'audio/mpeg',
      folder: `chunk-packs/${packId}`,
    });

    // Clean up temp files
    await fs.rm(tempDir, { recursive: true, force: true });

    return {
      combinedAudioUrl: combinedUrl,
      segmentAudioData: segmentTimings.map(t => ({
        audioUrl: t.url,
        startTime: t.startTime,
        endTime: t.endTime,
      })),
    };
  } catch (error) {
    // Clean up on error
    await fs.rm(tempDir, { recursive: true, force: true });
    throw error;
  }
}

/**
 * Generate audio for gap-fill exercises
 */
export async function generateExerciseAudio(
  packId: string,
  exercises: ChunkExerciseData[]
): Promise<Map<string, string>> {
  console.log(`Generating audio for ${exercises.length} exercises`);

  const audioUrls = new Map<string, string>();

  // Only generate audio for gap-fill exercises
  const gapFillExercises = exercises.filter(ex => ex.exerciseType === 'gap_fill_mc');

  if (gapFillExercises.length === 0) {
    return audioUrls;
  }

  // Collect all texts to synthesize
  const textsToSynthesize = gapFillExercises.map(exercise => {
    const sentence = exercise.prompt.replace(/___/g, exercise.correctOption);
    return removeFurigana(sentence);
  });

  console.log(`[CHUNK EXERCISES] Batching ${textsToSynthesize.length} exercises into single TTS call`);

  try {
    // Generate all audio in one batched TTS call
    const audioBuffers = await synthesizeBatchedTexts(textsToSynthesize, {
      voiceId: DEFAULT_VOICE,
      languageCode: 'ja-JP',
      speed: 0.85, // Slower for learners
      pitch: 0,
    });

    // Upload each buffer to GCS
    for (let i = 0; i < audioBuffers.length; i++) {
      const exercise = gapFillExercises[i];
      const filename = `exercise-${i}.mp3`;
      const url = await uploadToGCS({
        buffer: audioBuffers[i],
        filename,
        contentType: 'audio/mpeg',
        folder: `chunk-packs/${packId}`,
      });

      // Store URL keyed by prompt for later lookup
      audioUrls.set(exercise.prompt, url);
    }

    console.log(`[CHUNK EXERCISES] Complete: 1 TTS call (was ${gapFillExercises.length})`);
  } catch (error) {
    console.error(`Failed to generate batched audio for exercises:`, error);
    throw error;
  }

  return audioUrls;
}

/**
 * Get audio duration from file using ffprobe
 */
async function getAudioDurationFromFile(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        reject(err);
      } else {
        const durationSeconds = metadata.format.duration || 0;
        resolve(Math.round(durationSeconds * 1000)); // Convert to milliseconds
      }
    });
  });
}

/**
 * Concatenate multiple audio files into one
 */
async function concatenateAudioFiles(inputFiles: string[], outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    let command = ffmpeg();

    // Add all input files
    inputFiles.forEach(file => {
      command = command.input(file);
    });

    // Configure output
    command
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
      .mergeToFile(outputPath, path.dirname(outputPath));
  });
}
