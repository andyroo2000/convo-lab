import sharp from 'sharp';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdir } from 'fs/promises';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(__dirname, '../public');

const svgBuffer = readFileSync(resolve(publicDir, 'favicon.svg'));

const sizes = [
  { size: 192, name: 'pwa-192x192.png' },
  { size: 512, name: 'pwa-512x512.png' },
  { size: 180, name: 'apple-touch-icon.png' }, // iOS
];

async function generateIcons() {
  console.log('Generating PWA icons...');

  for (const { size, name } of sizes) {
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(resolve(publicDir, name));
    console.log(`✓ Generated ${name} (${size}x${size})`);
  }

  console.log('All icons generated successfully!');
}

generateIcons().catch(console.error);
