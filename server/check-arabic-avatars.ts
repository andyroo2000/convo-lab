import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkAvatars() {
  const avatars = await prisma.speakerAvatar.findMany({
    where: { language: 'ar' },
    orderBy: { filename: 'asc' },
  });

  console.log(`\nFound ${avatars.length} Arabic avatars in database:\n`);

  avatars.forEach((a) => {
    console.log(`✓ ${a.filename}`);
    console.log(`  Cropped: ${a.croppedUrl}`);
    console.log(`  Original: ${a.originalUrl}\n`);
  });

  await prisma.$disconnect();
}

checkAvatars().catch(console.error);
