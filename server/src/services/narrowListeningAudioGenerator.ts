import { synthesizeSpeech, generateSilence } from './ttsClient.js';
import { uploadFileToGCS } from './storageClient.js';
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

export interface SegmentData {
  text: string;
  translation: string;
  reading?: string;
}

export interface GeneratedSegment {
  text: string;
  translation: string;
  reading: string | null;
  audioUrl: string | null;
  startTime: number; // milliseconds in combined audio
  endTime: number; // milliseconds in combined audio
}

export interface AudioGenerationResult {
  combinedAudioUrl: string;
  segments: GeneratedSegment[];
  totalDurationMs: number;
}

/**
 * Generate audio for a narrow listening story version
 * @param packId - Pack ID for folder organization
 * @param segments - Array of text segments to generate audio for
 * @param voiceId - TTS voice ID to use
 * @param speed - Playback speed (0.7 for slow, 1.0 for normal)
 * @param versionIndex - Version number for unique file naming
 */
export async function generateNarrowListeningAudio(
  packId: string,
  segments: SegmentData[],
  voiceId: string,
  speed: number,
  versionIndex: number
): Promise<AudioGenerationResult> {
  console.log(
    `Generating narrow listening audio: ${segments.length} segments, voice=${voiceId}, speed=${speed}`
  );

  // Create temp directory for audio segments
  const tempDir = path.join(os.tmpdir(), `nl-audio-${Date.now()}`);
  await fs.mkdir(tempDir, { recursive: true });

  try {
    const audioSegmentFiles: string[] = [];
    const segmentTimings: Array<{ startTime: number; endTime: number; duration: number }> = [];

    // OPTIMIZATION: Generate all TTS audio in parallel batches
    const BATCH_SIZE = 10; // Process 10 segments at a time to avoid overwhelming API
    const segmentResults: Array<{ index: number; path: string; duration: number }> = [];

    console.log(`  Generating TTS audio for ${segments.length} segments in parallel batches...`);

    for (let batchStart = 0; batchStart < segments.length; batchStart += BATCH_SIZE) {
      const batch = segments.slice(batchStart, Math.min(batchStart + BATCH_SIZE, segments.length));
      const batchNum = Math.floor(batchStart / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(segments.length / BATCH_SIZE);

      console.log(`  Processing batch ${batchNum}/${totalBatches} (${batch.length} segments)...`);

      // Generate TTS for all segments in this batch in parallel
      const batchPromises = batch.map(async (segment, idx) => {
        const actualIndex = batchStart + idx;

        // Generate TTS for this segment
        const buffer = await synthesizeSpeech({
          text: segment.text,
          voiceId: voiceId,
          languageCode: 'ja-JP',
          speed: speed,
          pitch: 0,
          useSSML: false,
        });

        // Write to temp file
        const segmentPath = path.join(tempDir, `segment-${actualIndex}.mp3`);
        await fs.writeFile(segmentPath, buffer);

        // Get duration
        const duration = await getAudioDurationFromFile(segmentPath);

        return { index: actualIndex, path: segmentPath, duration };
      });

      // Wait for all segments in this batch to complete
      const batchResults = await Promise.all(batchPromises);
      segmentResults.push(...batchResults);
    }

    console.log(`  Generated ${segmentResults.length} segment audio files`);

    // Generate silence files (reuse same 800ms silence for all gaps)
    const silenceBuffer = await generateSilence(0.8);
    const reusableSilencePath = path.join(tempDir, 'silence-reusable.mp3');
    await fs.writeFile(reusableSilencePath, silenceBuffer);
    const silenceDuration = await getAudioDurationFromFile(reusableSilencePath);

    // Build final file list with timings in correct order
    let currentTime = 0;
    for (let i = 0; i < segmentResults.length; i++) {
      const result = segmentResults[i];

      // Add segment audio
      audioSegmentFiles.push(result.path);

      // Record timing
      const startTime = currentTime;
      const endTime = currentTime + result.duration;
      segmentTimings.push({ startTime, endTime, duration: result.duration });
      currentTime = endTime;

      // Add silence between segments (except after last segment)
      if (i < segmentResults.length - 1) {
        audioSegmentFiles.push(reusableSilencePath);
        currentTime += silenceDuration;
      }
    }

    console.log(`  Generated ${audioSegmentFiles.length} audio files (including silence)`);

    // Concatenate all audio files
    const finalAudioPath = await concatenateAudioFiles(audioSegmentFiles, tempDir);

    // Get actual total duration
    const totalDuration = await getAudioDurationFromFile(finalAudioPath);

    console.log(`  Final audio duration: ${(totalDuration / 1000).toFixed(2)}s`);

    // Upload to GCS
    const speedLabel = speed === 0.7 ? '0.7x' : speed === 0.85 ? '0.85x' : '1.0x';
    const audioUrl = await uploadFileToGCS({
      filePath: finalAudioPath,
      filename: `pack-${packId}-v${versionIndex}-${speedLabel}.mp3`,
      contentType: 'audio/mpeg',
      folder: 'narrow-listening',
    });

    console.log(`  Uploaded to: ${audioUrl}`);

    // Build result with segment data
    const generatedSegments: GeneratedSegment[] = segments.map((seg, idx) => ({
      text: seg.text,
      translation: seg.translation,
      reading: seg.reading || null,
      audioUrl: null, // Individual segment audio URLs not stored for now
      startTime: Math.round(segmentTimings[idx].startTime),
      endTime: Math.round(segmentTimings[idx].endTime),
    }));

    return {
      combinedAudioUrl: audioUrl,
      segments: generatedSegments,
      totalDurationMs: Math.round(totalDuration),
    };
  } finally {
    // Cleanup temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (e) {
      console.warn('Failed to cleanup temp directory:', e);
    }
  }
}

/**
 * Get actual audio duration using ffprobe (file-based)
 * @returns Duration in milliseconds
 */
async function getAudioDurationFromFile(filePath: string): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        reject(err);
        return;
      }

      const durationSeconds = metadata.format.duration || 0;
      resolve(durationSeconds * 1000); // Convert to milliseconds
    });
  });
}

/**
 * Concatenate multiple audio files into a single MP3 (file-based, memory-efficient)
 */
async function concatenateAudioFiles(audioFiles: string[], tempDir: string): Promise<string> {
  if (audioFiles.length === 0) {
    throw new Error('No audio files to concatenate');
  }

  if (audioFiles.length === 1) {
    return audioFiles[0];
  }

  // Create concat list file
  const listFile = path.join(tempDir, 'concat-list.txt');
  const listContent = audioFiles.map(f => `file '${f}'`).join('\n');
  await fs.writeFile(listFile, listContent);

  // Concatenate with ffmpeg
  const outputFile = path.join(tempDir, 'final-output.mp3');

  await new Promise<void>((resolve, reject) => {
    ffmpeg()
      .input(listFile)
      .inputOptions(['-f concat', '-safe 0'])
      // Re-encode to ensure consistent format
      .audioCodec('libmp3lame')
      .audioBitrate('128k')
      .audioFrequency(44100)
      .audioChannels(2)
      .output(outputFile)
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
      .run();
  });

  return outputFile;
}
