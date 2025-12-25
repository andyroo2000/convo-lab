import sharp from 'sharp';
import fetch from 'node-fetch';
import { execSync } from 'child_process';
import { uploadSpeakerAvatar } from '../src/services/avatarService.js';

const PROJECT_ID = 'gen-lang-client-0197871243';
const LOCATION = 'us-central1';

// Get OAuth access token from gcloud
async function getAccessToken(): Promise<string> {
  const token = execSync('gcloud auth application-default print-access-token').toString().trim();
  return token;
}

interface AvatarConfig {
  filename: string;
  prompt: string;
}

const SPANISH_AVATARS: AvatarConfig[] = [
  {
    filename: 'es-female-casual.jpg',
    prompt:
      'Professional headshot portrait of a friendly young Spanish woman in her 20s, warm smile, modern casual clothing, Mediterranean features, natural lighting, soft focus background, cheerful and relaxed expression, photorealistic, upper body shot',
  },
  {
    filename: 'es-female-polite.jpg',
    prompt:
      'Professional headshot portrait of a polite Spanish woman in her late 20s, gentle smile, business casual attire, Mediterranean features, clean background, graceful and respectful demeanor, natural soft lighting, photorealistic, upper body shot',
  },
  {
    filename: 'es-female-formal.jpg',
    prompt:
      'Professional headshot portrait of a professional Spanish woman in her 30s, subtle smile, formal business attire, Mediterranean features, neutral background, elegant and dignified expression, studio lighting, photorealistic, upper body shot',
  },
  {
    filename: 'es-male-casual.jpg',
    prompt:
      'Professional headshot portrait of a friendly young Spanish man in his 20s, relaxed smile, casual modern clothing, Mediterranean features, natural lighting, soft background, approachable and easygoing demeanor, photorealistic, upper body shot',
  },
  {
    filename: 'es-male-polite.jpg',
    prompt:
      'Professional headshot portrait of a courteous Spanish man in his late 20s, warm smile, smart casual attire, Mediterranean features, clean background, respectful and considerate expression, natural lighting, photorealistic, upper body shot',
  },
  {
    filename: 'es-male-formal.jpg',
    prompt:
      'Professional headshot portrait of a professional Spanish businessman in his 30s, composed expression, formal business suit, Mediterranean features, neutral background, distinguished and confident demeanor, studio lighting, photorealistic, upper body shot',
  },
];

async function generateImageWithNanoBanana(prompt: string): Promise<Buffer> {
  const accessToken = await getAccessToken();
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
        'blurry, low quality, distorted, cartoon, anime, illustration, painting, drawing, full body, legs, feet, multiple people, children, text, watermark',
      personGeneration: 'allow_adult',
      safetySetting: 'block_some',
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
    throw new Error(`Imagen API error: ${response.status} - ${errorText}`);
  }

  const result: any = await response.json();

  if (!result.predictions || result.predictions.length === 0) {
    throw new Error('No images generated');
  }

  // Get the first image (base64 encoded)
  const imageData = result.predictions[0].bytesBase64Encoded;
  return Buffer.from(imageData, 'base64');
}

async function generateAndUploadAvatar(config: AvatarConfig): Promise<void> {
  console.log(`\nGenerating: ${config.filename}`);
  console.log('Calling Imagen API...');

  try {
    // Generate the image
    const imageBuffer = await generateImageWithNanoBanana(config.prompt);
    console.log(`✓ Generated image (${(imageBuffer.length / 1024).toFixed(1)}KB)`);

    // Get image dimensions
    const metadata = await sharp(imageBuffer).metadata();
    const width = metadata.width!;
    const height = metadata.height!;

    console.log(`  Image size: ${width}x${height}`);

    // Create a centered crop area that captures the top 60% of the image
    // This typically gets the head and upper shoulders from a 1:1 portrait
    const cropHeight = Math.floor(height * 0.6);
    const cropArea = {
      x: 0,
      y: 0,
      width: width,
      height: cropHeight,
    };

    console.log('Uploading to GCS and database...');

    // Upload using the avatarService (handles cropping, GCS upload, and DB upsert)
    const result = await uploadSpeakerAvatar(config.filename, imageBuffer, cropArea);

    console.log(`✓ Uploaded successfully!`);
    console.log(`  Cropped: ${result.croppedUrl}`);
    console.log(`  Original: ${result.originalUrl}`);
  } catch (error: any) {
    console.error(`✗ Failed to generate ${config.filename}:`, error.message);
    throw error;
  }
}

async function main() {
  console.log('Spanish Speaker Avatar Generator & Uploader');
  console.log('============================================\n');
  console.log(`Generating ${SPANISH_AVATARS.length} Spanish avatars...\n`);

  let successCount = 0;
  let failCount = 0;

  for (const config of SPANISH_AVATARS) {
    try {
      await generateAndUploadAvatar(config);
      successCount++;

      // Wait between requests to avoid rate limiting
      if (config !== SPANISH_AVATARS[SPANISH_AVATARS.length - 1]) {
        console.log('\nWaiting 3 seconds before next generation...');
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    } catch (error) {
      failCount++;
      console.error(`\nSkipping ${config.filename} due to error\n`);
    }
  }

  console.log('\n============================================');
  console.log(`✓ Complete! Success: ${successCount}, Failed: ${failCount}`);
  console.log('\nYou can now view the Spanish avatars at:');
  console.log('http://localhost:5173/app/admin/avatars');
}

main().catch(console.error);
