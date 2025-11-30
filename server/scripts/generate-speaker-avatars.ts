import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || 'gen-lang-client-0197871243';
const LOCATION = 'us-central1';

// We'll use the REST API directly since the SDK's image generation is still in preview
async function getAccessToken(): Promise<string> {
  // Use gcloud to get access token
  const { execSync } = await import('child_process');
  const token = execSync('gcloud auth application-default print-access-token').toString().trim();
  return token;
}

interface AvatarConfig {
  gender: 'male' | 'female';
  tone: 'casual' | 'polite' | 'formal';
  language: 'ja' | 'zh' | 'es';
  outputFilename: string;
}

const AVATAR_PROMPTS = {
  ja: {
    female: {
      casual: 'Professional headshot portrait of a friendly young Japanese woman in her 20s, warm smile, casual modern clothing, natural lighting, soft focus background, approachable and relaxed expression, photorealistic, upper body shot',
      polite: 'Professional headshot portrait of a polite Japanese woman in her late 20s, gentle smile, business casual attire, clean background, composed and respectful demeanor, natural soft lighting, photorealistic, upper body shot',
      formal: 'Professional headshot portrait of a professional Japanese woman in her 30s, subtle smile, formal business attire, neutral background, confident and dignified expression, studio lighting, photorealistic, upper body shot',
    },
    male: {
      casual: 'Professional headshot portrait of a friendly young Japanese man in his 20s, relaxed smile, casual contemporary clothing, natural lighting, soft background, easygoing and approachable demeanor, photorealistic, upper body shot',
      polite: 'Professional headshot portrait of a courteous Japanese man in his late 20s, warm smile, smart casual attire, clean background, respectful and thoughtful expression, natural lighting, photorealistic, upper body shot',
      formal: 'Professional headshot portrait of a professional Japanese businessman in his 30s, composed expression, formal business suit, neutral background, dignified and authoritative demeanor, studio lighting, photorealistic, upper body shot',
    },
  },
  zh: {
    female: {
      casual: 'Professional headshot portrait of a friendly young Chinese woman in her 20s, bright smile, modern casual clothing, natural lighting, soft focus background, cheerful and relaxed expression, photorealistic, upper body shot',
      polite: 'Professional headshot portrait of a polite Chinese woman in her late 20s, gentle smile, business casual attire, clean background, graceful and respectful demeanor, natural soft lighting, photorealistic, upper body shot',
      formal: 'Professional headshot portrait of a professional Chinese woman in her 30s, subtle smile, formal business attire, neutral background, poised and dignified expression, studio lighting, photorealistic, upper body shot',
    },
    male: {
      casual: 'Professional headshot portrait of a friendly young Chinese man in his 20s, relaxed smile, casual modern clothing, natural lighting, soft background, laid-back and approachable demeanor, photorealistic, upper body shot',
      polite: 'Professional headshot portrait of a courteous Chinese man in his late 20s, warm smile, smart casual attire, clean background, respectful and considerate expression, natural lighting, photorealistic, upper body shot',
      formal: 'Professional headshot portrait of a professional Chinese businessman in his 30s, composed expression, formal business suit, neutral background, distinguished and authoritative demeanor, studio lighting, photorealistic, upper body shot',
    },
  },
  es: {
    female: {
      casual: 'Professional headshot portrait of a friendly young Spanish woman in her 20s, warm smile, modern casual clothing, Mediterranean features, natural lighting, soft focus background, cheerful and relaxed expression, photorealistic, upper body shot',
      polite: 'Professional headshot portrait of a polite Spanish woman in her late 20s, gentle smile, business casual attire, Mediterranean features, clean background, graceful and respectful demeanor, natural soft lighting, photorealistic, upper body shot',
      formal: 'Professional headshot portrait of a professional Spanish woman in her 30s, subtle smile, formal business attire, Mediterranean features, neutral background, elegant and dignified expression, studio lighting, photorealistic, upper body shot',
    },
    male: {
      casual: 'Professional headshot portrait of a friendly young Spanish man in his 20s, relaxed smile, casual modern clothing, Mediterranean features, natural lighting, soft background, approachable and easygoing demeanor, photorealistic, upper body shot',
      polite: 'Professional headshot portrait of a courteous Spanish man in his late 20s, warm smile, smart casual attire, Mediterranean features, clean background, respectful and considerate expression, natural lighting, photorealistic, upper body shot',
      formal: 'Professional headshot portrait of a professional Spanish businessman in his 30s, composed expression, formal business suit, Mediterranean features, neutral background, distinguished and confident demeanor, studio lighting, photorealistic, upper body shot',
    },
  },
};

async function generateAvatar(config: AvatarConfig): Promise<void> {
  const { gender, tone, language, outputFilename } = config;

  console.log(`Generating avatar: ${outputFilename} (${language} ${gender} ${tone})`);

  // Get the appropriate prompt
  const prompt = AVATAR_PROMPTS[language][gender][tone];

  try {
    console.log('Calling Imagen API...');

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

    const result = await response.json();

    if (!result.predictions || result.predictions.length === 0) {
      throw new Error('No images generated');
    }

    // Get the first image (base64 encoded)
    const imageData = result.predictions[0].bytesBase64Encoded;
    const imageBuffer = Buffer.from(imageData, 'base64');

    // Save original for reference
    const originalPath = path.join(__dirname, '../../public/avatars/original', outputFilename);
    await fs.mkdir(path.dirname(originalPath), { recursive: true });
    await fs.writeFile(originalPath, imageBuffer);
    console.log(`Saved original: ${originalPath}`);

    // Crop to headshot (top 60% of the image, centered)
    // This typically captures face and upper shoulders from a full body shot
    const image = sharp(imageBuffer);
    const metadata = await image.metadata();
    const width = metadata.width!;
    const height = metadata.height!;

    // Crop to top 60% and center horizontally
    const cropHeight = Math.floor(height * 0.6);
    const croppedImage = await image
      .extract({
        left: 0,
        top: 0,
        width: width,
        height: cropHeight,
      })
      .resize(256, 256, {
        fit: 'cover',
        position: 'top',
      })
      .jpeg({
        quality: 85,
        progressive: true,
      })
      .toBuffer();

    // Save cropped avatar
    const avatarPath = path.join(__dirname, '../../public/avatars', outputFilename);
    await fs.mkdir(path.dirname(avatarPath), { recursive: true });
    await fs.writeFile(avatarPath, croppedImage);

    const stats = await fs.stat(avatarPath);
    console.log(`✓ Generated ${outputFilename} (${(stats.size / 1024).toFixed(1)}KB)`);

  } catch (error: any) {
    console.error(`✗ Failed to generate ${outputFilename}:`, error.message);
    throw error;
  }
}

async function main() {
  console.log('Speaker Avatar Generator');
  console.log('========================\n');

  const avatars: AvatarConfig[] = [
    // Japanese avatars
    { gender: 'female', tone: 'casual', language: 'ja', outputFilename: 'ja-female-casual.jpg' },
    { gender: 'female', tone: 'polite', language: 'ja', outputFilename: 'ja-female-polite.jpg' },
    { gender: 'female', tone: 'formal', language: 'ja', outputFilename: 'ja-female-formal.jpg' },
    { gender: 'male', tone: 'casual', language: 'ja', outputFilename: 'ja-male-casual.jpg' },
    { gender: 'male', tone: 'polite', language: 'ja', outputFilename: 'ja-male-polite.jpg' },
    { gender: 'male', tone: 'formal', language: 'ja', outputFilename: 'ja-male-formal.jpg' },

    // Chinese avatars
    { gender: 'female', tone: 'casual', language: 'zh', outputFilename: 'zh-female-casual.jpg' },
    { gender: 'female', tone: 'polite', language: 'zh', outputFilename: 'zh-female-polite.jpg' },
    { gender: 'female', tone: 'formal', language: 'zh', outputFilename: 'zh-female-formal.jpg' },
    { gender: 'male', tone: 'casual', language: 'zh', outputFilename: 'zh-male-casual.jpg' },
    { gender: 'male', tone: 'polite', language: 'zh', outputFilename: 'zh-male-polite.jpg' },
    { gender: 'male', tone: 'formal', language: 'zh', outputFilename: 'zh-male-formal.jpg' },

    // Spanish avatars
    { gender: 'female', tone: 'casual', language: 'es', outputFilename: 'es-female-casual.jpg' },
    { gender: 'female', tone: 'polite', language: 'es', outputFilename: 'es-female-polite.jpg' },
    { gender: 'female', tone: 'formal', language: 'es', outputFilename: 'es-female-formal.jpg' },
    { gender: 'male', tone: 'casual', language: 'es', outputFilename: 'es-male-casual.jpg' },
    { gender: 'male', tone: 'polite', language: 'es', outputFilename: 'es-male-polite.jpg' },
    { gender: 'male', tone: 'formal', language: 'es', outputFilename: 'es-male-formal.jpg' },
  ];

  for (const config of avatars) {
    try {
      await generateAvatar(config);
      // Wait between requests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.error(`Skipping ${config.outputFilename} due to error`);
    }
  }

  console.log('\n✓ Avatar generation complete!');
  console.log(`Avatars saved to: server/public/avatars/`);
  console.log(`Originals saved to: server/public/avatars/original/`);
}

main().catch(console.error);
