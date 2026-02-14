/* eslint-disable no-console */
import { execFile } from 'child_process';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { promisify } from 'util';

import { Polly, SynthesizeSpeechCommand, VoiceId } from '@aws-sdk/client-polly';
import { TTS_VOICES } from '@languageflow/shared/src/constants-new.js';
import { config as loadEnv } from 'dotenv';

import {
  resolveFishAudioVoiceId,
  synthesizeFishAudioSpeech,
} from '../services/ttsProviders/FishAudioTTSProvider.js';
import { GoogleTTSProvider } from '../services/ttsProviders/GoogleTTSProvider.js';

loadEnv();

const execFileAsync = promisify(execFile);
const TARGET_TEXT = 'ごじゅうろっぷん';

type Provider = 'fishaudio' | 'google' | 'polly' | 'azure';

type VoiceRow = {
  id: string;
  description: string;
  provider: Provider;
};

type SweepResult = {
  voiceId: string;
  provider: Provider;
  description: string;
  status: 'generated' | 'skipped' | 'failed';
  outputFile?: string;
  bytes?: number;
  durationSeconds?: number;
  requestMs?: number;
  reason?: string;
};

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

function sanitizeFilePart(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70);
}

function voiceNameFromDescription(description: string): string {
  // "Fish Audio: Nakamura - Professional and measured" -> "Nakamura"
  const afterColon = description.includes(':')
    ? description.split(':').slice(1).join(':').trim()
    : description;
  return afterColon.split('-')[0].trim();
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

async function main() {
  const args = process.argv.slice(2);
  const outputArgIndex = args.indexOf('--out');
  const outputDirFromArg = outputArgIndex !== -1 ? args[outputArgIndex + 1] : undefined;

  const outDir =
    outputDirFromArg ||
    path.join(
      os.tmpdir(),
      'convolab-jp-time-voice-sweep',
      new Date().toISOString().replace(/[:.]/g, '-')
    );
  await fs.mkdir(outDir, { recursive: true });

  const voices: VoiceRow[] = TTS_VOICES.ja.voices
    .filter((voice) => ['fishaudio', 'google', 'polly', 'azure'].includes(voice.provider))
    .map((voice) => ({
      id: voice.id,
      description: voice.description,
      provider: voice.provider as Provider,
    }))
    .sort((a, b) => a.description.localeCompare(b.description));

  const azureVoices = voices.filter((voice) => voice.provider === 'azure');
  const fishVoices = voices.filter((voice) => voice.provider === 'fishaudio');
  const googleVoices = voices.filter((voice) => voice.provider === 'google');
  const pollyVoices = voices.filter((voice) => voice.provider === 'polly');

  const googleProvider = new GoogleTTSProvider();
  const results: SweepResult[] = [];

  for (const voice of [...fishVoices, ...googleVoices, ...pollyVoices, ...azureVoices]) {
    const voiceName = voiceNameFromDescription(voice.description);
    const filename = `${voice.provider}__${sanitizeFilePart(voiceName)}__${sanitizeFilePart(voice.id)}.mp3`;
    const outputPath = path.join(outDir, filename);

    if (voice.provider === 'azure') {
      results.push({
        voiceId: voice.id,
        provider: voice.provider,
        description: voice.description,
        status: 'skipped',
        reason: 'Azure TTS provider is not configured in this repository.',
      });
      console.log(
        `[Voice Sweep] SKIP ${voice.id} (${voice.description}) -> Azure provider unavailable`
      );
      continue;
    }

    try {
      const startMs = Date.now();
      let audio: Buffer;
      if (voice.provider === 'fishaudio') {
        audio = await synthesizeFishAudioSpeech({
          referenceId: resolveFishAudioVoiceId(voice.id),
          text: TARGET_TEXT,
          speed: 1.0,
        });
      } else if (voice.provider === 'google') {
        audio = await googleProvider.synthesizeSpeech({
          text: TARGET_TEXT,
          voiceId: voice.id,
          languageCode: 'ja-JP',
          speed: 1.0,
        });
      } else if (voice.provider === 'polly') {
        audio = await synthesizePollySpeech(TARGET_TEXT, voice.id);
      } else {
        throw new Error(`Unsupported provider: ${voice.provider}`);
      }

      const requestMs = Date.now() - startMs;
      await fs.writeFile(outputPath, audio);
      const durationSeconds = await getMp3DurationSeconds(outputPath);

      results.push({
        voiceId: voice.id,
        provider: voice.provider,
        description: voice.description,
        status: 'generated',
        outputFile: filename,
        bytes: audio.length,
        durationSeconds,
        requestMs,
      });

      console.log(
        `[Voice Sweep] OK ${voice.id} (${voice.description}) -> ${filename} (${durationSeconds.toFixed(2)}s)`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({
        voiceId: voice.id,
        provider: voice.provider,
        description: voice.description,
        status: 'failed',
        reason: message,
      });
      console.log(`[Voice Sweep] FAIL ${voice.id} (${voice.description}) -> ${message}`);
    }
  }

  const summary = {
    text: TARGET_TEXT,
    outputDirectory: outDir,
    totals: {
      configuredFishVoices: fishVoices.length,
      configuredGoogleVoices: googleVoices.length,
      configuredPollyVoices: pollyVoices.length,
      configuredAzureVoices: azureVoices.length,
      generated: results.filter((result) => result.status === 'generated').length,
      failed: results.filter((result) => result.status === 'failed').length,
      skipped: results.filter((result) => result.status === 'skipped').length,
    },
    results,
  };

  await fs.writeFile(path.join(outDir, 'manifest.json'), JSON.stringify(summary, null, 2));
  await fs.writeFile(
    path.join(outDir, 'README.md'),
    [
      '# Japanese Time Voice Sweep',
      '',
      `Text: ${TARGET_TEXT}`,
      '',
      `Output directory: ${outDir}`,
      '',
      `Configured Fish voices: ${fishVoices.length}`,
      `Configured Google voices: ${googleVoices.length}`,
      `Configured Polly voices: ${pollyVoices.length}`,
      `Configured Azure voices: ${azureVoices.length}`,
      '',
      '## Results',
      ...results.map((result) => {
        const base = `- [${result.status.toUpperCase()}] ${result.description} (${result.voiceId})`;
        if (result.outputFile) return `${base} -> ${result.outputFile}`;
        if (result.reason) return `${base} -> ${result.reason}`;
        return base;
      }),
    ].join('\n')
  );

  console.log('\nVoice sweep complete.');
  console.log(`Artifacts: ${outDir}`);
  console.log(
    `Generated: ${summary.totals.generated}, Failed: ${summary.totals.failed}, Skipped: ${summary.totals.skipped}`
  );
}

main().catch((error) => {
  console.error('Voice sweep failed:', error);
  process.exitCode = 1;
});
