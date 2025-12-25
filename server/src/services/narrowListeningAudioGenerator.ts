import ffmpeg from 'fluent-ffmpeg';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import { uploadFileToGCS } from './storageClient.js';
import { synthesizeBatchedTexts } from './batchedTTSClient.js';
import { generateSilence } from './ttsClient.js';

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

export interface VoiceInfo {
  id: string;
  gender: 'male' | 'female';
  description: string;
}

export interface GeneratedSegment {
  text: string;
  translation: string;
  reading: string | null;
  voiceId: string; // NEW: Voice for this segment
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
 * Convert language code to full language code for TTS
 * @param language - ISO 639-1 code (ja, zh, es)
 * @returns Full language code (ja-JP, zh-CN, es-ES)
 */
function getLanguageCodeForTTS(language: string): string {
  const languageMap: Record<string, string> = {
    ja: 'ja-JP',
    zh: 'zh-CN',
    es: 'es-ES',
    en: 'en-US',
    fr: 'fr-FR',
    ar: 'ar-XA',
    he: 'he-IL',
  };

  return languageMap[language] || 'en-US';
}

/**
 * Assign voices to segments with gender alternation and balanced distribution
 * @param segmentCount - Number of segments to assign voices to
 * @param availableVoices - Available voices with gender info
 * @returns Array of voiceIds (one per segment, in order)
 */
export function assignVoicesToSegments(
  segmentCount: number,
  availableVoices: VoiceInfo[]
): string[] {
  if (availableVoices.length === 0) {
    throw new Error('No voices available');
  }

  if (availableVoices.length === 1) {
    // Fallback: single voice for all segments
    return Array(segmentCount).fill(availableVoices[0].id);
  }

  // 1. Separate voices by gender
  const femaleVoices = availableVoices.filter((v) => v.gender === 'female');
  const maleVoices = availableVoices.filter((v) => v.gender === 'male');

  // Edge case: only one gender available
  if (femaleVoices.length === 0 || maleVoices.length === 0) {
    // Use round-robin on available voices
    const voices = availableVoices;
    return Array(segmentCount)
      .fill(null)
      .map((_, i) => voices[i % voices.length].id);
  }

  // 2. Create rotators for each gender group
  let femaleIndex = 0;
  let maleIndex = 0;

  // 3. Alternate between genders, rotating through voices within each gender
  const assignments: string[] = [];
  let useFemale = Math.random() > 0.5; // Random starting gender

  for (let i = 0; i < segmentCount; i++) {
    // Alternate gender
    const voiceGroup = useFemale ? femaleVoices : maleVoices;
    const index = useFemale ? femaleIndex : maleIndex;

    // Assign voice and rotate
    assignments.push(voiceGroup[index % voiceGroup.length].id);

    if (useFemale) {
      femaleIndex++;
    } else {
      maleIndex++;
    }

    // Switch gender for next iteration
    useFemale = !useFemale;
  }

  // 4. Verify no consecutive duplicates (shouldn't happen with alternation, but be safe)
  for (let i = 1; i < assignments.length; i++) {
    if (assignments[i] === assignments[i - 1]) {
      // Find next different voice to swap with
      for (let j = i + 1; j < assignments.length; j++) {
        if (assignments[j] !== assignments[i]) {
          [assignments[i], assignments[j]] = [assignments[j], assignments[i]];
          break;
        }
      }
    }
  }

  return assignments;
}

/**
 * Group segments by their assigned voice for batched TTS processing
 * @returns Map of voiceId -> array of { index, text, translation, reading }
 */
function groupSegmentsByVoice(
  segments: SegmentData[],
  voiceAssignments: string[]
): Map<string, Array<{ index: number; text: string; translation: string; reading?: string }>> {
  const voiceGroups = new Map<
    string,
    Array<{ index: number; text: string; translation: string; reading?: string }>
  >();

  for (let i = 0; i < segments.length; i++) {
    const voiceId = voiceAssignments[i];
    const segment = segments[i];

    if (!voiceGroups.has(voiceId)) {
      voiceGroups.set(voiceId, []);
    }

    voiceGroups.get(voiceId)!.push({
      index: i,
      text: segment.text,
      translation: segment.translation,
      reading: segment.reading,
    });
  }

  return voiceGroups;
}

/**
 * Generate audio for a narrow listening story version with multiple voices
 * @param packId - Pack ID for folder organization
 * @param segments - Array of text segments to generate audio for
 * @param voiceAssignments - Array of voice IDs (one per segment)
 * @param speed - Playback speed (0.7 for slow, 1.0 for normal)
 * @param versionIndex - Version number for unique file naming
 * @param targetLanguage - Language code (ja, zh, etc.) for logging
 * @param sharedSilencePath - Optional cached silence buffer path (reused across versions)
 */
export async function generateNarrowListeningAudio(
  packId: string,
  segments: SegmentData[],
  voiceAssignments: string[],
  speed: number,
  versionIndex: number,
  targetLanguage: string,
  sharedSilencePath?: string
): Promise<AudioGenerationResult> {
  if (segments.length !== voiceAssignments.length) {
    throw new Error(
      `Segment count (${segments.length}) must match voice assignment count (${voiceAssignments.length})`
    );
  }

  const uniqueVoices = new Set(voiceAssignments);
  console.log(
    `Generating narrow listening audio: ${segments.length} segments, ${uniqueVoices.size} voices, speed=${speed}`
  );

  // Create temp directory for audio segments
  const tempDir = path.join(os.tmpdir(), `nl-audio-${Date.now()}`);
  await fs.mkdir(tempDir, { recursive: true });

  try {
    const audioSegmentFiles: string[] = [];
    const segmentTimings: Array<{ startTime: number; endTime: number; duration: number }> = [];

    // OPTIMIZATION: Group segments by voice and make parallel batched TTS calls
    const voiceGroups = groupSegmentsByVoice(segments, voiceAssignments);
    console.log(
      `[NL] Batching ${segments.length} segments into ${voiceGroups.size} voice groups (parallel TTS calls)...`
    );

    // Get language code from targetLanguage parameter (works for both Google and Polly voices)
    const languageCode = getLanguageCodeForTTS(targetLanguage);

    // Generate audio for each voice group in parallel
    const voiceAudioPromises = Array.from(voiceGroups.entries()).map(
      async ([voiceId, groupSegments]) => {
        console.log(`  [NL] Voice ${voiceId}: generating ${groupSegments.length} segments...`);

        // Batch TTS call for this voice
        const audioBuffers = await synthesizeBatchedTexts(
          groupSegments.map((s) => s.text),
          {
            voiceId,
            languageCode,
            speed,
            pitch: 0,
          }
        );

        // Write each buffer to temp file with original index in filename
        const results = [];
        for (let i = 0; i < audioBuffers.length; i++) {
          const originalIndex = groupSegments[i].index;
          const segmentPath = path.join(tempDir, `segment-${originalIndex}.mp3`);
          await fs.writeFile(segmentPath, audioBuffers[i]);
          const duration = await getAudioDurationFromFile(segmentPath);
          results.push({
            index: originalIndex,
            path: segmentPath,
            duration,
            voiceId,
          });
        }

        return results;
      }
    );

    // Wait for all voice batches to complete
    const allVoiceResults = await Promise.all(voiceAudioPromises);
    const segmentResults = allVoiceResults.flat();

    // Sort by original index to get correct ordering
    segmentResults.sort((a, b) => a.index - b.index);

    console.log(
      `[NL] Generated ${segmentResults.length} segment audio files from ${voiceGroups.size} parallel TTS calls`
    );

    // Use shared silence buffer if provided, otherwise generate (backward compatibility)
    let reusableSilencePath: string;
    let silenceDuration: number;

    if (sharedSilencePath) {
      // Use cached silence buffer
      reusableSilencePath = sharedSilencePath;
      silenceDuration = await getAudioDurationFromFile(reusableSilencePath);
      console.log(`[NL] Using cached silence buffer: ${silenceDuration}ms`);
    } else {
      // Generate silence buffer (backward compatibility)
      const silenceBuffer = await generateSilence(0.8);
      reusableSilencePath = path.join(tempDir, 'silence-reusable.mp3');
      await fs.writeFile(reusableSilencePath, silenceBuffer);
      silenceDuration = await getAudioDurationFromFile(reusableSilencePath);
      console.log(`[NL] Generated new silence buffer: ${silenceDuration}ms`);
    }

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

    // Build result with segment data (including voiceId for each segment)
    const generatedSegments: GeneratedSegment[] = segments.map((seg, idx) => ({
      text: seg.text,
      translation: seg.translation,
      reading: seg.reading || null,
      voiceId: voiceAssignments[idx], // NEW: Track which voice was used for this segment
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
  const listContent = audioFiles.map((f) => `file '${f}'`).join('\n');
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
