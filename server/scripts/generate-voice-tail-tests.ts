/**
 * Generate short tail-test clips for all configured voices and upload to GCS.
 *
 * Each clip is a single word intended to expose end-of-word cutoffs.
 * Fish Audio clips append "(break)" and set normalize=false so the pause is preserved.
 *
 * Usage:
 *   cd server && npx tsx scripts/generate-voice-tail-tests.ts
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load server .env for API keys
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Dynamic imports so dotenv has already populated env vars (storageClient reads env at import time)
const { TTS_VOICES } = await import('../../shared/src/constants-new.js');
const { getProviderFromVoiceId, voiceIdToFilename } = await import(
  '../../shared/src/voiceSelection.js'
);
const { resolveFishAudioVoiceId } = await import('../src/services/ttsProviders/FishAudioTTSProvider.js');
const { GoogleTTSProvider } = await import('../src/services/ttsProviders/GoogleTTSProvider.js');
const { uploadFileToGCS } = await import('../src/services/storageClient.js');
const { Polly, SynthesizeSpeechCommand, VoiceId } = await import('@aws-sdk/client-polly');
const { FishAudioClient } = await import('fish-audio');

const FISH_AUDIO_TRAILING_BREAK = '(break)';
const FISH_AUDIO_BACKEND = process.env.FISH_AUDIO_BACKEND || 'speech-1.6';
const PROVIDER_FILTER = process.env.VOICE_PROVIDER_FILTER?.toLowerCase();
const SAMPLE_WORDS: Record<string, string> = {
  'en-US': 'stop',
  'ja-JP': 'ほん',
};

const OUTPUT_ROOT = path.resolve(__dirname, '../../tmp/voice-tail-tests');

type PreviewResult = {
  languageCode: string;
  voiceId: string;
  provider: string;
  description: string;
  text: string;
  localPath: string;
  url?: string;
  uploadError?: string;
  error?: string;
};

function getRunDir(): string {
  const now = new Date();
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    '-',
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
  ].join('');
  return path.join(OUTPUT_ROOT, stamp);
}

async function synthesizeGoogle(
  voiceId: string,
  text: string,
  languageCode: string
): Promise<Buffer> {
  const provider = new GoogleTTSProvider();
  return provider.synthesizeSpeech({ text, voiceId, languageCode });
}

async function synthesizePolly(voiceId: string, text: string): Promise<Buffer> {
  const awsAccessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const awsSecretKey = process.env.AWS_SECRET_ACCESS_KEY;

  if (!awsAccessKeyId || !awsSecretKey) {
    throw new Error('AWS credentials not configured (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY)');
  }

  const polly = new Polly({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
      accessKeyId: awsAccessKeyId,
      secretAccessKey: awsSecretKey,
    },
  });

  const command = new SynthesizeSpeechCommand({
    Text: text,
    OutputFormat: 'mp3',
    VoiceId: voiceId as VoiceId,
    Engine: 'neural',
    TextType: 'text',
  });

  const response = await polly.send(command);
  if (!response.AudioStream) {
    throw new Error('No audio from Polly');
  }

  const chunks: Uint8Array[] = [];
  const stream = response.AudioStream as AsyncIterable<Uint8Array>;
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function synthesizeFishAudio(voiceId: string, text: string): Promise<Buffer> {
  const apiKey = process.env.FISH_AUDIO_API_KEY;
  if (!apiKey) {
    throw new Error('Missing FISH_AUDIO_API_KEY environment variable');
  }

  const client = new FishAudioClient({ apiKey });
  const referenceId = resolveFishAudioVoiceId(voiceId);
  const audio = await client.textToSpeech.convert(
    {
      text,
      reference_id: referenceId,
      format: 'mp3',
      mp3_bitrate: 128,
      sample_rate: 44100,
      prosody: { speed: 1.0, volume: 0 },
      normalize: false,
    },
    FISH_AUDIO_BACKEND
  );

  const chunks: Uint8Array[] = [];
  const reader = audio.getReader();
  let done = false;
  while (!done) {
    const result = await reader.read();
    done = result.done;
    if (done) break;
    chunks.push(result.value);
  }
  return Buffer.concat(chunks);
}

async function main() {
  const runDir = getRunDir();
  fs.mkdirSync(runDir, { recursive: true });
  console.log(`Fish Audio backend: ${FISH_AUDIO_BACKEND}`);
  if (PROVIDER_FILTER) {
    console.log(`Provider filter: ${PROVIDER_FILTER}`);
  }

  const languages = Object.entries(TTS_VOICES) as [
    string,
    typeof TTS_VOICES[keyof typeof TTS_VOICES],
  ][];

  const results: PreviewResult[] = [];
  const canUpload = Boolean(process.env.GCS_BUCKET_NAME);
  if (!canUpload) {
    console.warn('GCS_BUCKET_NAME not set; uploads will be skipped.');
  }

  for (const [langKey, config] of languages) {
    const languageCode = config.languageCode;
    const word = SAMPLE_WORDS[languageCode];
    if (!word) {
      console.warn(`No sample word for ${languageCode} (${langKey}), skipping`);
      continue;
    }

    for (const voice of config.voices) {
      const provider = getProviderFromVoiceId(voice.id);
      if (PROVIDER_FILTER && provider !== PROVIDER_FILTER) {
        continue;
      }
      const filename = `${voiceIdToFilename(voice.id)}-tail-test.mp3`;
      const outputPath = path.join(runDir, filename);

      const text =
        provider === 'fishaudio' ? `${word} ${FISH_AUDIO_TRAILING_BREAK}` : word;

      console.log(`GEN ${filename} [${provider}] ${voice.description}`);

      const result: PreviewResult = {
        languageCode,
        voiceId: voice.id,
        provider,
        description: voice.description,
        text,
        localPath: outputPath,
      };

      try {
        let buffer: Buffer;

        switch (provider) {
          case 'fishaudio':
            buffer = await synthesizeFishAudio(voice.id, text);
            break;
          case 'google':
            buffer = await synthesizeGoogle(voice.id, text, languageCode);
            break;
          case 'polly':
            buffer = await synthesizePolly(voice.id, text);
            break;
          default:
            throw new Error(`Unknown provider: ${provider}`);
        }

        fs.writeFileSync(outputPath, buffer);

        if (canUpload) {
          try {
            const url = await uploadFileToGCS({
              filePath: outputPath,
              filename,
              contentType: 'audio/mpeg',
              folder: 'voice-tail-tests',
            });
            result.url = url;
          } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            result.uploadError = `Upload failed: ${msg}`;
          }
        } else {
          result.uploadError = 'Upload skipped (missing GCS_BUCKET_NAME)';
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        result.error = msg;
      }

      results.push(result);
    }
  }

  const summaryPath = path.join(runDir, 'summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify(results, null, 2));

  console.log(`\nSummary written to ${summaryPath}`);
  console.log(`Generated ${results.length} previews in ${runDir}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
