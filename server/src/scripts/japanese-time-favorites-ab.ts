/* eslint-disable no-console */
import { execFile } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { promisify } from 'util';

import { Polly, SynthesizeSpeechCommand, VoiceId } from '@aws-sdk/client-polly';
import { TTS_VOICES } from '@languageflow/shared/src/constants-new.js';
import { config as loadEnv } from 'dotenv';

import { generateJapaneseDateTimeReading } from '../../../client/src/features/tools/japaneseDate/logic/readingEngine';
import {
  resolveFishAudioVoiceId,
  synthesizeFishAudioSpeech,
} from '../services/ttsProviders/FishAudioTTSProvider.js';
import { GoogleTTSProvider } from '../services/ttsProviders/GoogleTTSProvider.js';

loadEnv();

const execFileAsync = promisify(execFile);

type Provider = 'fishaudio' | 'google' | 'polly' | 'azure';

type ResolvedFavoriteVoice = {
  file: string;
  provider: Provider;
  voiceId: string;
  displayName: string;
};

type ABResult = {
  voiceId: string;
  displayName: string;
  provider: Provider;
  stitchedFile?: string;
  singleFile?: string;
  status: 'generated' | 'skipped' | 'failed';
  reason?: string;
  stitchedDurationSeconds?: number;
  singleDurationSeconds?: number;
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

function toTwoDigits(value: number): string {
  return String(value).padStart(2, '0');
}

function parseTimeInput(value: string | undefined): {
  hour: number;
  minute: number;
  label: string;
} {
  const raw = value || '09:44';
  const [hourText, minuteText] = raw.split(':');
  const hour = Number.parseInt(hourText, 10);
  const minute = Number.parseInt(minuteText, 10);
  if (
    Number.isNaN(hour) ||
    Number.isNaN(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    throw new Error(`Invalid --time value: ${raw}. Expected HH:mm (24h).`);
  }
  return { hour, minute, label: `${toTwoDigits(hour)}-${toTwoDigits(minute)}` };
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

async function stitchTwoMp3(first: string, second: string, output: string): Promise<void> {
  await execFileAsync('ffmpeg', [
    '-y',
    '-i',
    first,
    '-i',
    second,
    '-filter_complex',
    '[0:a][1:a]concat=n=2:v=0:a=1[a]',
    '-map',
    '[a]',
    '-ar',
    '44100',
    '-ac',
    '2',
    '-c:a',
    'libmp3lame',
    '-b:a',
    '128k',
    output,
  ]);
}

function getJapaneseVoicesBySanitizedId() {
  const voices = TTS_VOICES.ja.voices as ReadonlyArray<{
    id: string;
    description: string;
    provider?: Provider;
  }>;

  const map = new Map<string, { id: string; description: string; provider: Provider }>();
  for (const voice of voices) {
    const provider = voice.provider || 'google';
    map.set(sanitizeFilePart(voice.id), { id: voice.id, description: voice.description, provider });
  }
  return map;
}

function parseFavoriteVoice(filePath: string): {
  provider: Provider;
  displayNameFromFile: string;
  idToken: string;
} | null {
  const base = path.basename(filePath, path.extname(filePath));
  const [providerRaw, displayRaw, idTokenRaw] = base.split('__');
  if (!providerRaw || !displayRaw || !idTokenRaw) return null;

  const provider = providerRaw as Provider;
  if (!['fishaudio', 'google', 'polly', 'azure'].includes(provider)) return null;

  return {
    provider,
    displayNameFromFile: displayRaw,
    idToken: idTokenRaw,
  };
}

function resolveFavoriteVoices(files: string[]): ResolvedFavoriteVoice[] {
  const voiceMap = getJapaneseVoicesBySanitizedId();
  const resolved: ResolvedFavoriteVoice[] = [];

  for (const file of files) {
    const parsed = parseFavoriteVoice(file);
    if (!parsed) continue;

    const mapped = voiceMap.get(parsed.idToken);
    if (mapped) {
      resolved.push({
        file: path.basename(file),
        provider: mapped.provider,
        voiceId: mapped.id,
        displayName: mapped.description,
      });
      continue;
    }

    // Fallback for fish IDs in pre-sanitized form: fishaudio-<uuid>
    if (parsed.provider === 'fishaudio' && parsed.idToken.startsWith('fishaudio-')) {
      resolved.push({
        file: path.basename(file),
        provider: 'fishaudio',
        voiceId: `fishaudio:${parsed.idToken.slice('fishaudio-'.length)}`,
        displayName: parsed.displayNameFromFile.replace(/-/g, ' '),
      });
      continue;
    }

    // Fallback for Google/Polly raw token matches
    if (parsed.provider === 'google') {
      resolved.push({
        file: path.basename(file),
        provider: 'google',
        voiceId: parsed.idToken,
        displayName: parsed.displayNameFromFile.replace(/-/g, ' '),
      });
      continue;
    }
    if (parsed.provider === 'polly') {
      resolved.push({
        file: path.basename(file),
        provider: 'polly',
        voiceId: parsed.idToken,
        displayName: parsed.displayNameFromFile.replace(/-/g, ' '),
      });
    }
  }

  const deduped = new Map<string, ResolvedFavoriteVoice>();
  for (const item of resolved) {
    deduped.set(`${item.provider}|${item.voiceId}`, item);
  }
  return Array.from(deduped.values()).sort((a, b) => a.displayName.localeCompare(b.displayName));
}

async function synthesizeForVoice(
  provider: Provider,
  voiceId: string,
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
      languageCode: 'ja-JP',
      speed: 1.0,
    });
  }

  if (provider === 'polly') {
    return synthesizePollySpeech(text, voiceId);
  }

  throw new Error('Azure provider is not wired in this repository.');
}

async function main() {
  const args = process.argv.slice(2);
  const favoritesDir =
    parseArgValue(args, 'favorites-dir') || '/Users/andrewlandry/Desktop/favorite-voices';
  const timeInput = parseTimeInput(parseArgValue(args, 'time'));

  const date = new Date(2026, 1, 13, timeInput.hour, timeInput.minute, 0, 0);
  const reading = generateJapaneseDateTimeReading(date, { hourFormat: '12h' });
  const partOne = `${reading.parts.periodKana || ''} ${reading.parts.hourKana}`.trim(); // AM/PM + hour
  const partTwo = reading.parts.minuteKana; // minute
  const singleCall = `${partOne} ${partTwo}`.trim();

  const files = (await fs.readdir(favoritesDir))
    .filter((file) => file.toLowerCase().endsWith('.mp3'))
    .map((file) => path.join(favoritesDir, file));
  if (files.length === 0) {
    throw new Error(`No .mp3 files found in favorites dir: ${favoritesDir}`);
  }

  const voices = resolveFavoriteVoices(files);
  if (voices.length === 0) {
    throw new Error(
      `Could not resolve voices from files in ${favoritesDir}. Expected names like provider__name__voiceid.mp3`
    );
  }

  const outDir = path.join(
    favoritesDir,
    `ab-test-${timeInput.label}-${new Date().toISOString().replace(/[:.]/g, '-')}`
  );
  await fs.mkdir(outDir, { recursive: true });

  const results: ABResult[] = [];

  for (const [index, voice] of voices.entries()) {
    const order = String(index + 1).padStart(2, '0');
    const voiceSlug = sanitizeFilePart(voice.displayName || voice.voiceId) || `voice-${order}`;

    const partOneFile = path.join(outDir, `${order}__${voiceSlug}__part1_ampm-hour.mp3`);
    const partTwoFile = path.join(outDir, `${order}__${voiceSlug}__part2_minute.mp3`);
    const stitchedFile = `${order}__${voiceSlug}__A_stitched.mp3`;
    const singleFile = `${order}__${voiceSlug}__B_single.mp3`;
    const stitchedPath = path.join(outDir, stitchedFile);
    const singlePath = path.join(outDir, singleFile);

    try {
      const partOneBuffer = await synthesizeForVoice(voice.provider, voice.voiceId, partOne);
      await fs.writeFile(partOneFile, partOneBuffer);

      const partTwoBuffer = await synthesizeForVoice(voice.provider, voice.voiceId, partTwo);
      await fs.writeFile(partTwoFile, partTwoBuffer);

      await stitchTwoMp3(partOneFile, partTwoFile, stitchedPath);

      const singleBuffer = await synthesizeForVoice(voice.provider, voice.voiceId, singleCall);
      await fs.writeFile(singlePath, singleBuffer);

      const stitchedDurationSeconds = await getMp3DurationSeconds(stitchedPath);
      const singleDurationSeconds = await getMp3DurationSeconds(singlePath);

      results.push({
        voiceId: voice.voiceId,
        displayName: voice.displayName,
        provider: voice.provider,
        status: 'generated',
        stitchedFile,
        singleFile,
        stitchedDurationSeconds,
        singleDurationSeconds,
      });

      console.log(
        `[A/B] OK ${voice.displayName} (${voice.voiceId}) -> ${stitchedFile} / ${singleFile}`
      );
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      results.push({
        voiceId: voice.voiceId,
        displayName: voice.displayName,
        provider: voice.provider,
        status: 'failed',
        reason,
      });
      console.log(`[A/B] FAIL ${voice.displayName} (${voice.voiceId}) -> ${reason}`);
    }
  }

  const manifest = {
    favoritesDir,
    outputDir: outDir,
    testTime: `${toTwoDigits(timeInput.hour)}:${toTwoDigits(timeInput.minute)}`,
    japaneseTexts: {
      partOneAmpmHour: partOne,
      partTwoMinute: partTwo,
      singleCall,
    },
    totals: {
      voicesDetected: voices.length,
      generated: results.filter((result) => result.status === 'generated').length,
      failed: results.filter((result) => result.status === 'failed').length,
      skipped: results.filter((result) => result.status === 'skipped').length,
    },
    results,
  };

  await fs.writeFile(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  await fs.writeFile(
    path.join(outDir, 'README.md'),
    [
      '# Japanese Time Favorites A/B Test',
      '',
      `Favorites directory: ${favoritesDir}`,
      `Output directory: ${outDir}`,
      '',
      `Test time: ${toTwoDigits(timeInput.hour)}:${toTwoDigits(timeInput.minute)}`,
      `Part 1 (AM/PM + hour): ${partOne}`,
      `Part 2 (minute): ${partTwo}`,
      `Single-call text: ${singleCall}`,
      '',
      'Files are named with matching prefixes so Finder sorts A/B pairs together:',
      '- `NN__voice__A_stitched.mp3`',
      '- `NN__voice__B_single.mp3`',
      '',
      `Generated: ${manifest.totals.generated}`,
      `Failed: ${manifest.totals.failed}`,
    ].join('\n')
  );

  console.log('\nFavorites A/B time test complete.');
  console.log(`Artifacts: ${outDir}`);
}

main().catch((error) => {
  console.error('Favorites A/B time test failed:', error);
  process.exitCode = 1;
});
