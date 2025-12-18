import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';

// Simple colored placeholder avatars with initials

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

async function generateAndSaveAvatar(config: typeof AVATAR_CONFIGS[0]): Promise<void> {
  console.log(`\nGenerating: ${config.filename} (${config.name})`);

  try {
    // Create simple avatar
    const imageBuffer = await createSimpleAvatar(config.bgColor, config.initial);
    console.log(`✓ Generated placeholder (${(imageBuffer.length / 1024).toFixed(1)}KB)`);

    // Save to public/avatars directory
    const avatarDir = path.join(process.cwd(), 'public', 'avatars');
    await fs.mkdir(avatarDir, { recursive: true });

    const filePath = path.join(avatarDir, config.filename);
    await fs.writeFile(filePath, imageBuffer);

    console.log(`✓ Saved to: ${filePath}`);

  } catch (error: any) {
    console.error(`✗ Failed to generate ${config.filename}:`, error.message);
    throw error;
  }
}

async function main() {
  console.log('English Speaker Avatar Generator (Simple Placeholders)');
  console.log('====================================================\n');
  console.log('Generating 6 English placeholder avatars...\n');
  console.log('Note: These are temporary placeholders with colored backgrounds and initials.\n');

  let successCount = 0;
  let failCount = 0;

  for (const config of AVATAR_CONFIGS) {
    try {
      await generateAndSaveAvatar(config);
      successCount++;
    } catch (error) {
      failCount++;
      console.error(`\nSkipping ${config.filename} due to error\n`);
    }
  }

  console.log('\n====================================================');
  console.log(`✓ Complete! Success: ${successCount}, Failed: ${failCount}`);
  console.log('\nAvatars saved to: server/public/avatars/');
  console.log('These will be served at: http://localhost:5173/avatars/en-*.jpg');
}

main().catch(console.error);
