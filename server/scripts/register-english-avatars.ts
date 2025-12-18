import { prisma } from '../src/db/client.js';

const ENGLISH_AVATARS = [
  { filename: 'en-female-casual.jpg', language: 'en', gender: 'female', tone: 'casual' },
  { filename: 'en-female-polite.jpg', language: 'en', gender: 'female', tone: 'polite' },
  { filename: 'en-female-formal.jpg', language: 'en', gender: 'female', tone: 'formal' },
  { filename: 'en-male-casual.jpg', language: 'en', gender: 'male', tone: 'casual' },
  { filename: 'en-male-polite.jpg', language: 'en', gender: 'male', tone: 'polite' },
  { filename: 'en-male-formal.jpg', language: 'en', gender: 'male', tone: 'formal' },
];

async function registerAvatar(config: typeof ENGLISH_AVATARS[0]) {
  console.log(`Registering: ${config.filename}`);

  try {
    // For local development, use /avatars/ path
    // In production, these would be GCS URLs
    const baseUrl = 'http://localhost:5173';
    const croppedUrl = `${baseUrl}/avatars/${config.filename}`;
    const originalUrl = `${baseUrl}/avatars/${config.filename}`;

    await prisma.speakerAvatar.upsert({
      where: { filename: config.filename },
      update: {
        croppedUrl,
        originalUrl,
        language: config.language,
        gender: config.gender,
        tone: config.tone,
      },
      create: {
        filename: config.filename,
        croppedUrl,
        originalUrl,
        language: config.language,
        gender: config.gender,
        tone: config.tone,
      },
    });

    console.log(`✓ Registered: ${config.filename}`);
  } catch (error: any) {
    console.error(`✗ Failed to register ${config.filename}:`, error.message);
    throw error;
  }
}

async function main() {
  console.log('Registering English Speaker Avatars in Database');
  console.log('==============================================\n');

  let successCount = 0;
  let failCount = 0;

  for (const config of ENGLISH_AVATARS) {
    try {
      await registerAvatar(config);
      successCount++;
    } catch (error) {
      failCount++;
    }
  }

  console.log('\n==============================================');
  console.log(`✓ Complete! Success: ${successCount}, Failed: ${failCount}`);
  console.log('\nEnglish avatars are now registered and will appear in Admin > Avatars');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
