import { prisma } from './src/db/client.js';

async function upgradeToPro() {
  // Update andrewlandry@gmail.com to Pro tier
  const user = await prisma.user.update({
    where: { email: 'andrewlandry@gmail.com' },
    data: {
      tier: 'pro',
      // We'll fill in Stripe IDs manually from Stripe dashboard if needed
    },
  });

  console.log(`✅ Upgraded ${user.email} to Pro tier`);
  console.log(`Tier: ${user.tier}`);
  process.exit(0);
}

upgradeToPro();
