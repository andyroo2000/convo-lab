import 'dotenv/config';
import sharp from 'sharp';
import fetch from 'node-fetch';
import { GoogleAuth } from 'google-auth-library';
import { uploadSpeakerAvatar } from '../src/services/avatarService.js';

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || 'convolab-mvp';
const LOCATION = 'us-central1';

// Get OAuth access token using service account
async function getAccessToken(): Promise<string> {
  const auth = new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  });
  const client = await auth.getClient();
  const accessToken = await client.getAccessToken();
  return accessToken.token || '';
}

interface AvatarConfig {
  filename: string;
  prompt: string;
}

// All 4 missing avatars
const MISSING_ARABIC_AVATARS: AvatarConfig[] = [
  {
    filename: 'ar-female-casual.jpg',
    prompt: 'Professional headshot portrait of a friendly young Gulf Arab woman in her 20s, warm smile, modern casual clothing with optional hijab, diverse features representing modern Gulf states, natural lighting, soft focus background, cheerful and relaxed expression, photorealistic, upper body shot',
  },
  {
    filename: 'ar-female-polite.jpg',
    prompt: 'Professional headshot portrait of a polite Gulf Arab woman in her late 20s, gentle smile, business casual attire with optional hijab, diverse features representing modern Gulf states, clean background, graceful and respectful demeanor, natural soft lighting, photorealistic, upper body shot',
  },
  {
    filename: 'ar-male-polite.jpg',
    prompt: 'Professional headshot portrait of a courteous Gulf Arab man in his late 20s, warm smile, smart casual attire, diverse features representing modern Gulf states, clean background, respectful and considerate expression, natural lighting, photorealistic, upper body shot',
  },
  {
    filename: 'ar-male-formal.jpg',
    prompt: 'Professional headshot portrait of a professional Gulf Arab businessman in his 30s, composed expression, formal business suit or traditional thobe, diverse features representing modern Gulf states, neutral background, distinguished and confident demeanor, studio lighting, photorealistic, upper body shot',
  },
];

async function generateImageWithImagen(prompt: string): Promise<Buffer> {
  const accessToken = await getAccessToken();
  const endpoint = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/imagen-3.0-generate-001:predict`;

  const requestBody = {
    instances: [{
      prompt: prompt,
    }],
    parameters: {
      sampleCount: 1,
      aspectRatio: '1:1',
      negativePrompt: 'blurry, low quality, distorted, cartoon, anime, illustration, painting, drawing, full body, legs, feet, multiple people, children, text, watermark',
      personGeneration: 'allow_adult',
      safetySetting: 'block_some',
    }
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
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

  const imageData = result.predictions[0].bytesBase64Encoded;
  return Buffer.from(imageData, 'base64');
}

async function generateAndUploadAvatar(config: AvatarConfig): Promise<void> {
  console.log(`\nGenerating: ${config.filename}`);
  console.log('Calling Imagen API...');

  try {
    const imageBuffer = await generateImageWithImagen(config.prompt);
    console.log(`✓ Generated image (${(imageBuffer.length / 1024).toFixed(1)}KB)`);

    const metadata = await sharp(imageBuffer).metadata();
    const width = metadata.width!;
    const height = metadata.height!;

    console.log(`  Image size: ${width}x${height}`);

    const cropHeight = Math.floor(height * 0.6);
    const cropArea = {
      x: 0,
      y: 0,
      width: width,
      height: cropHeight,
    };

    console.log('Uploading to GCS and database...');

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
  console.log('Arabic Avatar Generator - Missing 4 Avatars');
  console.log('==========================================\n');
  console.log(`Generating ${MISSING_ARABIC_AVATARS.length} missing Arabic avatars...\n`);

  let successCount = 0;
  let failCount = 0;

  for (const config of MISSING_ARABIC_AVATARS) {
    try {
      await generateAndUploadAvatar(config);
      successCount++;

      if (config !== MISSING_ARABIC_AVATARS[MISSING_ARABIC_AVATARS.length - 1]) {
        console.log('\nWaiting 5 seconds before next generation...');
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    } catch (error) {
      failCount++;
      console.error(`\nSkipping ${config.filename} due to error\n`);
    }
  }

  console.log('\n==========================================');
  console.log(`✓ Complete! Success: ${successCount}, Failed: ${failCount}`);
  console.log(`\nEstimated cost: $${(successCount * 0.02).toFixed(2)} (${successCount} images × $0.02/image)`);

  if (successCount + 2 === 6) {
    console.log('\n🎉 All 6 Arabic avatars are now complete!');
    console.log('\nYou can view them at:');
    console.log('http://localhost:5173/app/admin/avatars');
  } else {
    console.log(`\n⚠️  ${6 - (successCount + 2)} avatars still need to be generated`);
  }
}

main().catch(console.error);
