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

import { generateJapaneseDateTimeReading } from './utils/readingEngine.js';

loadEnv();

const execFileAsync = promisify(execFile);

type AudioComponent = {
  key: string;
  label: string;
  text: string;
};

type ComponentResult = {
  key: string;
  label: string;
  text: string;
  durationSeconds: number;
  requestMs: number;
  bytes: number;
  outputFile: string;
  warnings: string[];
};

function parseArgValue(args: string[], name: string): string | undefined {
  const index = args.indexOf(`--${name}`);
  if (index === -1) return undefined;
  return args[index + 1];
}

function parseIsoLikeDateInput(value: string | undefined): Date {
  if (!value) {
    return new Date(2026, 1, 13, 9, 44, 0, 0); // 2026-02-13 09:44 local
  }

  // Accepts "YYYY-MM-DDTHH:mm" in local time.
  const [datePart, timePartRaw] = value.split('T');
  const timePart = timePartRaw || '09:44';
  const [year, month, day] = datePart.split('-').map((part) => Number.parseInt(part, 10));
  const [hour, minute] = timePart.split(':').map((part) => Number.parseInt(part, 10));

  if ([year, month, day, hour, minute].some((n) => Number.isNaN(n))) {
    throw new Error(`Invalid --datetime value: ${value}. Expected format YYYY-MM-DDTHH:mm`);
  }

  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

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

function getWarnings(text: string, durationSeconds: number): string[] {
  const warnings: string[] = [];
  const maxExpectedSeconds = Math.max(10, text.length * 0.5);

  if (durationSeconds > maxExpectedSeconds) {
    warnings.push(
      `duration ${durationSeconds.toFixed(2)}s exceeds heuristic max ${maxExpectedSeconds.toFixed(2)}s`
    );
  }
  if (durationSeconds < 0.2) {
    warnings.push(`duration ${durationSeconds.toFixed(2)}s is unusually short`);
  }

  return warnings;
}

function sanitizeKey(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

async function stitchMp3Files(inputPaths: string[], outputPath: string): Promise<void> {
  const concatFilePath = `${outputPath}.concat.txt`;
  const concatContents = inputPaths
    .map((inputPath) => `file '${inputPath.replace(/'/g, "'\\''")}'`)
    .join('\n');

  await fs.writeFile(concatFilePath, concatContents);
  try {
    await execFileAsync('ffmpeg', [
      '-y',
      '-f',
      'concat',
      '-safe',
      '0',
      '-i',
      concatFilePath,
      '-c',
      'copy',
      outputPath,
    ]);
  } finally {
    await fs.unlink(concatFilePath).catch(() => undefined);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const datetimeInput = parseArgValue(args, 'datetime');
  const voiceId = parseArgValue(args, 'voice-id') || 'fishaudio:0dff3f6860294829b98f8c4501b2cf25';
  const speed = Number.parseFloat(parseArgValue(args, 'speed') || '1.0');

  if (!process.env.FISH_AUDIO_API_KEY) {
    throw new Error('Missing FISH_AUDIO_API_KEY. Set it in server/.env or environment.');
  }

  const referenceId = resolveFishAudioVoiceId(voiceId);
  const targetDate = parseIsoLikeDateInput(datetimeInput);
  const reading = generateJapaneseDateTimeReading(targetDate, { hourFormat: '12h' });

  const components: AudioComponent[] = [
    { key: 'year', label: 'Year component', text: reading.parts.yearKana },
    { key: 'month', label: 'Month component', text: reading.parts.monthKana },
    { key: 'day', label: 'Day component', text: reading.parts.dayKana },
    {
      key: 'time_hour_only',
      label: 'Time hour only (separate call)',
      text: reading.parts.hourKana,
    },
    {
      key: 'time_minute_only',
      label: 'Time minute only (separate call)',
      text: reading.parts.minuteKana,
    },
    {
      key: 'time_combined_single_call',
      label: 'Time combined (single TTS call)',
      text: `${reading.parts.hourKana} ${reading.parts.minuteKana}`,
    },
    {
      key: 'full_date_time_no_period_single_call',
      label: 'Combined phrase (date + time, no period)',
      text: `${reading.parts.yearKana} ${reading.parts.monthKana} ${reading.parts.dayKana} ${reading.parts.hourKana} ${reading.parts.minuteKana}`.trim(),
    },
  ];

  const outDir = path.join(
    os.tmpdir(),
    'convolab-fish-date-components',
    new Date().toISOString().replace(/[:.]/g, '-')
  );
  await fs.mkdir(outDir, { recursive: true });

  const results: ComponentResult[] = [];
  const outputPathByKey: Record<string, string> = {};
  for (const component of components) {
    const start = Date.now();
    const audioBuffer = await synthesizeFishAudioSpeech({
      referenceId,
      text: component.text,
      speed,
    });
    const requestMs = Date.now() - start;

    const outputFile = `${component.key}_${sanitizeKey(component.text)}.mp3`;
    const outputPath = path.join(outDir, outputFile);
    await fs.writeFile(outputPath, audioBuffer);
    outputPathByKey[component.key] = outputPath;

    const durationSeconds = await getMp3DurationSeconds(outputPath);
    const warnings = getWarnings(component.text, durationSeconds);

    results.push({
      key: component.key,
      label: component.label,
      text: component.text,
      durationSeconds,
      requestMs,
      bytes: audioBuffer.length,
      outputFile,
      warnings,
    });

    console.log(
      `[Date Audio] ${component.key}: "${component.text}" -> ${durationSeconds.toFixed(2)}s (${requestMs}ms)`
    );
  }

  const stitchedTimeFile = 'time_stitched_hour_plus_minute.mp3';
  const stitchedTimePath = path.join(outDir, stitchedTimeFile);
  await stitchMp3Files(
    [outputPathByKey.time_hour_only, outputPathByKey.time_minute_only],
    stitchedTimePath
  );
  const stitchedDuration = await getMp3DurationSeconds(stitchedTimePath);
  results.push({
    key: 'time_stitched_hour_plus_minute',
    label: 'Time stitched from separate calls',
    text: `${reading.parts.hourKana} + ${reading.parts.minuteKana}`,
    durationSeconds: stitchedDuration,
    requestMs: 0,
    bytes: (await fs.stat(stitchedTimePath)).size,
    outputFile: stitchedTimeFile,
    warnings: [],
  });
  console.log(
    `[Date Audio] time_stitched_hour_plus_minute: "${reading.parts.hourKana} + ${reading.parts.minuteKana}" -> ${stitchedDuration.toFixed(2)}s (stitched)`
  );

  const stitchSequence = ['year', 'month', 'day', 'time_hour_only', 'time_minute_only'];
  const timeCompare = {
    separateCallKeys: ['time_hour_only', 'time_minute_only'],
    stitchedKey: 'time_stitched_hour_plus_minute',
    combinedSingleCallKey: 'time_combined_single_call',
  };

  const manifest = {
    datetimeLocal: targetDate.toISOString(),
    voiceId,
    speed,
    renderedKana: {
      year: reading.parts.yearKana,
      month: reading.parts.monthKana,
      day: reading.parts.dayKana,
      timeHour: reading.parts.hourKana,
      timeMinute: reading.parts.minuteKana,
    },
    stitchSequence,
    timeCompare,
    results,
  };

  await fs.writeFile(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  await fs.writeFile(
    path.join(outDir, 'README.md'),
    [
      '# Fish Audio Date Component Smoke',
      '',
      `Output directory: ${outDir}`,
      '',
      `Input datetime (local): ${datetimeInput || '2026-02-13T09:44'}`,
      `Voice: ${voiceId}`,
      `Speed: ${speed}`,
      'AM/PM: omitted for this test',
      '',
      '## Date Stitch Sequence',
      stitchSequence.map((item, index) => `${index + 1}. ${item}`).join('\n'),
      '',
      '## Time Comparison',
      '- Separate calls: `time_hour_only` + `time_minute_only`',
      '- Stitched output: `time_stitched_hour_plus_minute.mp3`',
      '- One call output: `time_combined_single_call_.mp3`',
      '',
      '## Components',
      ...results.map(
        (row) =>
          `- ${row.key}: "${row.text}" (${row.durationSeconds.toFixed(2)}s, ${row.bytes} bytes)${
            row.warnings.length ? ` [WARN: ${row.warnings.join('; ')}]` : ''
          }`
      ),
    ].join('\n')
  );

  console.log(`\nDate component smoke complete. Artifacts:\n${outDir}`);
}

main().catch((error) => {
  console.error('Date component smoke failed:', error);
  process.exitCode = 1;
});
