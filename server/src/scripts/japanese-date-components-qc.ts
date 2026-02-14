/* eslint-disable no-console */
import { execFile } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { promisify } from 'util';

import { Polly, SynthesizeSpeechCommand, VoiceId } from '@aws-sdk/client-polly';
import { TTS_VOICES } from '@languageflow/shared/src/constants-new.js';
import {
  getLanguageCodeFromVoiceId,
  getProviderFromVoiceId,
} from '@languageflow/shared/src/voiceSelection.js';
import { config as loadEnv } from 'dotenv';

import {
  resolveFishAudioVoiceId,
  synthesizeFishAudioSpeech,
} from '../services/ttsProviders/FishAudioTTSProvider.js';
import { GoogleTTSProvider } from '../services/ttsProviders/GoogleTTSProvider.js';

import { generateJapaneseDateTimeReading } from './utils/readingEngine.js';

loadEnv();

const execFileAsync = promisify(execFile);
const DEFAULT_VOICE_ID = 'ja-JP-Neural2-C';
const DEFAULT_START_YEAR = 1900;
const DEFAULT_END_YEAR = 2100;

type Provider = 'fishaudio' | 'google' | 'polly' | 'azure';

type DateComponentEntry = {
  id: string;
  category: 'year' | 'month' | 'day';
  label: string;
  text: string;
  relativePath: string;
};

type GenerationResult = {
  id: string;
  status: 'generated' | 'failed' | 'skipped';
  relativePath: string;
  text: string;
  durationSeconds?: number;
  reason?: string;
};

type Manifest = {
  version: number;
  generatedAt: string;
  voiceId: string;
  voiceDescription: string;
  provider: Provider;
  outputDir: string;
  yearRange: {
    startYear: number;
    endYear: number;
  };
  totals: {
    totalEntries: number;
    generated: number;
    failed: number;
    skipped: number;
  };
  entries: DateComponentEntry[];
  results: GenerationResult[];
};

function parseArgValue(args: string[], name: string): string | undefined {
  const index = args.indexOf(`--${name}`);
  if (index === -1) return undefined;
  return args[index + 1];
}

function sanitizeFilePart(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function streamToBuffer(stream: unknown): Promise<Buffer> {
  if (!stream) return Buffer.alloc(0);
  if (stream instanceof Blob) return Buffer.from(await stream.arrayBuffer());

  if (stream instanceof ReadableStream) {
    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];
    let done = false;
    while (!done) {
      const result = await reader.read();
      done = result.done;
      if (!done && result.value) chunks.push(result.value);
    }
    return Buffer.concat(chunks);
  }

  const chunks: Buffer[] = [];
  const nodeStream = stream as NodeJS.ReadableStream;
  await new Promise<void>((resolve, reject) => {
    nodeStream.on('data', (chunk) =>
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array))
    );
    nodeStream.on('end', resolve);
    nodeStream.on('error', reject);
  });
  return Buffer.concat(chunks);
}

async function synthesizePollySpeech(text: string, voiceId: string): Promise<Buffer> {
  const polly = new Polly({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    },
  });

  const response = await polly.send(
    new SynthesizeSpeechCommand({
      Text: text,
      VoiceId: voiceId as VoiceId,
      Engine: 'neural',
      TextType: 'text',
      OutputFormat: 'mp3',
    })
  );

  return streamToBuffer(response.AudioStream);
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

function resolveVoiceDescription(voiceId: string): string {
  const voices = TTS_VOICES.ja.voices as ReadonlyArray<{ id: string; description: string }>;
  return voices.find((voice) => voice.id === voiceId)?.description || voiceId;
}

function buildEntries(startYear: number, endYear: number): DateComponentEntry[] {
  const entries: DateComponentEntry[] = [];

  for (let year = startYear; year <= endYear; year += 1) {
    const d = new Date(year, 1, 13, 9, 0, 0, 0);
    const reading = generateJapaneseDateTimeReading(d, { hourFormat: '12h' });
    entries.push({
      id: `year_${year}`,
      category: 'year',
      label: `Year ${year}`,
      text: reading.parts.yearKana,
      relativePath: `date/year/${year}.mp3`,
    });
  }

  for (let month = 1; month <= 12; month += 1) {
    const d = new Date(2026, month - 1, 13, 9, 0, 0, 0);
    const reading = generateJapaneseDateTimeReading(d, { hourFormat: '12h' });
    entries.push({
      id: `month_${month}`,
      category: 'month',
      label: `Month ${month}`,
      text: reading.parts.monthKana,
      relativePath: `date/month/${month.toString().padStart(2, '0')}.mp3`,
    });
  }

  for (let day = 1; day <= 31; day += 1) {
    const d = new Date(2026, 1, day, 9, 0, 0, 0);
    const reading = generateJapaneseDateTimeReading(d, { hourFormat: '12h' });
    entries.push({
      id: `day_${day}`,
      category: 'day',
      label: `Day ${day}`,
      text: reading.parts.dayKana,
      relativePath: `date/day/${day.toString().padStart(2, '0')}.mp3`,
    });
  }

  return entries;
}

async function synthesizeByProvider(
  provider: Provider,
  voiceId: string,
  languageCode: string,
  text: string
): Promise<Buffer> {
  if (provider === 'fishaudio') {
    return synthesizeFishAudioSpeech({
      referenceId: resolveFishAudioVoiceId(voiceId),
      text,
      speed: 1.0,
    });
  }

  if (provider === 'google') {
    const google = new GoogleTTSProvider();
    return google.synthesizeSpeech({
      text,
      voiceId,
      languageCode,
      speed: 1.0,
    });
  }

  if (provider === 'polly') {
    return synthesizePollySpeech(text, voiceId);
  }

  throw new Error('Azure provider is not wired in this repository.');
}

async function ensureDirFor(filePath: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

async function main() {
  const args = process.argv.slice(2);
  const voiceId = parseArgValue(args, 'voice-id') || DEFAULT_VOICE_ID;
  const defectsJsonPath = parseArgValue(args, 'defects-json');
  const outDirArg = parseArgValue(args, 'out-dir');

  const startYear = Number.parseInt(
    parseArgValue(args, 'start-year') || `${DEFAULT_START_YEAR}`,
    10
  );
  const endYear = Number.parseInt(parseArgValue(args, 'end-year') || `${DEFAULT_END_YEAR}`, 10);

  if (!Number.isInteger(startYear) || !Number.isInteger(endYear) || startYear > endYear) {
    throw new Error('Invalid year range. Use --start-year <= --end-year.');
  }

  const provider = getProviderFromVoiceId(voiceId) as Provider;
  const languageCode = getLanguageCodeFromVoiceId(voiceId);
  const voiceDescription = resolveVoiceDescription(voiceId);
  const voiceSlug = sanitizeFilePart(voiceDescription) || sanitizeFilePart(voiceId) || 'voice';
  const outDir = outDirArg || `/Users/andrewlandry/Desktop/date-components-qc/${voiceSlug}`;

  if (provider === 'azure') {
    throw new Error('Azure provider is not wired in this repository yet.');
  }

  let defectiveSet: Set<string> | null = null;
  if (defectsJsonPath) {
    const raw = await fs.readFile(defectsJsonPath, 'utf8');
    const parsed = JSON.parse(raw) as { defectiveIds?: string[] };
    defectiveSet = new Set(parsed.defectiveIds || []);
    if (defectiveSet.size === 0) {
      throw new Error(`No defectiveIds found in ${defectsJsonPath}`);
    }
  }

  const entries = buildEntries(startYear, endYear);
  await fs.mkdir(outDir, { recursive: true });
  await fs.mkdir(path.join(outDir, 'qc', 'defective'), { recursive: true });

  const results: GenerationResult[] = [];
  let generated = 0;
  let failed = 0;
  let skipped = 0;

  for (const entry of entries) {
    if (defectiveSet && !defectiveSet.has(entry.id)) {
      results.push({
        id: entry.id,
        status: 'skipped',
        relativePath: entry.relativePath,
        text: entry.text,
      });
      skipped += 1;
      continue;
    }

    const absolutePath = path.join(outDir, entry.relativePath);
    await ensureDirFor(absolutePath);

    try {
      if (defectiveSet) {
        const exists = await fs
          .stat(absolutePath)
          .then(() => true)
          .catch(() => false);
        if (exists) {
          const archivedName = `${entry.id}--${Date.now()}.mp3`;
          await fs.copyFile(absolutePath, path.join(outDir, 'qc', 'defective', archivedName));
        }
      }

      const audio = await synthesizeByProvider(provider, voiceId, languageCode, entry.text);
      await fs.writeFile(absolutePath, audio);
      const durationSeconds = await getMp3DurationSeconds(absolutePath);

      results.push({
        id: entry.id,
        status: 'generated',
        relativePath: entry.relativePath,
        text: entry.text,
        durationSeconds,
      });
      generated += 1;

      console.log(`[Date Components] OK ${entry.id} -> ${entry.relativePath}`);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      results.push({
        id: entry.id,
        status: 'failed',
        relativePath: entry.relativePath,
        text: entry.text,
        reason,
      });
      failed += 1;
      console.log(`[Date Components] FAIL ${entry.id} -> ${reason}`);
    }
  }

  const manifest: Manifest = {
    version: 1,
    generatedAt: new Date().toISOString(),
    voiceId,
    voiceDescription,
    provider,
    outputDir: outDir,
    yearRange: {
      startYear,
      endYear,
    },
    totals: {
      totalEntries: entries.length,
      generated,
      failed,
      skipped,
    },
    entries,
    results,
  };

  await fs.writeFile(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  await fs.writeFile(
    path.join(outDir, 'qc', 'README.md'),
    [
      '# Date Component QC',
      '',
      `Voice: ${voiceDescription} (${voiceId})`,
      `Range: ${startYear}..${endYear}`,
      '',
      'To regenerate only defective clips:',
      '',
      '```bash',
      'cd /Users/andrewlandry/source/convo-lab/server',
      `npm run smoke:jp-date-components-qc -- --voice-id "${voiceId}" --start-year ${startYear} --end-year ${endYear} --out-dir "${outDir}" --defects-json "/path/to/defects.json"`,
      '```',
      '',
      'Old defective versions are copied into `qc/defective/` before overwrite.',
    ].join('\n')
  );

  console.log('\nDate component generation complete.');
  console.log(`Output: ${outDir}`);
  console.log(
    `Totals -> generated: ${generated}, failed: ${failed}, skipped: ${skipped}, total: ${entries.length}`
  );
}

main().catch((error) => {
  console.error('Date component generation failed:', error);
  process.exitCode = 1;
});
