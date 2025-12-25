import ffmpeg from 'fluent-ffmpeg';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import { processBatches } from './batchedTTSClient.js';
import { LessonScriptUnit } from './lessonScriptGenerator.js';
import { uploadFileToGCS } from './storageClient.js';

// Configure ffmpeg/ffprobe paths
try {
  const ffprobePath = execSync('which ffprobe').toString().trim();
  const ffmpegPath = execSync('which ffmpeg').toString().trim();
  if (ffprobePath) ffmpeg.setFfprobePath(ffprobePath);
  if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath);
} catch (e) {
  console.warn('Could not find ffmpeg/ffprobe in PATH');
}

export interface AssembleAudioOptions {
  lessonId: string;
  scriptUnits: LessonScriptUnit[];
  targetLanguage: string;
  nativeLanguage: string;
  onProgress?: (current: number, total: number) => void;
}

export interface AssembledAudio {
  audioUrl: string;
  actualDurationSeconds: number;
}

/**
 * Assemble a complete lesson audio file from script units
 * Synthesizes TTS for narration and L2 content, generates silence for pauses
 */
export async function assembleLessonAudio(options: AssembleAudioOptions): Promise<AssembledAudio> {
  const { lessonId, scriptUnits, targetLanguage, nativeLanguage, onProgress } = options;

  console.log(`Assembling audio for lesson ${lessonId} with ${scriptUnits.length} units`);

  // Create temp directory for audio segments
  const tempDir = path.join(os.tmpdir(), `audio-assembly-${Date.now()}`);
  await fs.mkdir(tempDir, { recursive: true });

  try {
    // Use batched TTS processing to reduce API calls from ~756 to ~15-20
    const batchResult = await processBatches(scriptUnits, {
      targetLanguage,
      nativeLanguage,
      tempDir,
      onProgress: (batchIndex, totalBatches) => {
        // Map batch progress to overall progress (batches are ~60% of work)
        if (onProgress) {
          const progress = Math.floor((batchIndex / totalBatches) * 0.6 * scriptUnits.length);
          onProgress(progress, scriptUnits.length);
        }
      },
    });

    // Write segments to files in order
    const audioSegmentFiles: string[] = [];

    for (let i = 0; i < scriptUnits.length; i++) {
      const unit = scriptUnits[i];

      // Skip markers - they produce no audio
      if (unit.type === 'marker') {
        console.log(`  Marker: ${unit.label}`);
        continue;
      }

      let buffer: Buffer | undefined;

      // Get segment from batch result
      if (unit.type === 'pause') {
        buffer = batchResult.pauseSegments.get(i);
      } else {
        buffer = batchResult.segments.get(i);
      }

      if (buffer) {
        const segmentPath = path.join(tempDir, `segment-${i}.mp3`);
        await fs.writeFile(segmentPath, buffer);
        audioSegmentFiles.push(segmentPath);
      }
    }

    console.log(`Generated ${audioSegmentFiles.length} audio segments, concatenating...`);

    // Concatenate all audio files
    const finalAudioPath = await concatenateAudioFiles(audioSegmentFiles, tempDir);

    // Get actual duration
    const actualDuration = await getAudioDurationFromFile(finalAudioPath);

    console.log(`Final audio duration: ${actualDuration / 1000}s`);

    // Upload to GCS using streaming (no memory spike)
    const audioUrl = await uploadFileToGCS({
      filePath: finalAudioPath,
      filename: `lesson-${lessonId}.mp3`,
      contentType: 'audio/mpeg',
      folder: 'courses',
    });

    console.log(`Uploaded to: ${audioUrl}`);

    return {
      audioUrl,
      actualDurationSeconds: Math.floor(actualDuration / 1000),
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
  const listContent = audioFiles.map((f) => `file '${f}'`).join('\n');
  await fs.writeFile(listFile, listContent);

  // Concatenate with ffmpeg
  const outputFile = path.join(tempDir, 'final-output.mp3');

  await new Promise<void>((resolve, reject) => {
    ffmpeg()
      .input(listFile)
      .inputOptions(['-f concat', '-safe 0'])
      // Re-encode to ensure consistent format (fixes issues with mixed sources)
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
