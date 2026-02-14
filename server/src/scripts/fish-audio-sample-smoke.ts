/* eslint-disable no-console */
import { execFile } from 'child_process';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { promisify } from 'util';

import { config as loadEnv } from 'dotenv';

import {
  resolveFishAudioVoiceId,
  synthesizeFishAudioSpeech,
} from '../services/ttsProviders/FishAudioTTSProvider.js';

loadEnv();

const execFileAsync = promisify(execFile);

type SmokeSample = {
  id: string;
  label: string;
  voiceId: string;
  speed: number;
  text: string;
};

type SmokeResult = {
  id: string;
  label: string;
  voiceId: string;
  speed: number;
  textLength: number;
  durationSeconds: number;
  requestMs: number;
  bytes: number;
  outputFile: string;
  warnings: string[];
};

const FISH_AUDIO_SMOKE_SAMPLES: SmokeSample[] = [
  {
    id: 'l2_full_sentence_normal',
    label: 'L2 full sentence (normal)',
    voiceId: 'fishaudio:0dff3f6860294829b98f8c4501b2cf25',
    speed: 1.0,
    text: '美咲さん、この前北海道に行ったって言ってたよね？',
  },
  {
    id: 'l2_full_sentence_slow',
    label: 'L2 full sentence (slow)',
    voiceId: 'fishaudio:72416f3ff95541d9a2456b945e8a7c32',
    speed: 0.85,
    text: 'うん、そうだよ！やっぱり北海道は最高だった！',
  },
  {
    id: 'l2_short_risk_case',
    label: 'L2 short phrase (degenerate-risk check)',
    voiceId: 'fishaudio:694e06f2dcc44e4297961d68d6a98313',
    speed: 1.0,
    text: 'そうだよ。',
  },
  {
    id: 'l2_kana_only',
    label: 'L2 kana-only rendering',
    voiceId: 'fishaudio:e6e20195abee4187bddfd1a2609a04f9',
    speed: 1.0,
    text: 'ほっかいどうで らーめんと すーぷかれーを たべました。',
  },
  {
    id: 'l2_control_tokens',
    label: 'L2 with Fish control tags',
    voiceId: 'fishaudio:9639f090aa6346329d7d3aca7e6b7226',
    speed: 1.0,
    text: '(calm) 今日はゆっくり練習しましょう。(breath) もう一度言ってみてください。',
  },
  {
    id: 'l1_narration_english',
    label: 'L1 narration (English)',
    voiceId: 'fishaudio:ac934b39586e475b83f3277cd97b5cd4',
    speed: 1.0,
    text: 'Now listen and repeat naturally. Focus on rhythm and pacing.',
  },
];

async function getMp3DurationSeconds(filePath: string): Promise<number> {
  const { stdout } = await execFileAsync('ffprobe', [
    '-v',
    'error',
    '-show_entries',
    'format=duration',
    '-of',
    'default=noprint_wrappers=1:nokey=1',
    filePath,
  ]);

  const parsed = Number.parseFloat(stdout.trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

function getWarnings(textLength: number, durationSeconds: number): string[] {
  const warnings: string[] = [];

  // Mirrors server-side guard logic for suspiciously long outputs.
  const maxExpectedSeconds = Math.max(10, textLength * 0.5);
  if (durationSeconds > maxExpectedSeconds) {
    warnings.push(
      `duration ${durationSeconds.toFixed(2)}s exceeds heuristic max ${maxExpectedSeconds.toFixed(2)}s`
    );
  }

  if (durationSeconds < 0.25) {
    warnings.push(`duration ${durationSeconds.toFixed(2)}s is unexpectedly short`);
  }

  return warnings;
}

async function main() {
  if (!process.env.FISH_AUDIO_API_KEY) {
    throw new Error('Missing FISH_AUDIO_API_KEY. Set it in server/.env or environment.');
  }

  const outDir = path.join(
    os.tmpdir(),
    'convolab-fish-audio-smoke',
    new Date().toISOString().replace(/[:.]/g, '-')
  );
  await fs.mkdir(outDir, { recursive: true });

  const results: SmokeResult[] = [];

  for (const sample of FISH_AUDIO_SMOKE_SAMPLES) {
    const referenceId = resolveFishAudioVoiceId(sample.voiceId);
    const start = Date.now();
    const audio = await synthesizeFishAudioSpeech({
      referenceId,
      text: sample.text,
      speed: sample.speed,
    });
    const requestMs = Date.now() - start;

    const outputFile = `${sample.id}.mp3`;
    const outputPath = path.join(outDir, outputFile);
    await fs.writeFile(outputPath, audio);
    const durationSeconds = await getMp3DurationSeconds(outputPath);
    const warnings = getWarnings(sample.text.length, durationSeconds);

    results.push({
      id: sample.id,
      label: sample.label,
      voiceId: sample.voiceId,
      speed: sample.speed,
      textLength: sample.text.length,
      durationSeconds,
      requestMs,
      bytes: audio.length,
      outputFile,
      warnings,
    });

    console.log(
      `[Fish Smoke] ${sample.id}: ${durationSeconds.toFixed(2)}s, ${audio.length} bytes, ${requestMs}ms`
    );
  }

  await fs.writeFile(path.join(outDir, 'results.json'), JSON.stringify(results, null, 2));

  const markdown = [
    '# Fish Audio Smoke Test',
    '',
    `Output directory: ${outDir}`,
    '',
    '| Sample | Duration (s) | Request (ms) | Bytes | Warnings |',
    '|---|---:|---:|---:|---|',
    ...results.map(
      (row) =>
        `| ${row.id} | ${row.durationSeconds.toFixed(2)} | ${row.requestMs} | ${row.bytes} | ${
          row.warnings.length ? row.warnings.join('; ') : 'none'
        } |`
    ),
    '',
    '## Notes',
    '- This is a small quality-and-stability smoke set, not full coverage.',
    '- Heuristic warning threshold mirrors the current degenerate-audio guard in batched synthesis.',
  ].join('\n');

  await fs.writeFile(path.join(outDir, 'README.md'), markdown);

  console.log(`\nFish Audio smoke test complete. Artifacts written to:\n${outDir}`);
}

main().catch((error) => {
  console.error('Fish Audio smoke test failed:', error);
  process.exitCode = 1;
});
