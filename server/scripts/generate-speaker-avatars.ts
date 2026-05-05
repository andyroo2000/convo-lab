import '../src/env.js';

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

import { generateOpenAIImageBuffer } from '../src/services/openAIClient.js';
import { uploadFileToGCSPath } from '../src/services/storageClient.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const AVATAR_DIR = path.join(__dirname, '../public/avatars');
const ORIGINAL_DIR = path.join(AVATAR_DIR, 'original');

interface AvatarConfig {
  gender: 'male' | 'female';
  tone: 'casual' | 'polite' | 'formal';
  outputFilename: string;
  prompt: string;
}

const SHARED_PROMPT_SUFFIX = [
  'Photorealistic professional speaker avatar for a language learning app.',
  'Square head-and-shoulders portrait, one Japanese adult, direct friendly eye contact.',
  'Clean softly lit studio background, natural skin texture, modern but timeless styling.',
  'No text, no watermark, no extra people, no hands near face, no microphone, no headset.',
].join(' ');

const AVATARS: AvatarConfig[] = [
  {
    gender: 'female',
    tone: 'casual',
    outputFilename: 'ja-female-casual.jpg',
    prompt:
      'Friendly Japanese woman in her 20s, relaxed casual knit top, warm easy smile, approachable conversational energy.',
  },
  {
    gender: 'female',
    tone: 'polite',
    outputFilename: 'ja-female-polite.jpg',
    prompt:
      'Polite Japanese woman in her late 20s, smart casual blouse, gentle smile, composed and respectful presence.',
  },
  {
    gender: 'female',
    tone: 'formal',
    outputFilename: 'ja-female-formal.jpg',
    prompt:
      'Professional Japanese woman in her 30s, tailored business jacket, subtle confident smile, calm formal presence.',
  },
  {
    gender: 'male',
    tone: 'casual',
    outputFilename: 'ja-male-casual.jpg',
    prompt:
      'Friendly Japanese man in his 20s, casual contemporary shirt, relaxed smile, easygoing conversational energy.',
  },
  {
    gender: 'male',
    tone: 'polite',
    outputFilename: 'ja-male-polite.jpg',
    prompt:
      'Polite Japanese man in his late 20s, smart casual jacket, warm respectful smile, thoughtful presence.',
  },
  {
    gender: 'male',
    tone: 'formal',
    outputFilename: 'ja-male-formal.jpg',
    prompt:
      'Professional Japanese man in his 30s, dark business suit, composed confident expression, formal instructor presence.',
  },
];

async function writeAvatar(config: AvatarConfig): Promise<void> {
  const prompt = `${config.prompt} ${SHARED_PROMPT_SUFFIX}`;
  const { buffer } = await generateOpenAIImageBuffer(prompt);

  await fs.mkdir(AVATAR_DIR, { recursive: true });
  await fs.mkdir(ORIGINAL_DIR, { recursive: true });

  const originalPath = path.join(ORIGINAL_DIR, config.outputFilename);
  const avatarPath = path.join(AVATAR_DIR, config.outputFilename);

  await sharp(buffer).jpeg({ quality: 92, progressive: true }).toFile(originalPath);
  await sharp(buffer)
    .resize(256, 256, { fit: 'cover', position: 'center' })
    .jpeg({ quality: 85, progressive: true })
    .toFile(avatarPath);

  const stats = await fs.stat(avatarPath);
  if (process.env.GCS_BUCKET_NAME) {
    await uploadFileToGCSPath({
      localFilePath: avatarPath,
      destinationPath: `avatars/${config.outputFilename}`,
      contentType: 'image/jpeg',
    });
  }

  console.log(
    `Generated ${config.outputFilename} (${config.gender}, ${config.tone}, ${(stats.size / 1024).toFixed(1)}KB)`
  );
}

async function main(): Promise<void> {
  console.log('Generating speaker avatars with OpenAI');

  for (const avatar of AVATARS) {
    await writeAvatar(avatar);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
