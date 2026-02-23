/* eslint-disable no-console */
import fs from 'fs/promises';
import path from 'path';

import { TextToSpeechClient } from '@google-cloud/text-to-speech';

import { buildMoneyReading } from '../../../client/src/features/tools/japaneseMoney/logic/moneyFormatting';
import { uploadFileToGCSPath } from '../services/storageClient.js';

const MIN_CHUNK = 1;
const MAX_CHUNK = 9999;
const DEFAULT_VOICE_ID = 'ja-JP-Neural2-C';
const DEFAULT_LANGUAGE_CODE = 'ja-JP';
const DEFAULT_GCS_ROOT = 'tools-audio';
const DEFAULT_OUT_DIR = '../client/public/tools-audio/japanese-money/google-kento-professional';

const parseArgValue = (args: string[], argName: string): string | null => {
  const prefixed = `--${argName}=`;
  const withEquals = args.find((arg) => arg.startsWith(prefixed));
  if (withEquals) {
    return withEquals.slice(prefixed.length);
  }

  const index = args.findIndex((arg) => arg === `--${argName}`);
  if (index !== -1) {
    return args[index + 1] ?? null;
  }

  return null;
};

const parseIntegerArg = (
  args: string[],
  argName: string,
  defaultValue: number,
  minimum: number,
  maximum: number
): number => {
  const rawValue = parseArgValue(args, argName);
  if (!rawValue) {
    return defaultValue;
  }

  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`--${argName} must be an integer between ${minimum} and ${maximum}`);
  }

  return parsed;
};

const ensureParentDir = async (filePath: string) => {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
};

const chunkToKana = (chunkValue: number): string => buildMoneyReading(chunkValue * 10_000).kana;

const toRelativePath = (chunkValue: number): string =>
  `money/man-chunk/${String(chunkValue).padStart(4, '0')}.mp3`;

async function main() {
  const args = process.argv.slice(2);
  const chunkStart = parseIntegerArg(args, 'chunk-start', MIN_CHUNK, MIN_CHUNK, MAX_CHUNK);
  const chunkEnd = parseIntegerArg(args, 'chunk-end', MAX_CHUNK, MIN_CHUNK, MAX_CHUNK);
  const onlyMissing = args.includes('--only-missing');
  const uploadGcs = args.includes('--upload-gcs');
  const outDir = parseArgValue(args, 'out-dir') || DEFAULT_OUT_DIR;
  const voiceId = parseArgValue(args, 'voice-id') || DEFAULT_VOICE_ID;
  const gcsRoot = (parseArgValue(args, 'gcs-root') || DEFAULT_GCS_ROOT).replace(/^\/+|\/+$/g, '');

  if (chunkStart > chunkEnd) {
    throw new Error('--chunk-start must be less than or equal to --chunk-end');
  }

  const ttsClient = new TextToSpeechClient({
    keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  });

  await fs.mkdir(outDir, { recursive: true });

  let generated = 0;
  let skipped = 0;
  let uploaded = 0;
  let failed = 0;
  const total = chunkEnd - chunkStart + 1;

  console.log(`[Money Man Chunks] Voice: ${voiceId}`);
  console.log(`[Money Man Chunks] Chunk range: ${chunkStart}..${chunkEnd}`);
  console.log(`[Money Man Chunks] Output: ${outDir}`);
  console.log(`[Money Man Chunks] Upload to GCS: ${uploadGcs ? 'yes' : 'no'}`);
  console.log(`[Money Man Chunks] Only missing: ${onlyMissing ? 'yes' : 'no'}`);

  for (let chunkValue = chunkStart; chunkValue <= chunkEnd; chunkValue += 1) {
    const relativePath = toRelativePath(chunkValue);
    const absolutePath = path.join(outDir, relativePath);
    const readingKana = chunkToKana(chunkValue);

    try {
      const localExists = await fs
        .stat(absolutePath)
        .then(() => true)
        .catch(() => false);

      if (!(onlyMissing && localExists)) {
        await ensureParentDir(absolutePath);
        const [response] = await ttsClient.synthesizeSpeech({
          input: { text: readingKana },
          voice: {
            languageCode: DEFAULT_LANGUAGE_CODE,
            name: voiceId,
          },
          audioConfig: {
            audioEncoding: 'MP3',
          },
        });

        const audioContent = response.audioContent;
        if (!audioContent) {
          throw new Error(`No audio content returned for ${relativePath}`);
        }

        const audioBuffer = Buffer.isBuffer(audioContent)
          ? audioContent
          : Buffer.from(audioContent as Uint8Array);

        await fs.writeFile(absolutePath, audioBuffer);
        generated += 1;
      } else {
        skipped += 1;
      }

      if (uploadGcs) {
        const destinationPath = `${gcsRoot}/japanese-money/google-kento-professional/${relativePath}`;
        await uploadFileToGCSPath({
          localFilePath: absolutePath,
          destinationPath,
          contentType: 'audio/mpeg',
        });
        uploaded += 1;
      }
    } catch (error) {
      failed += 1;
      const reason = error instanceof Error ? error.message : String(error);
      console.log(`[Money Man Chunks] FAIL ${relativePath} -> ${reason}`);
    }

    const processed = chunkValue - chunkStart + 1;
    if (processed % 100 === 0 || chunkValue === chunkEnd) {
      console.log(
        `[Money Man Chunks] ${processed}/${total} generated=${generated} skipped=${skipped} uploaded=${uploaded} failed=${failed}`
      );
    }
  }

  const manifest = {
    version: 1,
    generatedAt: new Date().toISOString(),
    voiceId,
    chunkRange: {
      start: chunkStart,
      end: chunkEnd,
    },
    totals: {
      totalEntries: total,
      generated,
      skipped,
      uploaded,
      failed,
    },
  };

  await fs.writeFile(
    path.join(outDir, 'money', 'man-chunk-manifest.json'),
    JSON.stringify(manifest, null, 2)
  );

  console.log('[Money Man Chunks] Complete');
  console.log(
    `[Money Man Chunks] Totals -> generated: ${generated}, skipped: ${skipped}, uploaded: ${uploaded}, failed: ${failed}, total: ${total}`
  );
}

main().catch((error) => {
  console.error('[Money Man Chunks] Fatal error:', error);
  process.exitCode = 1;
});
