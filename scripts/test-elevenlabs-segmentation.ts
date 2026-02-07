#!/usr/bin/env npx tsx
/**
 * Test ElevenLabs Japanese audio segmentation
 *
 * Generates audio for Japanese test phrases using per-unit synthesis (one API call per phrase).
 * Caches API responses to disk so re-runs don't burn ElevenLabs credits.
 *
 * Usage:
 *   npx tsx scripts/test-elevenlabs-segmentation.ts              # Per-unit synthesis
 *   npx tsx scripts/test-elevenlabs-segmentation.ts --compare    # Also generate batched audio
 *   npx tsx scripts/test-elevenlabs-segmentation.ts --no-cache   # Skip cache, force fresh API calls
 *   npx tsx scripts/test-elevenlabs-segmentation.ts --voice Kaori # Use a specific voice
 */

import 'dotenv/config';
import { createHash } from 'crypto';
import { execFile } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { promisify } from 'util';

import ffmpeg from 'fluent-ffmpeg';

import {
  resolveElevenLabsVoiceId,
  synthesizeElevenLabsWithTimestamps,
} from '../server/src/services/ttsProviders/ElevenLabsTTSProvider.js';

const execFileAsync = promisify(execFile);

const SCRIPT_DIR = path.dirname(new URL(import.meta.url).pathname);
const CACHE_DIR = path.join(SCRIPT_DIR, '.cache');
const OUTPUT_DIR = path.join(SCRIPT_DIR, 'output');

const TEST_PHRASES = [
  { text: 'おはようございます', label: 'ohayou-gozaimasu', note: 'Good morning (hiragana only)' },
  { text: '東京は今日とても暑いです', label: 'tokyo-atsui', note: 'Tokyo is very hot today (kanji+hiragana)' },
  { text: '新幹線で大阪に行きました', label: 'shinkansen-osaka', note: 'Went to Osaka by bullet train (heavy kanji)' },
  { text: 'すみません、駅はどこですか', label: 'sumimasen-eki', note: 'Excuse me, where is the station? (mixed)' },
  { text: 'コンビニでお弁当を買いました', label: 'konbini-bento', note: 'Bought a bento at the convenience store (katakana+kanji)' },
];

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    compare: args.includes('--compare'),
    noCache: args.includes('--no-cache'),
    voice: args[args.indexOf('--voice') + 1] || 'Kaori',
  };
}

function cacheKey(text: string, voiceId: string): string {
  return createHash('sha256').update(`${voiceId}:${text}`).digest('hex').slice(0, 16);
}

async function getAudioDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);
      const duration = metadata.format.duration;
      resolve(typeof duration === 'number' ? duration : parseFloat(String(duration)) || 0);
    });
  });
}

async function synthesizeWithCache(
  text: string,
  voiceId: string,
  useCache: boolean
): Promise<{ audioBuffer: Buffer; alignment: { characters: string[]; character_start_times_seconds: number[]; character_end_times_seconds: number[] }; cached: boolean }> {
  const key = cacheKey(text, voiceId);
  const cachePath = path.join(CACHE_DIR, `${key}.json`);

  if (useCache) {
    try {
      const cached = JSON.parse(await fs.readFile(cachePath, 'utf-8'));
      return {
        audioBuffer: Buffer.from(cached.audio_base64, 'base64'),
        alignment: cached.alignment,
        cached: true,
      };
    } catch {
      // Cache miss
    }
  }

  const languageCode = 'ja';
  const { audioBuffer, alignment } = await synthesizeElevenLabsWithTimestamps({
    voiceId,
    text,
    languageCode,
  });

  // Save to cache
  await fs.mkdir(CACHE_DIR, { recursive: true });
  await fs.writeFile(
    cachePath,
    JSON.stringify({
      audio_base64: audioBuffer.toString('base64'),
      alignment,
      text,
      voiceId,
      timestamp: new Date().toISOString(),
    })
  );

  return { audioBuffer, alignment, cached: false };
}

async function generatePerUnit(voiceId: string, useCache: boolean) {
  console.log('\n=== Per-Unit Synthesis (one API call per phrase) ===\n');

  const perUnitDir = path.join(OUTPUT_DIR, 'per-unit');
  await fs.mkdir(perUnitDir, { recursive: true });

  for (const phrase of TEST_PHRASES) {
    const { audioBuffer, alignment, cached } = await synthesizeWithCache(phrase.text, voiceId, useCache);

    const filePath = path.join(perUnitDir, `${phrase.label}.mp3`);
    await fs.writeFile(filePath, audioBuffer);
    const duration = await getAudioDuration(filePath);

    console.log(
      `  ${cached ? '[cached]' : '[fresh]'} ${phrase.label} (${phrase.note})` +
        `\n    Text: ${phrase.text}` +
        `\n    Duration: ${duration.toFixed(2)}s` +
        `\n    Chars aligned: ${alignment.characters.length}` +
        `\n    File: ${filePath}\n`
    );
  }
}

async function generateBatched(voiceId: string, useCache: boolean) {
  console.log('\n=== Batched Synthesis (all phrases in one API call) ===\n');

  const batchedDir = path.join(OUTPUT_DIR, 'batched');
  await fs.mkdir(batchedDir, { recursive: true });

  const combinedText = TEST_PHRASES.map((p) => p.text).join('\n');
  const { audioBuffer, alignment, cached } = await synthesizeWithCache(combinedText, voiceId, useCache);

  // Save the full combined audio
  const combinedPath = path.join(batchedDir, 'combined.mp3');
  await fs.writeFile(combinedPath, audioBuffer);
  const totalDuration = await getAudioDuration(combinedPath);
  console.log(
    `  ${cached ? '[cached]' : '[fresh]'} Combined audio: ${totalDuration.toFixed(2)}s` +
      `\n    Chars aligned: ${alignment.characters.length}` +
      `\n    File: ${combinedPath}\n`
  );

  // Split using alignment data (same logic as batchedTTSClient)
  const delimiter = '\n';
  let cursor = 0;
  const ranges: { label: string; startIndex: number; endIndex: number }[] = [];

  for (let i = 0; i < TEST_PHRASES.length; i++) {
    const text = TEST_PHRASES[i].text;
    const startIndex = cursor;
    const endIndex = startIndex + text.length - 1;
    ranges.push({ label: TEST_PHRASES[i].label, startIndex, endIndex });
    cursor += text.length;
    if (i < TEST_PHRASES.length - 1) {
      cursor += delimiter.length;
    }
  }

  for (let i = 0; i < ranges.length; i++) {
    const range = ranges[i];
    const startCharTime = alignment.character_start_times_seconds[range.startIndex] ?? 0;
    let endCharTime = alignment.character_end_times_seconds[range.endIndex] ?? totalDuration;

    // Add small padding
    const startTime = Math.max(0, startCharTime - 0.02);
    let endTime = endCharTime + 0.08;

    // Clamp to not overlap next segment
    if (i < ranges.length - 1) {
      const nextStart = alignment.character_start_times_seconds[ranges[i + 1].startIndex] ?? endTime;
      if (endTime > nextStart) endTime = nextStart;
    }
    endTime = Math.min(endTime, totalDuration);

    const segmentPath = path.join(batchedDir, `${range.label}.mp3`);
    const duration = endTime - startTime;

    // Extract segment with ffmpeg
    await new Promise<void>((resolve, reject) => {
      execFileAsync('ffmpeg', [
        '-y',
        '-i', combinedPath,
        '-ss', String(startTime),
        '-t', String(duration),
        '-c:a', 'libmp3lame',
        '-q:a', '2',
        segmentPath,
      ])
        .then(() => resolve())
        .catch(reject);
    });

    const segDuration = await getAudioDuration(segmentPath);
    const phrase = TEST_PHRASES[i];
    console.log(
      `  ${phrase.label} (${phrase.note})` +
        `\n    Text: ${phrase.text}` +
        `\n    Alignment: ${startCharTime.toFixed(3)}s -> ${endCharTime.toFixed(3)}s` +
        `\n    Cut: ${startTime.toFixed(3)}s -> ${endTime.toFixed(3)}s` +
        `\n    Duration: ${segDuration.toFixed(2)}s` +
        `\n    File: ${segmentPath}\n`
    );
  }
}

async function main() {
  const { compare, noCache, voice } = parseArgs();
  const useCache = !noCache;

  console.log('ElevenLabs Japanese Segmentation Test');
  console.log('=====================================');
  console.log(`Voice: ${voice}`);
  console.log(`Cache: ${useCache ? 'enabled' : 'disabled'}`);
  console.log(`Mode: ${compare ? 'compare (per-unit + batched)' : 'per-unit only'}`);

  const voiceId = await resolveElevenLabsVoiceId(voice);
  console.log(`Resolved voice ID: ${voiceId}`);

  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  await generatePerUnit(voiceId, useCache);

  if (compare) {
    await generateBatched(voiceId, useCache);

    console.log('\n=== Comparison ===');
    console.log('Listen to files in scripts/output/per-unit/ vs scripts/output/batched/');
    console.log('Per-unit files should have clean boundaries with no bleed from adjacent phrases.');
    console.log('Batched files may have audio from adjacent phrases bleeding in.');
  }

  console.log('\nDone! Output files in scripts/output/');
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
