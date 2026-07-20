DROP TABLE IF EXISTS "subscription_events";

ALTER TABLE "User"
  DROP COLUMN IF EXISTS "tier",
  DROP COLUMN IF EXISTS "stripeCustomerId",
  DROP COLUMN IF EXISTS "stripeSubscriptionId",
  DROP COLUMN IF EXISTS "stripeSubscriptionStatus",
  DROP COLUMN IF EXISTS "stripePriceId",
  DROP COLUMN IF EXISTS "subscriptionStartedAt",
  DROP COLUMN IF EXISTS "subscriptionExpiresAt",
  DROP COLUMN IF EXISTS "subscriptionCanceledAt",
  DROP COLUMN IF EXISTS "isTestUser";
