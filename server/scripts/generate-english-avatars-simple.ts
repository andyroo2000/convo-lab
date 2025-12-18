import sharp from 'sharp';
import { uploadSpeakerAvatar } from '../src/services/avatarService.js';

// Simple colored placeholder avatars with initials
// This creates professional-looking avatars until we can generate AI ones

const AVATAR_CONFIGS = [
  { filename: 'en-female-casual.jpg', bgColor: '#FF6B9D', initial: 'E', name: 'Emily' },
  { filename: 'en-female-polite.jpg', bgColor: '#C084FC', initial: 'S', name: 'Sarah' },
  { filename: 'en-female-formal.jpg', bgColor: '#818CF8', initial: 'J', name: 'Jessica' },
  { filename: 'en-male-casual.jpg', bgColor: '#60A5FA', initial: 'M', name: 'Michael' },
  { filename: 'en-male-polite.jpg', bgColor: '#34D399', initial: 'J', name: 'James' },
  { filename: 'en-male-formal.jpg', bgColor: '#FBBF24', initial: 'R', name: 'Robert' },
];

async function createSimpleAvatar(bgColor: string, initial: string): Promise<Buffer> {
  const size = 512;
  const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${size}" height="${size}" fill="${bgColor}"/>
      <text
        x="50%"
        y="50%"
        font-family="Arial, sans-serif"
        font-size="240"
        font-weight="bold"
        fill="white"
        text-anchor="middle"
        dominant-baseline="central"
      >${initial}</text>
    </svg>
  `;

  return await sharp(Buffer.from(svg))
    .jpeg({ quality: 90 })
    .toBuffer();
}

async function generateAndUploadAvatar(config: typeof AVATAR_CONFIGS[0]): Promise<void> {
  console.log(`\nGenerating: ${config.filename} (${config.name})`);

  try {
    // Create simple avatar
    const imageBuffer = await createSimpleAvatar(config.bgColor, config.initial);
    console.log(`✓ Generated placeholder (${(imageBuffer.length / 1024).toFixed(1)}KB)`);

    // Get image dimensions
    const metadata = await sharp(imageBuffer).metadata();
    const width = metadata.width!;
    const height = metadata.height!;

    // Create a centered crop area that captures the top 60% of the image
    const cropHeight = Math.floor(height * 0.6);
    const cropArea = {
      x: 0,
      y: 0,
      width: width,
      height: cropHeight,
    };

    console.log('Uploading to GCS and database...');

    // Upload using the avatarService
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
  console.log('English Speaker Avatar Generator (Simple Placeholders)');
  console.log('====================================================\n');
  console.log('Generating 6 English placeholder avatars...\n');
  console.log('Note: These are temporary placeholders. You can replace them with');
  console.log('AI-generated photos later using the generate-english-avatars.ts script.\n');

  let successCount = 0;
  let failCount = 0;

  for (const config of AVATAR_CONFIGS) {
    try {
      await generateAndUploadAvatar(config);
      successCount++;

      // Wait between uploads
      if (config !== AVATAR_CONFIGS[AVATAR_CONFIGS.length - 1]) {
        console.log('\nWaiting 1 second before next generation...');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      failCount++;
      console.error(`\nSkipping ${config.filename} due to error\n`);
    }
  }

  console.log('\n====================================================');
  console.log(`✓ Complete! Success: ${successCount}, Failed: ${failCount}`);
  console.log('\nYou can view the avatars at:');
  console.log('http://localhost:5173/app/admin/avatars');
}

main().catch(console.error);
