import '../src/env.js';

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

import { generateOpenAIImageBuffer } from '../src/services/openAIClient.js';
import { uploadFileToGCSPath } from '../src/services/storageClient.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const AVATAR_DIR = path.join(__dirname, '../public/avatars/voices');
const ORIGINAL_DIR = path.join(__dirname, '../public/avatars/original/voices');

interface VoiceAvatarConfig {
  outputFilename: string;
  prompt: string;
}

const SHARED_PROMPT_SUFFIX = [
  'Photorealistic professional speaker avatar for a language learning app.',
  'Square head-and-shoulders portrait of one Japanese adult, centered face, direct eye contact.',
  'Clean softly lit studio background, natural skin texture, realistic everyday styling.',
  'No text, no watermark, no extra people, no hands near face, no microphone, no headset.',
].join(' ');

const VOICE_AVATARS: VoiceAvatarConfig[] = [
  {
    outputFilename: 'ja-nakamura.jpg',
    prompt:
      'Skinny Japanese hipster man in his late 20s with long dark hair, cool reserved expression, plain black t-shirt, understated artsy style.',
  },
  {
    outputFilename: 'ja-sato.jpg',
    prompt:
      'Older Japanese izakaya owner in his late 50s with short grey hair, a little heavy but not fat, warm practical expression, casual restaurant work shirt.',
  },
  {
    outputFilename: 'ja-ren.jpg',
    prompt:
      'Young Japanese tough guy in his 20s, skinny and wiry build, assertive expression, short slightly messy hair, simple dark streetwear.',
  },
  {
    outputFilename: 'ja-otani.jpg',
    prompt:
      'Skinny young Japanese bookish hipster man, black glasses, soft sweater, thoughtful slightly shy expression, literary cafe style.',
  },
  {
    outputFilename: 'ja-rina.jpg',
    prompt:
      'Cool stern young Japanese woman in her late 20s, not impressed expression, sharp modern styling, minimal dark top, composed and stylish.',
  },
  {
    outputFilename: 'ja-yu.jpg',
    prompt:
      'Japanese woman politician in her 30s wearing a tailored suit, poised event-speaker expression, confident and formal public presence.',
  },
  {
    outputFilename: 'ja-hana.jpg',
    prompt:
      'Quiet girly Japanese woman in her 20s with cute soft style, pink blouse with delicate lace details, gentle reserved expression.',
  },
  {
    outputFilename: 'ja-mika.jpg',
    prompt:
      'College-aged Japanese woman, casual campus style, natural youthful expression, simple cardigan over a light top, friendly but not childish.',
  },
  {
    outputFilename: 'ja-yumi.jpg',
    prompt:
      'Young Japanese mother living in Tokyo, late 20s to early 30s, relaxed modern casual outfit, kind grounded expression, city-parent style.',
  },
  {
    outputFilename: 'ja-nanami.jpg',
    prompt:
      'Japanese female news announcer in her 30s, polished blazer, calm professional expression, broadcast studio headshot energy.',
  },
  {
    outputFilename: 'ja-shohei.jpg',
    prompt:
      'Young Japanese male TV announcer in his late 20s, neat hair, tailored jacket, bright professional expression, television presenter style.',
  },
  {
    outputFilename: 'ja-naoki.jpg',
    prompt:
      'Middle-aged Japanese male TV announcer with a deep-voice presence, a little heavy but not fat, neat suit, confident mature expression.',
  },
  {
    outputFilename: 'ja-takumi.jpg',
    prompt:
      'Young Japanese male TV announcer, clean-cut hair, smart jacket, energetic polished expression, morning television presenter style.',
  },
  {
    outputFilename: 'ja-kazuha.jpg',
    prompt:
      'Young Japanese female radio announcer with a slightly kawaii style, warm bright expression, tasteful blouse, approachable broadcaster presence.',
  },
  {
    outputFilename: 'ja-tomoko.jpg',
    prompt:
      'Middle-aged Japanese female announcer for a local TV station, professional blouse and jacket, composed friendly expression, regional broadcaster style.',
  },
];

async function writeAvatar(config: VoiceAvatarConfig): Promise<void> {
  const prompt = `${config.prompt} ${SHARED_PROMPT_SUFFIX}`;
  const { buffer } = await generateOpenAIImageBuffer(prompt);

  await fs.mkdir(AVATAR_DIR, { recursive: true });
  await fs.mkdir(ORIGINAL_DIR, { recursive: true });

  const originalPath = path.join(ORIGINAL_DIR, config.outputFilename);
  const avatarPath = path.join(AVATAR_DIR, config.outputFilename);

  await sharp(buffer).jpeg({ quality: 92, progressive: true }).toFile(originalPath);
  await sharp(buffer)
    .resize(256, 256, { fit: 'cover', position: 'center' })
    .jpeg({ quality: 86, progressive: true })
    .toFile(avatarPath);

  const stats = await fs.stat(avatarPath);
  if (process.env.GCS_BUCKET_NAME) {
    await uploadFileToGCSPath({
      localFilePath: avatarPath,
      destinationPath: `avatars/voices/${config.outputFilename}`,
      contentType: 'image/jpeg',
    });
  }

  console.log(`Generated ${config.outputFilename} (${(stats.size / 1024).toFixed(1)}KB)`);
}

async function main(): Promise<void> {
  console.log('Generating per-voice Japanese avatars with OpenAI');

  for (const avatar of VOICE_AVATARS) {
    await writeAvatar(avatar);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
