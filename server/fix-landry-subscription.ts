import { prisma } from './src/db/client';

async function fixSubscription() {
  const email = 'landryandrew124@gmail.com';
  const subscriptionId = 'sub_1SeTAwQYF1dRCZPePsuMlAJL';
  const startedAt = new Date(1765772062 * 1000); // Dec 14, 2025
  const expiresAt = new Date(1768450462 * 1000); // Jan 14, 2026

  const user = await prisma.user.update({
    where: { email },
    data: {
      tier: 'pro',
      stripeSubscriptionId: subscriptionId,
      subscriptionStartedAt: startedAt,
      subscriptionExpiresAt: expiresAt,
    },
  });

  console.log(`✅ Fixed subscription for ${user.email}`);
  console.log(`   Tier: ${user.tier}`);
  console.log(`   Subscription ID: ${user.stripeSubscriptionId}`);
  console.log(`   Started: ${user.subscriptionStartedAt}`);
  console.log(`   Expires: ${user.subscriptionExpiresAt}`);

  process.exit(0);
}

fixSubscription();
