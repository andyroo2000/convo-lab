import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import { uploadSpeakerAvatar } from '../src/services/avatarService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const AVATARS_DIR = path.join(__dirname, '../../public/avatars');

const SPANISH_AVATAR_FILENAMES = [
  'es-female-casual.jpg',
  'es-female-polite.jpg',
  'es-female-formal.jpg',
  'es-male-casual.jpg',
  'es-male-polite.jpg',
  'es-male-formal.jpg',
];

async function uploadLocalAvatar(filename: string): Promise<void> {
  const filePath = path.join(AVATARS_DIR, filename);

  console.log(`\nProcessing: ${filename}`);

  try {
    // Check if file exists
    await fs.access(filePath);

    // Read the image
    const imageBuffer = await fs.readFile(filePath);
    console.log(`  Read file (${(imageBuffer.length / 1024).toFixed(1)}KB)`);

    // Get image dimensions
    const metadata = await sharp(imageBuffer).metadata();
    const width = metadata.width!;
    const height = metadata.height!;

    console.log(`  Image size: ${width}x${height}`);

    // Create a centered crop area (top 60% for headshot)
    const cropHeight = Math.floor(height * 0.6);
    const cropArea = {
      x: 0,
      y: 0,
      width: width,
      height: cropHeight,
    };

    console.log('  Uploading to GCS and database...');

    // Upload using avatarService
    const result = await uploadSpeakerAvatar(filename, imageBuffer, cropArea);

    console.log(`✓ Uploaded successfully!`);
    console.log(`  Cropped: ${result.croppedUrl}`);
    console.log(`  Original: ${result.originalUrl}`);

  } catch (error: any) {
    if (error.code === 'ENOENT') {
      console.error(`✗ File not found: ${filename}`);
      console.error(`  Expected at: ${filePath}`);
    } else {
      console.error(`✗ Failed to upload ${filename}:`, error.message);
    }
    throw error;
  }
}

async function main() {
  console.log('Spanish Speaker Avatar Uploader');
  console.log('================================\n');
  console.log(`Looking for Spanish avatars in: ${AVATARS_DIR}\n`);

  let successCount = 0;
  let failCount = 0;
  const missingFiles: string[] = [];

  for (const filename of SPANISH_AVATAR_FILENAMES) {
    try {
      await uploadLocalAvatar(filename);
      successCount++;
    } catch (error: any) {
      failCount++;
      if (error.code === 'ENOENT') {
        missingFiles.push(filename);
      }
    }
  }

  console.log('\n================================');
  console.log(`✓ Complete! Success: ${successCount}, Failed: ${failCount}`);

  if (missingFiles.length > 0) {
    console.log(`\n⚠️  Missing files (${missingFiles.length}):`);
    missingFiles.forEach(f => console.log(`   - ${f}`));
    console.log(`\nTo generate these files, use the prompts provided and save them to:`);
    console.log(`${AVATARS_DIR}/`);
  }

  if (successCount > 0) {
    console.log('\nYou can now view the Spanish avatars at:');
    console.log('http://localhost:5173/app/admin/avatars');
  }
}

main().catch(console.error);
