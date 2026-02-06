import sharp from 'sharp';
import fetch from 'node-fetch';
import { uploadSpeakerAvatar } from '../src/services/avatarService.js';

// Nano Banana API key for Google AI Studio
const NANOBANANA_API_KEY = 'REMOVED_GEMINI_KEY';

interface AvatarConfig {
  filename: string;
  prompt: string;
}

type GoogleAiPrediction = {
  bytesBase64Encoded: string;
};

type GoogleAiResponse = {
  predictions?: GoogleAiPrediction[];
};

const ENGLISH_AVATARS: AvatarConfig[] = [
  {
    filename: 'en-female-casual.jpg',
    prompt:
      'Professional headshot portrait of a friendly young American woman in her 20s, warm smile, modern casual clothing, diverse ethnicity, natural lighting, soft focus background, cheerful and relaxed expression, photorealistic, upper body shot',
  },
  {
    filename: 'en-female-polite.jpg',
    prompt:
      'Professional headshot portrait of a polite American woman in her late 20s, gentle smile, business casual attire, diverse ethnicity, clean background, graceful and respectful demeanor, natural soft lighting, photorealistic, upper body shot',
  },
  {
    filename: 'en-female-formal.jpg',
    prompt:
      'Professional headshot portrait of a professional American woman in her 30s, subtle smile, formal business attire, diverse ethnicity, neutral background, elegant and dignified expression, studio lighting, photorealistic, upper body shot',
  },
  {
    filename: 'en-male-casual.jpg',
    prompt:
      'Professional headshot portrait of a friendly young American man in his 20s, relaxed smile, casual modern clothing, diverse ethnicity, natural lighting, soft background, approachable and easygoing demeanor, photorealistic, upper body shot',
  },
  {
    filename: 'en-male-polite.jpg',
    prompt:
      'Professional headshot portrait of a courteous American man in his late 20s, warm smile, smart casual attire, diverse ethnicity, clean background, respectful and considerate expression, natural lighting, photorealistic, upper body shot',
  },
  {
    filename: 'en-male-formal.jpg',
    prompt:
      'Professional headshot portrait of a professional American businessman in his 30s, composed expression, formal business suit, diverse ethnicity, neutral background, distinguished and confident demeanor, studio lighting, photorealistic, upper body shot',
  },
];

async function generateImageWithGoogleAI(prompt: string): Promise<Buffer> {
  // Try Google AI Imagen 2 API
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:predict?key=${NANOBANANA_API_KEY}`;

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
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google AI API error: ${response.status} - ${errorText}`);
  }

  const result = (await response.json()) as GoogleAiResponse;
  const [prediction] = result.predictions ?? [];

  if (!prediction?.bytesBase64Encoded) {
    throw new Error('No images generated');
  }

  // Get the first image (base64 encoded)
  const imageData = prediction.bytesBase64Encoded;
  return Buffer.from(imageData, 'base64');
}

async function generateAndUploadAvatar(config: AvatarConfig): Promise<void> {
  console.log(`\nGenerating: ${config.filename}`);
  console.log('Calling Google AI API...');

  try {
    // Generate the image
    const imageBuffer = await generateImageWithGoogleAI(config.prompt);
    console.log(`✓ Generated image (${(imageBuffer.length / 1024).toFixed(1)}KB)`);

    // Get image dimensions
    const metadata = await sharp(imageBuffer).metadata();
    const width = metadata.width!;
    const height = metadata.height!;

    console.log(`  Image size: ${width}x${height}`);

    // Create a centered crop area that captures the top 60% of the image
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
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`✗ Failed to generate ${config.filename}:`, message);
    throw error;
  }
}

async function main() {
  console.log('English Speaker Avatar Generator & Uploader');
  console.log('============================================\n');
  console.log(`Generating ${ENGLISH_AVATARS.length} English avatars using Google AI...\n`);

  let successCount = 0;
  let failCount = 0;

  for (const config of ENGLISH_AVATARS) {
    try {
      await generateAndUploadAvatar(config);
      successCount++;

      // Wait between requests to avoid rate limiting
      if (config !== ENGLISH_AVATARS[ENGLISH_AVATARS.length - 1]) {
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
  console.log('\nYou can now view the English avatars at:');
  console.log('http://localhost:5173/app/admin/avatars');
}

main().catch(console.error);
