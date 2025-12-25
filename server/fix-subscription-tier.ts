import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixSubscriptionTier() {
  const stripeCustomerId = 'cus_TewhkYxtg1QbAV';
  const subscriptionId = 'sub_1Shcp5QYF1dRCZPeoWVqcVoA';
  const priceId = 'price_1ShbkfQYF1dRCZPeuHr2fNrk';

  console.log(`🔍 Looking for user with Stripe customer ID: ${stripeCustomerId}`);

  const user = await prisma.user.findUnique({
    where: { stripeCustomerId },
    select: { id: true, email: true, tier: true },
  });

  if (!user) {
    console.error('❌ User not found with that Stripe customer ID');
    process.exit(1);
  }

  console.log(`✅ Found user: ${user.email} (current tier: ${user.tier})`);

  console.log(`🔄 Updating to pro tier...`);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      tier: 'pro',
      stripeSubscriptionId: subscriptionId,
      stripeSubscriptionStatus: 'active',
      stripePriceId: priceId,
      subscriptionStartedAt: new Date(1766524131 * 1000),
      subscriptionExpiresAt: new Date(1769202531 * 1000),
      subscriptionCanceledAt: null,
    },
  });

  console.log(`✅ User tier updated to pro!`);
  console.log(`   Subscription ID: ${subscriptionId}`);
  console.log(`   Expires: ${new Date(1769202531 * 1000).toLocaleDateString()}`);

  await prisma.$disconnect();
}

fixSubscriptionTier().catch(console.error);
