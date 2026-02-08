/**
 * Generate voice preview audio files for all TTS voices.
 *
 * Produces one MP3 per voice in client/public/voice-previews/.
 * These are committed to the repo so previews are free at runtime.
 *
 * Usage:
 *   cd server && npx tsx scripts/generate-voice-previews.ts
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load server .env for API keys
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Import after dotenv so env vars are available
import { TTS_VOICES } from '../../shared/src/constants-new.js';
import {
  voiceIdToFilename,
  getProviderFromVoiceId,
} from '../../shared/src/voiceSelection.js';
import {
  synthesizeFishAudioSpeech,
  resolveFishAudioVoiceId,
} from '../src/services/ttsProviders/FishAudioTTSProvider.js';
import { GoogleTTSProvider } from '../src/services/ttsProviders/GoogleTTSProvider.js';
import { Polly, SynthesizeSpeechCommand, VoiceId } from '@aws-sdk/client-polly';

const SENTENCES: Record<string, string> = {
  'ja-JP': '雨が降っていて、外に出たくありませんでした。',
  'en-US': 'It was raining, and I didn\'t want to go outside.',
};

const OUTPUT_DIR = path.resolve(__dirname, '../../client/public/voice-previews');

async function synthesizeGoogle(voiceId: string, text: string, languageCode: string): Promise<Buffer> {
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
  });

  const response = await polly.send(command);
  if (!response.AudioStream) {
    throw new Error('No audio from Polly');
  }

  // Collect stream into buffer
  const chunks: Uint8Array[] = [];
  const stream = response.AudioStream as AsyncIterable<Uint8Array>;
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function synthesizeFishAudio(voiceId: string, text: string): Promise<Buffer> {
  const referenceId = resolveFishAudioVoiceId(voiceId);
  return synthesizeFishAudioSpeech({ referenceId, text, speed: 1.0 });
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const languages = Object.entries(TTS_VOICES) as [string, typeof TTS_VOICES[keyof typeof TTS_VOICES]][];
  let generated = 0;
  let skipped = 0;
  let failed = 0;

  for (const [langKey, config] of languages) {
    const languageCode = config.languageCode;
    const text = SENTENCES[languageCode];
    if (!text) {
      console.warn(`No sample sentence for ${languageCode}, skipping`);
      continue;
    }

    for (const voice of config.voices) {
      const filename = voiceIdToFilename(voice.id) + '.mp3';
      const outputPath = path.join(OUTPUT_DIR, filename);

      if (fs.existsSync(outputPath)) {
        console.log(`  SKIP ${filename} (already exists)`);
        skipped++;
        continue;
      }

      const provider = getProviderFromVoiceId(voice.id);
      console.log(`  GEN  ${filename} [${provider}] ${voice.description}`);

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
            console.warn(`    Unknown provider: ${provider}`);
            failed++;
            continue;
        }

        fs.writeFileSync(outputPath, buffer);
        console.log(`    OK (${buffer.length} bytes)`);
        generated++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`    FAIL: ${msg}`);
        failed++;
      }
    }
  }

  console.log(`\nDone: ${generated} generated, ${skipped} skipped, ${failed} failed`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
