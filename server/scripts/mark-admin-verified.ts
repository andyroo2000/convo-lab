import { prisma } from '../src/db/client.js';

async function main() {
  const user = await prisma.user.update({
    where: { email: 'andrewlandry@gmail.com' },
    data: {
      emailVerified: true,
      emailVerifiedAt: new Date(),
    },
  });

  console.log('✓ Email verified for', user.email);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
