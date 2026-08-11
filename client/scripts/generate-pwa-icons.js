import sharp from 'sharp';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdir, readFile } from 'fs/promises';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(__dirname, '../public');

export const PWA_ICON_SPECS = [
  { size: 192, name: 'pwa-192x192.png' },
  { size: 512, name: 'pwa-512x512.png' },
  { size: 180, name: 'apple-touch-icon.png' }, // iOS
];

export function renderPwaIcon(svgBuffer, size) {
  return sharp(svgBuffer).resize(size, size).png();
}

export async function generateIcons({
  sourcePath = resolve(publicDir, 'favicon.svg'),
  outputDir = publicDir,
  log = console.log,
} = {}) {
  const svgBuffer = await readFile(sourcePath);
  await mkdir(outputDir, { recursive: true });

  log('Generating PWA icons...');

  for (const { size, name } of PWA_ICON_SPECS) {
    await renderPwaIcon(svgBuffer, size).toFile(resolve(outputDir, name));
    log(`✓ Generated ${name} (${size}x${size})`);
  }

  log('All icons generated successfully!');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  generateIcons().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
