/* eslint-disable no-console */
import { execFile } from 'child_process';
import { existsSync, promises as fs } from 'fs';
import path from 'path';
import { promisify } from 'util';

import { Polly, SynthesizeSpeechCommand, VoiceId } from '@aws-sdk/client-polly';
import { TTS_VOICES } from '@languageflow/shared/src/constants-new.js';
import {
  getLanguageCodeFromVoiceId,
  getProviderFromVoiceId,
} from '@languageflow/shared/src/voiceSelection.js';
import { config as loadEnv } from 'dotenv';

import { buildMoneyReading } from '../../../client/src/features/tools/japaneseMoney/logic/moneyFormatting';
import { gcsFileExists, uploadFileToGCSPath } from '../services/storageClient.js';
import {
  resolveFishAudioVoiceId,
  synthesizeFishAudioSpeech,
} from '../services/ttsProviders/FishAudioTTSProvider.js';
import { GoogleTTSProvider } from '../services/ttsProviders/GoogleTTSProvider.js';

import { parseArgValue, parseIntegerArg } from './utils/scriptArgs.js';

loadEnv();

const execFileAsync = promisify(execFile);
const DEFAULT_VOICE_ID = 'ja-JP-Neural2-C';
const MIN_CHUNK = 0;
const MAX_CHUNK = 9999;

type Provider = 'fishaudio' | 'google' | 'polly' | 'azure';

type MoneyAudioEntry = {
  id: string;
  category: 'chunk' | 'unit';
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
  uploadedToGcs?: boolean;
  gcsPath?: string;
};

type Manifest = {
  version: number;
  generatedAt: string;
  voiceId: string;
  voiceDescription: string;
  provider: Provider;
  outputDir: string;
  chunkRange: {
    start: number;
    end: number;
  };
  totals: {
    totalEntries: number;
    generated: number;
    failed: number;
    skipped: number;
    uploadedToGcs: number;
  };
  entries: MoneyAudioEntry[];
  results: GenerationResult[];
};

function sanitizeFilePart(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function resolveDefaultOutputDir(): string {
  const directClientPath = path.join(
    process.cwd(),
    'client',
    'public',
    'tools-audio',
    'japanese-money',
    'google-kento-professional'
  );
  if (existsSync(path.join(process.cwd(), 'client'))) {
    return directClientPath;
  }

  return path.resolve(
    process.cwd(),
    '..',
    'client',
    'public',
    'tools-audio',
    'japanese-money',
    'google-kento-professional'
  );
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
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  if (!accessKeyId) {
    throw new Error('AWS_ACCESS_KEY_ID is not set');
  }

  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  if (!secretAccessKey) {
    throw new Error('AWS_SECRET_ACCESS_KEY is not set');
  }

  const polly = new Polly({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
      accessKeyId,
      secretAccessKey,
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

function getChunkKana(chunkValue: number): string {
  const reading = buildMoneyReading(chunkValue);
  const firstSegment = reading.segments[0];
  return firstSegment?.digitsReading || 'れい';
}

function buildEntries(chunkStart: number, chunkEnd: number): MoneyAudioEntry[] {
  const entries: MoneyAudioEntry[] = [];

  for (let chunkValue = chunkStart; chunkValue <= chunkEnd; chunkValue += 1) {
    const chunkId = String(chunkValue).padStart(4, '0');
    entries.push({
      id: `chunk_${chunkId}`,
      category: 'chunk',
      label: `Chunk ${chunkId}`,
      text: getChunkKana(chunkValue),
      relativePath: `money/chunk/${chunkId}.mp3`,
    });
  }

  const unitEntries: Array<{ id: string; label: string; text: string; file: string }> = [
    { id: 'unit_man', label: 'Unit man', text: 'まん', file: 'man.mp3' },
    { id: 'unit_oku', label: 'Unit oku', text: 'おく', file: 'oku.mp3' },
    { id: 'unit_cho', label: 'Unit cho', text: 'ちょう', file: 'cho.mp3' },
    { id: 'unit_yen', label: 'Unit yen', text: 'えん', file: 'yen.mp3' },
  ];

  unitEntries.forEach((unitEntry) => {
    entries.push({
      id: unitEntry.id,
      category: 'unit',
      label: unitEntry.label,
      text: unitEntry.text,
      relativePath: `money/unit/${unitEntry.file}`,
    });
  });

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
  const outDirArg = parseArgValue(args, 'out-dir');
  const chunkStart = parseIntegerArg(args, 'chunk-start', MIN_CHUNK, MIN_CHUNK, MAX_CHUNK);
  const chunkEnd = parseIntegerArg(args, 'chunk-end', MAX_CHUNK, MIN_CHUNK, MAX_CHUNK);
  const uploadGcs = args.includes('--upload-gcs');
  const onlyMissing = args.includes('--only-missing');
  const gcsRoot = (parseArgValue(args, 'gcs-root') || 'tools-audio').replace(/^\/+|\/+$/g, '');

  if (chunkStart > chunkEnd) {
    throw new Error(`Invalid chunk range: ${chunkStart}..${chunkEnd}. start must be <= end.`);
  }

  const provider = getProviderFromVoiceId(voiceId) as Provider;
  const languageCode = getLanguageCodeFromVoiceId(voiceId);
  const voiceDescription = resolveVoiceDescription(voiceId);
  // Logged for operator visibility; object paths stay fixed to google-kento-professional.
  const voiceSlug = sanitizeFilePart(voiceDescription) || sanitizeFilePart(voiceId) || 'voice';
  const outDir = outDirArg || resolveDefaultOutputDir();

  if (provider === 'azure') {
    throw new Error('Azure provider is not wired in this repository yet.');
  }

  console.log(`[Money Components] Voice: ${voiceDescription} (${voiceId})`);
  console.log(`[Money Components] Provider: ${provider}`);
  console.log(`[Money Components] Chunk range: ${chunkStart}..${chunkEnd}`);
  console.log(`[Money Components] Output: ${outDir}`);
  console.log(`[Money Components] Upload to GCS: ${uploadGcs ? 'yes' : 'no'}`);
  console.log(`[Money Components] Only missing: ${onlyMissing ? 'yes' : 'no'}`);
  // We keep a stable object prefix so client URLs and signed-URL caching stay deterministic.
  console.log(`[Money Components] Voice slug: ${voiceSlug}`);

  const entries = buildEntries(chunkStart, chunkEnd);
  await fs.mkdir(outDir, { recursive: true });

  const results: GenerationResult[] = [];
  let generated = 0;
  let failed = 0;
  let skipped = 0;
  let uploadedToGcs = 0;

  for (const entry of entries) {
    const absolutePath = path.join(outDir, entry.relativePath);
    await ensureDirFor(absolutePath);

    let didGenerate = false;
    let didUpload = false;
    let gcsPath: string | undefined;

    try {
      const localExists = await fs
        .stat(absolutePath)
        .then(() => true)
        .catch(() => false);

      if (!(onlyMissing && localExists)) {
        const audio = await synthesizeByProvider(provider, voiceId, languageCode, entry.text);
        await fs.writeFile(absolutePath, audio);
        didGenerate = true;
        generated += 1;
      } else {
        skipped += 1;
      }

      if (uploadGcs) {
        // Intentionally fixed path: clients reference this canonical prefix.
        const destinationPath = `${gcsRoot}/japanese-money/google-kento-professional/${entry.relativePath}`;
        const shouldUpload =
          !onlyMissing || !(await gcsFileExists(destinationPath).catch(() => false));

        if (shouldUpload) {
          await uploadFileToGCSPath({
            localFilePath: absolutePath,
            destinationPath,
            contentType: 'audio/mpeg',
          });
          uploadedToGcs += 1;
          didUpload = true;
        }

        gcsPath = destinationPath;
      }

      if (didGenerate) {
        const durationSeconds = await getMp3DurationSeconds(absolutePath);
        results.push({
          id: entry.id,
          status: 'generated',
          relativePath: entry.relativePath,
          text: entry.text,
          durationSeconds,
          uploadedToGcs: didUpload,
          gcsPath,
        });
      } else {
        results.push({
          id: entry.id,
          status: 'skipped',
          relativePath: entry.relativePath,
          text: entry.text,
          reason: 'Skipped local synthesis because --only-missing was set and file already exists',
          uploadedToGcs: didUpload,
          gcsPath,
        });
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      results.push({
        id: entry.id,
        status: 'failed',
        relativePath: entry.relativePath,
        text: entry.text,
        reason,
        uploadedToGcs: didUpload,
        gcsPath,
      });
      failed += 1;
      console.log(`[Money Components] FAIL ${entry.id} -> ${reason}`);
      continue;
    }

    if (didGenerate) {
      console.log(`[Money Components] OK ${entry.id} -> ${entry.relativePath}`);
    } else {
      console.log(`[Money Components] SKIP ${entry.id} (local exists)`);
    }
  }

  const manifest: Manifest = {
    version: 1,
    generatedAt: new Date().toISOString(),
    voiceId,
    voiceDescription,
    provider,
    outputDir: outDir,
    chunkRange: {
      start: chunkStart,
      end: chunkEnd,
    },
    totals: {
      totalEntries: entries.length,
      generated,
      failed,
      skipped,
      uploadedToGcs,
    },
    entries,
    results,
  };

  await fs.writeFile(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  await fs.writeFile(
    path.join(outDir, 'README.md'),
    [
      '# Japanese Money Components QC',
      '',
      `Voice: ${voiceDescription} (${voiceId})`,
      `Chunk range: ${chunkStart}..${chunkEnd}`,
      `Total entries: ${entries.length} (${chunkEnd - chunkStart + 1} chunk clips + 4 unit clips)`,
      '',
      '## Example',
      '',
      '```bash',
      'cd /path/to/convo-lab/server',
      `npm run smoke:jp-money-components-qc -- --voice-id "${voiceId}" --chunk-start ${chunkStart} --chunk-end ${chunkEnd} --out-dir "${outDir}"`,
      '```',
      '',
      '## Upload to GCS (deterministic paths)',
      '',
      '```bash',
      'cd /path/to/convo-lab/server',
      `npm run smoke:jp-money-components-qc -- --voice-id "${voiceId}" --upload-gcs --gcs-root "${gcsRoot}" --out-dir "${outDir}"`,
      '```',
      '',
      '## Deterministic object prefix',
      '',
      '```text',
      `${gcsRoot}/japanese-money/google-kento-professional/money/...`,
      '```',
    ].join('\n')
  );

  console.log('\nJapanese money component generation complete.');
  console.log(`Output: ${outDir}`);
  console.log(
    `Totals -> generated: ${generated}, failed: ${failed}, skipped: ${skipped}, uploaded: ${uploadedToGcs}, total: ${entries.length}`
  );
}

main().catch((error) => {
  console.error('Japanese money component generation failed:', error);
  process.exitCode = 1;
});
