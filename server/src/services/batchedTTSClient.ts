// eslint-disable-next-line import/no-named-as-default-member
import { promises as fs } from 'fs';
import path from 'path';

import ffmpeg from 'fluent-ffmpeg';

import { LessonScriptUnit } from './lessonScriptGenerator.js';
import { generateSilence } from './ttsClient.js';
import {
  getGoogleTTSBetaProvider,
  SynthesizeWithTimepointsResult,
} from './ttsProviders/GoogleTTSBetaProvider.js';
import { getPollyTTSProvider } from './ttsProviders/PollyTTSProvider.js';

/**
 * Detect TTS provider from voice ID format
 * Google voice IDs contain hyphens (e.g., "ja-JP-Neural2-B")
 * Polly voice IDs are single words (e.g., "Mizuki", "Takumi", "Zhiyu", "Lucia", "Sergio")
 */
function getProviderFromVoiceId(voiceId: string): 'google' | 'polly' {
  if (voiceId.includes('-')) {
    return 'google';
  }
  return 'polly';
}

/**
 * A batch of units that share the same voice and speed settings
 */
interface TTSBatch {
  voiceId: string;
  languageCode: string;
  speed: number;
  pitch: number;
  units: Array<{
    originalIndex: number; // Position in original script
    markName: string; // e.g., "unit_42"
    text: string; // Text content to speak
  }>;
}

/**
 * Result of processing all batches - segments ordered by original index
 */
export interface BatchProcessingResult {
  segments: Map<number, Buffer>; // originalIndex -> audio buffer
  pauseSegments: Map<number, Buffer>; // originalIndex -> silence buffer
  timingData: Array<{ unitIndex: number; startTime: number; endTime: number }>; // Timing data for each unit
  totalBatches: number;
  totalTTSCalls: number;
}

/**
 * Options for batch processing
 */
export interface BatchProcessingOptions {
  targetLanguage: string;
  nativeLanguage: string;
  tempDir: string;
  onProgress?: (batchIndex: number, totalBatches: number) => void;
}

/**
 * Group script units into batches by (voiceId, speed, languageCode)
 *
 * This function groups ALL units with the same voice/speed/language together into single batches,
 * regardless of their position in the script. This dramatically reduces API calls.
 *
 * Example: If a script alternates between English narrator and French speaker 100 times,
 * instead of creating 200 batches, we create just 2 batches (1 for all English, 1 for all French).
 *
 * Units are tracked by originalIndex so they can be reassembled in the correct order later.
 */
export function groupUnitsIntoBatches(
  units: LessonScriptUnit[],
  nativeLanguageCode: string,
  targetLanguageCode: string
): { batches: TTSBatch[]; pauseIndices: Map<number, number> } {
  const pauseIndices = new Map<number, number>(); // originalIndex -> seconds

  // Group units by (voiceId, speed, languageCode) using a Map
  const batchGroups = new Map<string, TTSBatch>();

  for (let i = 0; i < units.length; i++) {
    const unit = units[i];

    // Skip markers - they produce no audio
    if (unit.type === 'marker') {
      continue;
    }

    // Handle pauses separately - they don't break batches (pauses are generated locally)
    if (unit.type === 'pause') {
      pauseIndices.set(i, unit.seconds);
      continue;
    }

    // Get batch key properties
    const { voiceId } = unit;
    const speed = unit.type === 'L2' ? unit.speed || 1.0 : 1.0;
    const pitch = unit.pitch || 0;
    const languageCode = unit.type === 'narration_L1' ? nativeLanguageCode : targetLanguageCode;
    // ALWAYS use text field for TTS (reading field with bracket notation is for display only)
    const text = unit.text;

    // Create unique key for this voice/speed/language combination
    const batchKey = `${voiceId}|${speed}|${languageCode}`;

    // Get or create batch for this key
    let batch = batchGroups.get(batchKey);
    if (!batch) {
      batch = {
        voiceId,
        languageCode,
        speed,
        pitch,
        units: [],
      };
      batchGroups.set(batchKey, batch);
    }

    // Add unit to batch (preserving original index for reassembly)
    batch.units.push({
      originalIndex: i,
      markName: `unit_${i}`,
      text,
    });
  }

  // Convert map to array of batches
  const batches = Array.from(batchGroups.values());

  return { batches, pauseIndices };
}

/**
 * Build SSML document with <mark> tags for a batch
 *
 * For Polly: Wraps content in <prosody rate="X%"> to control speed
 * For Google: Speed is handled by speakingRate parameter in API
 */
export function buildBatchSSML(batch: TTSBatch, provider: 'google' | 'polly'): string {
  let ssml = '<speak>';

  // For Polly, wrap entire content in prosody tag for speed control
  if (provider === 'polly') {
    const rate = Math.round(batch.speed * 100); // 0.7 → 70%, 1.0 → 100%
    ssml += `<prosody rate="${rate}%">`;
  }

  for (const unit of batch.units) {
    ssml += `<mark name="${unit.markName}"/>`;
    ssml += escapeSSML(unit.text);
  }

  if (provider === 'polly') {
    ssml += '</prosody>';
  }

  ssml += '</speak>';
  return ssml;
}

/**
 * Escape special characters for SSML
 */
function escapeSSML(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Split audio at timepoints using ffmpeg
 */
async function splitAudioAtTimepoints(
  audioBuffer: Buffer,
  batch: TTSBatch,
  timepoints: SynthesizeWithTimepointsResult['timepoints'],
  tempDir: string
): Promise<Map<number, Buffer>> {
  const segments = new Map<number, Buffer>();

  // Write combined audio to temp file
  const combinedPath = path.join(tempDir, `batch-combined-${Date.now()}.mp3`);
  await fs.writeFile(combinedPath, audioBuffer);

  // Get total duration for calculating last segment
  const totalDuration = await getAudioDuration(combinedPath);

  // Create a map from markName to timepoint
  const timepointMap = new Map<string, number>();
  for (const tp of timepoints) {
    timepointMap.set(tp.markName, tp.timeSeconds);
  }

  // Detect if this is a Polly voice (needs trim adjustment)
  // Polly Speech Marks can have slight timing discrepancies
  const provider = getProviderFromVoiceId(batch.voiceId);
  const POLLY_TRIM_MS = provider === 'polly' ? 0.02 : 0; // 20ms trim for Polly only

  // Split each unit
  for (let i = 0; i < batch.units.length; i++) {
    const unit = batch.units[i];
    const startTime = timepointMap.get(unit.markName);

    if (startTime === undefined) {
      throw new Error(`No timepoint found for mark: ${unit.markName}`);
    }

    // End time is either the next mark's time or end of audio
    // Apply a small trim for Polly voices to prevent overlap between segments
    let endTime: number;
    if (i < batch.units.length - 1) {
      const nextMarkName = batch.units[i + 1].markName;
      const nextMarkTime = timepointMap.get(nextMarkName) || totalDuration;
      endTime = Math.max(startTime + 0.1, nextMarkTime - POLLY_TRIM_MS); // Ensure minimum 100ms duration
    } else {
      endTime = totalDuration;
    }

    // Extract segment
    const segmentPath = path.join(tempDir, `segment-${unit.originalIndex}-${Date.now()}.mp3`);
    await extractAudioSegment(combinedPath, segmentPath, startTime, endTime);

    const segmentBuffer = await fs.readFile(segmentPath);
    segments.set(unit.originalIndex, segmentBuffer);

    // Clean up segment file
    await fs.unlink(segmentPath).catch(() => {});
  }

  // Clean up combined file
  await fs.unlink(combinedPath).catch(() => {});

  return segments;
}

/**
 * Extract a segment from an audio file using ffmpeg
 */
async function extractAudioSegment(
  inputPath: string,
  outputPath: string,
  startSeconds: number,
  endSeconds: number
): Promise<void> {
  const duration = endSeconds - startSeconds;

  if (duration <= 0) {
    throw new Error(
      `Invalid segment duration: ${duration}s (start=${startSeconds}, end=${endSeconds})`
    );
  }

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .setStartTime(startSeconds)
      .setDuration(duration)
      .audioCodec('libmp3lame')
      .audioBitrate('128k')
      .audioFrequency(44100)
      .audioChannels(2)
      .output(outputPath)
      .on('end', () => resolve())
      .on('error', (err) => reject(new Error(`ffmpeg segment extraction failed: ${err.message}`)))
      .run();
  });
}

/**
 * Get audio duration using ffprobe
 */
async function getAudioDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    // eslint-disable-next-line import/no-named-as-default-member
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        reject(err);
        return;
      }
      // Ensure duration is always a number (ffprobe can sometimes return string)
      const duration = metadata.format.duration;
      const numericDuration =
        typeof duration === 'number' ? duration : parseFloat(String(duration)) || 0;
      resolve(numericDuration);
    });
  });
}

/**
 * Get audio duration from a buffer by writing to temp file and using ffprobe
 */
async function getAudioDurationFromBuffer(buffer: Buffer, tempDir: string): Promise<number> {
  const tempPath = path.join(tempDir, `temp-duration-${Date.now()}.mp3`);
  try {
    await fs.writeFile(tempPath, buffer);
    const duration = await getAudioDuration(tempPath);
    return duration;
  } finally {
    await fs.unlink(tempPath).catch(() => {});
  }
}

/**
 * Process all script units using batched TTS
 *
 * This is the main entry point that:
 * 1. Groups units into batches by (voiceId, speed)
 * 2. Synthesizes each batch with SSML marks
 * 3. Splits the batch audio at timepoints
 * 4. Generates silence for pause units
 * 5. Returns all segments ordered by original index
 */
export async function processBatches(
  units: LessonScriptUnit[],
  options: BatchProcessingOptions
): Promise<BatchProcessingResult> {
  const { targetLanguage, nativeLanguage, tempDir, onProgress } = options;

  // Map language codes
  const nativeLanguageCode = getLanguageCode(nativeLanguage);
  const targetLanguageCode = getLanguageCode(targetLanguage);

  // Group units into batches
  const { batches, pauseIndices } = groupUnitsIntoBatches(
    units,
    nativeLanguageCode,
    targetLanguageCode
  );

  // eslint-disable-next-line no-console
  console.log(`[TTS BATCH] Grouped ${units.length} units into ${batches.length} batches`);
  // eslint-disable-next-line no-console
  console.log(`[TTS BATCH] Pause units: ${pauseIndices.size}`);

  const segments = new Map<number, Buffer>();
  const pauseSegments = new Map<number, Buffer>();

  // Process each batch
  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];

    // Detect provider from voice ID
    const providerType = getProviderFromVoiceId(batch.voiceId);
    const provider = providerType === 'polly' ? getPollyTTSProvider() : getGoogleTTSBetaProvider();

    // eslint-disable-next-line no-console
    console.log(
      `[TTS BATCH] Batch ${batchIndex + 1}/${batches.length}: ` +
        `provider=${providerType}, voiceId=${batch.voiceId}, speed=${batch.speed}, units=${batch.units.length}`
    );

    // Build SSML with marks (provider-aware for speed handling)
    const ssml = buildBatchSSML(batch, providerType);

    // Synthesize with timepoints
    const result = await provider.synthesizeSpeechWithTimepoints({
      ssml,
      voiceId: batch.voiceId,
      languageCode: batch.languageCode,
      speed: batch.speed,
      pitch: batch.pitch,
    });

    // eslint-disable-next-line no-console
    console.log(
      `[TTS BATCH] Batch ${batchIndex + 1}/${batches.length}: ` +
        `Got ${result.timepoints.length} timepoints, splitting audio...`
    );

    // Split audio at timepoints
    const batchSegments = await splitAudioAtTimepoints(
      result.audioBuffer,
      batch,
      result.timepoints,
      tempDir
    );

    // Merge into main segments map
    for (const [idx, buffer] of batchSegments) {
      segments.set(idx, buffer);
    }

    // Report progress
    if (onProgress) {
      onProgress(batchIndex + 1, batches.length);
    }
  }

  // Generate silence for pause units
  // eslint-disable-next-line no-console
  console.log(`[TTS BATCH] Generating ${pauseIndices.size} silence segments...`);
  for (const [idx, seconds] of pauseIndices) {
    const silenceBuffer = await generateSilence(seconds);
    pauseSegments.set(idx, silenceBuffer);
  }

  // Build timing data by iterating through units in order
  // eslint-disable-next-line no-console
  console.log(`[TTS BATCH] Building timing data for ${units.length} units...`);
  const timingData: Array<{ unitIndex: number; startTime: number; endTime: number }> = [];
  let cumulativeTime = 0; // in seconds

  for (let i = 0; i < units.length; i++) {
    const unit = units[i];

    // Skip markers - they have no audio
    if (unit.type === 'marker') {
      continue;
    }

    // Get segment buffer (either from segments or pauseSegments)
    const segmentBuffer = segments.get(i) || pauseSegments.get(i);

    if (!segmentBuffer) {
      // eslint-disable-next-line no-console
      console.warn(`[TTS BATCH] No segment found for unit ${i} (type: ${unit.type})`);
      continue;
    }

    // Get duration of this segment
    const durationSeconds = await getAudioDurationFromBuffer(segmentBuffer, tempDir);

    // Record timing data (convert to milliseconds for storage)
    const startTimeMs = Math.round(cumulativeTime * 1000);
    const endTimeMs = Math.round((cumulativeTime + durationSeconds) * 1000);

    timingData.push({
      unitIndex: i,
      startTime: startTimeMs,
      endTime: endTimeMs,
    });

    // Update cumulative time
    cumulativeTime += durationSeconds;
  }

  const totalTTSCalls = batches.length + pauseIndices.size; // batches + silence calls
  // eslint-disable-next-line no-console
  console.log(
    `[TTS BATCH] Complete: ${totalTTSCalls} TTS calls ` +
      `(was ${units.filter((u) => u.type !== 'marker').length}), ` +
      `timing data: ${timingData.length} entries, total duration: ${cumulativeTime.toFixed(2)}s`
  );

  return {
    segments,
    pauseSegments,
    timingData,
    totalBatches: batches.length,
    totalTTSCalls,
  };
}

/**
 * Get language code for TTS
 */
function getLanguageCode(language: string): string {
  const languageMap: Record<string, string> = {
    en: 'en-US',
    ja: 'ja-JP',
    zh: 'zh-CN',
    es: 'es-ES',
    fr: 'fr-FR',
    ar: 'ar-XA',
    he: 'he-IL',
  };

  return languageMap[language] || 'en-US';
}

/**
 * Simple batched TTS for single-voice use cases (PI Activities, exercises, etc.)
 *
 * Takes an array of text strings, synthesizes them all in one TTS call using SSML marks,
 * then splits the audio and returns individual buffers in the same order.
 *
 * @param texts - Array of text strings to synthesize
 * @param options - Voice settings (all texts use same voice/speed/language)
 * @returns Array of audio buffers in same order as input texts
 */
export async function synthesizeBatchedTexts(
  texts: string[],
  options: {
    voiceId: string;
    languageCode: string;
    speed?: number;
    pitch?: number;
  }
): Promise<Buffer[]> {
  if (texts.length === 0) {
    return [];
  }

  const { voiceId, languageCode, speed = 1.0, pitch = 0 } = options;

  // eslint-disable-next-line no-console
  console.log(
    `[TTS BATCH SIMPLE] Synthesizing ${texts.length} texts with voice=${voiceId}, speed=${speed}`
  );

  // Detect provider from voice ID
  const providerType = getProviderFromVoiceId(voiceId);
  const provider = providerType === 'polly' ? getPollyTTSProvider() : getGoogleTTSBetaProvider();

  // Build SSML with marks (provider-aware for speed handling)
  let ssml = '<speak>';

  // For Polly, wrap entire content in prosody tag for speed control
  if (providerType === 'polly') {
    const rate = Math.round(speed * 100); // 0.7 → 70%, 1.0 → 100%
    ssml += `<prosody rate="${rate}%">`;
  }

  for (let i = 0; i < texts.length; i++) {
    ssml += `<mark name="text_${i}"/>`;
    ssml += escapeSSML(texts[i]);
  }

  if (providerType === 'polly') {
    ssml += '</prosody>';
  }

  ssml += '</speak>';

  // Synthesize with timepoints
  const result = await provider.synthesizeSpeechWithTimepoints({
    ssml,
    voiceId,
    languageCode,
    speed,
    pitch,
  });

  // eslint-disable-next-line no-console
  console.log(`[TTS BATCH SIMPLE] Got ${result.timepoints.length} timepoints, splitting audio...`);

  // Create temp directory for splitting
  const tempDir = path.join(process.cwd(), 'tmp', `batch-simple-${Date.now()}`);
  await fs.mkdir(tempDir, { recursive: true });

  try {
    // Write combined audio to temp file
    const combinedPath = path.join(tempDir, 'combined.mp3');
    await fs.writeFile(combinedPath, result.audioBuffer);

    // Get total duration
    const totalDuration = await getAudioDuration(combinedPath);

    // Create timepoint map
    const timepointMap = new Map<string, number>();
    for (const tp of result.timepoints) {
      timepointMap.set(tp.markName, tp.timeSeconds);
    }

    // Split each text segment
    const segments: Buffer[] = [];
    for (let i = 0; i < texts.length; i++) {
      const markName = `text_${i}`;
      const startTime = timepointMap.get(markName);

      if (startTime === undefined) {
        throw new Error(`No timepoint found for mark: ${markName}`);
      }

      // End time is next mark's time or end of audio
      let endTime: number;
      if (i < texts.length - 1) {
        endTime = timepointMap.get(`text_${i + 1}`) || totalDuration;
      } else {
        endTime = totalDuration;
      }

      // Extract segment
      const segmentPath = path.join(tempDir, `segment_${i}.mp3`);
      await extractAudioSegment(combinedPath, segmentPath, startTime, endTime);

      const segmentBuffer = await fs.readFile(segmentPath);
      segments.push(segmentBuffer);

      // Clean up segment file
      await fs.unlink(segmentPath).catch(() => {});
    }

    // eslint-disable-next-line no-console
    console.log(`[TTS BATCH SIMPLE] Complete: 1 TTS call (was ${texts.length})`);
    return segments;
  } finally {
    // Clean up temp directory
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}
