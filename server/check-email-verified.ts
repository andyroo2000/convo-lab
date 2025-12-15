import { prisma } from './src/db/client.js';

async function checkEmailVerification() {
  const user = await prisma.user.findUnique({
    where: { email: 'andrewlandry@gmail.com' },
    select: {
      email: true,
      emailVerified: true,
      emailVerifiedAt: true,
      role: true,
    },
  });

  console.log('User verification status:', user);

  // Update if not verified
  if (user && !user.emailVerified) {
    const updated = await prisma.user.update({
      where: { email: 'andrewlandry@gmail.com' },
      data: {
        emailVerified: true,
        emailVerifiedAt: new Date(),
      },
      select: {
        email: true,
        emailVerified: true,
        emailVerifiedAt: true,
      },
    });
    console.log('Updated user:', updated);
  }

  await prisma.$disconnect();
}

checkEmailVerification();
