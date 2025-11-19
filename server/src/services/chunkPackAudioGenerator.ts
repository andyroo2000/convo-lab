import { synthesizeSpeech, generateSilence } from './ttsClient.js';
import { uploadToGCS } from './storageClient.js';
import ffmpeg from 'fluent-ffmpeg';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import { ChunkExampleData, ChunkStorySegmentData, ChunkExerciseData } from '../types/chunkPack.js';

// Configure ffmpeg/ffprobe paths
try {
  const ffprobePath = execSync('which ffprobe').toString().trim();
  const ffmpegPath = execSync('which ffmpeg').toString().trim();
  if (ffprobePath) ffmpeg.setFfprobePath(ffprobePath);
  if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath);
} catch (e) {
  console.warn('Could not find ffmpeg/ffprobe in PATH');
}

// Default Japanese voice for chunk packs
const DEFAULT_VOICE = 'ja-JP-NanamiNeural';

// Available Japanese voices for variety
const JAPANESE_VOICES = [
  'ja-JP-NanamiNeural',  // Female, bright
  'ja-JP-DaichiNeural',  // Male, adult
  'ja-JP-ShioriNeural',  // Female, calm
  'ja-JP-NaokiNeural',   // Male, clear
  'ja-JP-MayuNeural',    // Female, animated
  'ja-JP-MasaruMultilingualNeural', // Male, warm
];

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
 * Generate audio for chunk pack examples at multiple speeds
 */
export async function generateExampleAudio(
  packId: string,
  examples: ChunkExampleData[]
): Promise<Map<string, { audioUrl_0_7: string; audioUrl_0_85: string; audioUrl_1_0: string }>> {
  console.log(`Generating audio for ${examples.length} chunk examples at 3 speeds`);

  const audioUrls = new Map<string, { audioUrl_0_7: string; audioUrl_0_85: string; audioUrl_1_0: string }>();
  const speeds = [
    { key: 'audioUrl_0_7' as const, speed: 0.7 },
    { key: 'audioUrl_0_85' as const, speed: 0.85 },
    { key: 'audioUrl_1_0' as const, speed: 1.0 },
  ];

  for (let i = 0; i < examples.length; i++) {
    const example = examples[i];
    console.log(`  Example ${i + 1}/${examples.length}: "${example.sentence.substring(0, 30)}..."`);

    // Use different voice for each example (cycle through available voices)
    const voiceId = JAPANESE_VOICES[i % JAPANESE_VOICES.length];
    console.log(`  Using voice: ${voiceId}`);

    const exampleUrls: any = {};

    for (const { key, speed } of speeds) {
      try {
        // Clean text and generate TTS at this speed
        const cleanText = removeFurigana(example.sentence);
        const buffer = await synthesizeSpeech({
          text: cleanText,
          voiceId,
          languageCode: 'ja-JP',
          speed,
          pitch: 0,
          useSSML: false,
          useDraftMode: true, // Use Edge TTS
        });

        // Upload to GCS
        const filename = `example-${i}-${speed}x.mp3`;
        const url = await uploadToGCS({
          buffer,
          filename,
          contentType: 'audio/mpeg',
          folder: `chunk-packs/${packId}`,
        });

        exampleUrls[key] = url;
        console.log(`    Generated ${speed}x audio`);
      } catch (error) {
        console.error(`Failed to generate ${speed}x audio for example ${i}:`, error);
        // Continue with other speeds even if one fails
      }
    }

    // Store URLs keyed by sentence for later lookup
    if (Object.keys(exampleUrls).length > 0) {
      audioUrls.set(example.sentence, exampleUrls);
    }
  }

  return audioUrls;
}

/**
 * Generate audio for chunk pack story segments with timings
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
  console.log(`Generating audio for story with ${segments.length} segments`);

  // Create temp directory
  const tempDir = path.join(os.tmpdir(), `chunk-story-${Date.now()}`);
  await fs.mkdir(tempDir, { recursive: true });

  try {
    const audioSegmentFiles: string[] = [];
    const segmentTimings: Array<{ startTime: number; endTime: number; duration: number; url: string }> = [];
    let currentTime = 0;

    // Detect speakers and assign voices
    const speakerVoices = new Map<string, string>();
    const availableVoices = ['ja-JP-NanamiNeural', 'ja-JP-DaichiNeural']; // Female and Male
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

    console.log(`  Detected speakers:`, Array.from(speakerVoices.entries()));

    // Generate audio for each segment
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      console.log(`  Segment ${i + 1}/${segments.length}: "${segment.japaneseText.substring(0, 30)}..."`);

      // Parse speaker and text
      let textToSpeak = segment.japaneseText;
      let voiceId = DEFAULT_VOICE;

      const speakerMatch = segment.japaneseText.match(/^([^：:]+)[：:]\s*(.+)$/);
      if (speakerMatch) {
        const speaker = speakerMatch[1].trim();
        textToSpeak = speakerMatch[2].trim(); // Strip speaker name
        voiceId = speakerVoices.get(speaker) || DEFAULT_VOICE;
        console.log(`    Speaker: ${speaker}, Voice: ${voiceId}`);
      }

      // Clean furigana and generate TTS with appropriate voice (slower for learning)
      const cleanText = removeFurigana(textToSpeak);
      const buffer = await synthesizeSpeech({
        text: cleanText,
        voiceId,
        languageCode: 'ja-JP',
        speed: 0.85, // Slower for learners
        pitch: 0,
        useSSML: false,
        useDraftMode: true,
      });

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

      // Add silence between segments (600ms - slightly shorter than NL)
      if (i < segments.length - 1) {
        const silenceBuffer = await generateSilence(0.6, true);
        const silencePath = path.join(tempDir, `silence-${i}.mp3`);
        await fs.writeFile(silencePath, silenceBuffer);
        audioSegmentFiles.push(silencePath);

        const silenceDuration = await getAudioDurationFromFile(silencePath);
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

  for (let i = 0; i < gapFillExercises.length; i++) {
    const exercise = gapFillExercises[i];

    // Extract sentence from prompt (remove blank marker if present)
    const sentence = exercise.prompt.replace(/___/g, exercise.correctOption);

    try {
      // Clean furigana and generate TTS (slower for learning)
      const cleanText = removeFurigana(sentence);
      const buffer = await synthesizeSpeech({
        text: cleanText,
        voiceId: DEFAULT_VOICE,
        languageCode: 'ja-JP',
        speed: 0.85, // Slower for learners
        pitch: 0,
        useSSML: false,
        useDraftMode: true,
      });

      const filename = `exercise-${i}.mp3`;
      const url = await uploadToGCS({
        buffer,
        filename,
        contentType: 'audio/mpeg',
        folder: `chunk-packs/${packId}`,
      });

      // Store URL keyed by prompt for later lookup
      audioUrls.set(exercise.prompt, url);
    } catch (error) {
      console.error(`Failed to generate audio for exercise ${i}:`, error);
    }
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
