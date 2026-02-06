import sharp from 'sharp';
import fetch from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';

interface AvatarConfig {
  filename: string;
  prompt: string;
}

type VertexPrediction = {
  bytesBase64Encoded: string;
};

type VertexResponse = {
  predictions?: VertexPrediction[];
};

// Only the remaining avatars that failed due to quota
const REMAINING_AVATARS: AvatarConfig[] = [
  {
    filename: 'en-female-formal.jpg',
    prompt:
      'Professional headshot portrait of a professional American woman in her 30s, subtle smile, formal business attire, diverse ethnicity, neutral background, elegant and dignified expression, studio lighting, photorealistic, upper body shot, executive style',
  },
  {
    filename: 'en-male-casual.jpg',
    prompt:
      'Professional headshot portrait of a friendly young American man in his 20s, relaxed smile, casual modern clothing, diverse ethnicity, natural lighting, soft background, approachable and easygoing demeanor, photorealistic, upper body shot, studio quality',
  },
  {
    filename: 'en-male-polite.jpg',
    prompt:
      'Professional headshot portrait of a courteous American man in his late 20s, warm smile, smart casual attire, diverse ethnicity, clean background, respectful and considerate expression, natural lighting, photorealistic, upper body shot, studio quality',
  },
  {
    filename: 'en-male-formal.jpg',
    prompt:
      'Professional headshot portrait of a professional American businessman in his 30s, composed expression, formal business suit, diverse ethnicity, neutral background, distinguished and confident demeanor, studio lighting, photorealistic, upper body shot, executive style',
  },
];

async function getAccessToken(): Promise<string> {
  try {
    const token = execSync('gcloud auth application-default print-access-token', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
    }).trim();
    return token;
  } catch (error) {
    throw new Error('Failed to get access token');
  }
}

async function generateImageWithVertexAI(prompt: string, accessToken: string): Promise<Buffer> {
  const PROJECT_ID = 'convolab-mvp';
  const LOCATION = 'us-central1';

  const endpoint = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/imagen-3.0-generate-001:predict`;

  const requestBody = {
    instances: [
      {
        prompt: prompt,
      },
    ],
    parameters: {
      sampleCount: 1,
      aspectRatio: '1:1',
      negativePrompt:
        'blurry, low quality, distorted, cartoon, anime, illustration, painting, drawing, full body, legs, feet, multiple people, children, text, watermark, logo, hands',
      personGeneration: 'allow_adult',
    },
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Vertex AI API error: ${response.status} - ${errorText}`);
  }

  const result = (await response.json()) as VertexResponse;
  const [prediction] = result.predictions ?? [];

  if (!prediction?.bytesBase64Encoded) {
    throw new Error('No images generated');
  }

  const imageData = prediction.bytesBase64Encoded;
  return Buffer.from(imageData, 'base64');
}

async function generateAndSaveAvatar(config: AvatarConfig, accessToken: string): Promise<void> {
  console.log(`\nGenerating: ${config.filename}`);

  try {
    const imageBuffer = await generateImageWithVertexAI(config.prompt, accessToken);
    console.log(`✓ Generated image (${(imageBuffer.length / 1024).toFixed(1)}KB)`);

    const metadata = await sharp(imageBuffer).metadata();
    const width = metadata.width!;
    const height = metadata.height!;

    console.log(`  Image size: ${width}x${height}`);

    const cropHeight = Math.floor(height * 0.6);
    const croppedBuffer = await sharp(imageBuffer)
      .extract({
        left: 0,
        top: 0,
        width: width,
        height: cropHeight,
      })
      .jpeg({ quality: 90 })
      .toBuffer();

    const avatarDir = path.join(process.cwd(), 'public', 'avatars');
    await fs.mkdir(avatarDir, { recursive: true });

    const filePath = path.join(avatarDir, config.filename);
    await fs.writeFile(filePath, croppedBuffer);

    console.log(`✓ Saved to: ${filePath}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`✗ Failed to generate ${config.filename}:`, message);
    throw error;
  }
}

async function main() {
  console.log('Generating Remaining English Avatars');
  console.log('====================================\n');
  console.log('Waiting 60 seconds for quota to reset...');
  await new Promise((resolve) => setTimeout(resolve, 60000));

  console.log('Getting access token...');
  const accessToken = await getAccessToken();
  console.log('✓ Access token obtained\n');

  console.log(`Generating ${REMAINING_AVATARS.length} remaining avatars...\n`);

  let successCount = 0;
  let failCount = 0;

  for (const config of REMAINING_AVATARS) {
    try {
      await generateAndSaveAvatar(config, accessToken);
      successCount++;

      if (config !== REMAINING_AVATARS[REMAINING_AVATARS.length - 1]) {
        console.log('\nWaiting 10 seconds before next generation...');
        await new Promise((resolve) => setTimeout(resolve, 10000));
      }
    } catch (error) {
      failCount++;
      console.error(`\nSkipping ${config.filename} due to error\n`);
    }
  }

  console.log('\n====================================');
  console.log(`✓ Complete! Success: ${successCount}, Failed: ${failCount}`);
}

main().catch(console.error);
