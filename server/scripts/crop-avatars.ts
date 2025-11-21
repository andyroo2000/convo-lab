import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Crop downloaded avatar images to optimized headshots
 *
 * Usage:
 * 1. Download images from nano banana to: server/public/avatars/downloads/
 * 2. Name them like: ja-female-casual.jpg, zh-male-formal.png, etc.
 * 3. Run: npm run crop:avatars
 *
 * The script will:
 * - Detect faces (if possible) or use top-center cropping
 * - Crop to headshot area
 * - Resize to 256×256px
 * - Optimize file size
 * - Save to: server/public/avatars/
 */

async function cropAvatar(inputPath: string, outputFilename: string): Promise<void> {
  console.log(`Processing: ${path.basename(inputPath)}`);

  try {
    const imageBuffer = await fs.readFile(inputPath);
    const image = sharp(imageBuffer);
    const metadata = await image.metadata();
    const width = metadata.width!;
    const height = metadata.height!;

    console.log(`  Original size: ${width}×${height}`);

    // Strategy: Crop tightly around the face
    // For landscape images (typical AI generation), we want a smaller square
    // that focuses on just the face area, not shoulders

    let cropSize: number;
    let cropX: number;
    let cropY: number;

    if (width >= height) {
      // Landscape - crop a square that's 60% of the height to get just the face
      // This is much tighter than using full height
      cropSize = Math.floor(height * 0.6);
      // Center horizontally, with slight preference for center-top
      cropX = Math.floor((width - cropSize) / 2);
      // Start from 15% down to skip empty space above head
      cropY = Math.floor(height * 0.15);
    } else {
      // Portrait - use 60% of width as crop size
      cropSize = Math.floor(width * 0.6);
      cropX = Math.floor((width - cropSize) / 2);
      // Start crop at 20% from top to focus on face
      cropY = Math.floor(height * 0.2);
    }

    // Make sure crop doesn't exceed image bounds
    if (cropY + cropSize > height) {
      cropY = Math.max(0, height - cropSize);
    }
    if (cropX + cropSize > width) {
      cropX = Math.max(0, width - cropSize);
    }

    console.log(`  Crop area: ${cropSize}×${cropSize} at (${cropX}, ${cropY})`);

    const croppedImage = await image
      .extract({
        left: cropX,
        top: cropY,
        width: cropSize,
        height: cropSize,
      })
      .resize(256, 256, {
        fit: 'cover',
        position: 'center',
      })
      .jpeg({
        quality: 85,
        progressive: true,
      })
      .toBuffer();

    // Save cropped avatar
    const outputPath = path.join(__dirname, '../../server/public/avatars', outputFilename);
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, croppedImage);

    const stats = await fs.stat(outputPath);
    console.log(`  ✓ Saved to: ${outputFilename} (${(stats.size / 1024).toFixed(1)}KB)\n`);

  } catch (error: any) {
    console.error(`  ✗ Failed: ${error.message}\n`);
    throw error;
  }
}

async function main() {
  console.log('Avatar Cropping Tool');
  console.log('====================\n');

  const downloadsDir = path.join(__dirname, '../../server/public/avatars/downloads');

  try {
    // Check if downloads directory exists
    await fs.access(downloadsDir);
  } catch {
    console.error(`Error: Downloads directory not found!`);
    console.error(`Please create: ${downloadsDir}`);
    console.error(`And place your downloaded images there.`);
    process.exit(1);
  }

  // Read all files from downloads directory
  const files = await fs.readdir(downloadsDir);
  const imageFiles = files.filter(f =>
    f.endsWith('.jpg') || f.endsWith('.jpeg') || f.endsWith('.png') || f.endsWith('.webp')
  );

  if (imageFiles.length === 0) {
    console.error('No image files found in downloads directory!');
    console.error(`Place .jpg, .png, or .webp files in: ${downloadsDir}`);
    process.exit(1);
  }

  console.log(`Found ${imageFiles.length} image(s) to process\n`);

  for (const filename of imageFiles) {
    const inputPath = path.join(downloadsDir, filename);
    // Keep the same filename but force .jpg extension
    const baseName = path.parse(filename).name;
    const outputFilename = `${baseName}.jpg`;

    try {
      await cropAvatar(inputPath, outputFilename);
    } catch (error) {
      console.error(`Skipping ${filename} due to error`);
    }
  }

  console.log('✓ Cropping complete!');
  console.log(`Avatars saved to: server/public/avatars/`);
  console.log(`\nTip: Review the cropped images. If faces are cut off:`);
  console.log(`  - Adjust the cropY calculation (currently 10% from top)`);
  console.log(`  - Or use portrait mode with better framing when generating images`);
}

main().catch(console.error);
