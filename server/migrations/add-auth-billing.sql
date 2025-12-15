-- Add email verification fields to User table
ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "emailVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "emailVerifiedAt" TIMESTAMP;

-- Add OAuth fields to User table
ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "googleId" TEXT UNIQUE;

-- Make password optional for OAuth users
ALTER TABLE "User"
ALTER COLUMN "password" DROP NOT NULL;

-- Add subscription/billing fields to User table
ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "tier" TEXT NOT NULL DEFAULT 'free',
ADD COLUMN IF NOT EXISTS "stripeCustomerId" TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS "stripeSubscriptionId" TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS "stripeSubscriptionStatus" TEXT,
ADD COLUMN IF NOT EXISTS "stripePriceId" TEXT,
ADD COLUMN IF NOT EXISTS "subscriptionStartedAt" TIMESTAMP,
ADD COLUMN IF NOT EXISTS "subscriptionExpiresAt" TIMESTAMP,
ADD COLUMN IF NOT EXISTS "subscriptionCanceledAt" TIMESTAMP;

-- Create indexes for new User fields
CREATE INDEX IF NOT EXISTS "User_emailVerified_idx" ON "User"("emailVerified");
CREATE INDEX IF NOT EXISTS "User_googleId_idx" ON "User"("googleId");
CREATE INDEX IF NOT EXISTS "User_tier_idx" ON "User"("tier");
CREATE INDEX IF NOT EXISTS "User_stripeCustomerId_idx" ON "User"("stripeCustomerId");
CREATE INDEX IF NOT EXISTS "User_stripeSubscriptionId_idx" ON "User"("stripeSubscriptionId");

-- Create EmailVerificationToken table
CREATE TABLE IF NOT EXISTS "email_verification_tokens" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "token" TEXT NOT NULL UNIQUE,
  "expiresAt" TIMESTAMP NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "email_verification_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "email_verification_tokens_token_idx" ON "email_verification_tokens"("token");
CREATE INDEX IF NOT EXISTS "email_verification_tokens_userId_idx" ON "email_verification_tokens"("userId");
CREATE INDEX IF NOT EXISTS "email_verification_tokens_expiresAt_idx" ON "email_verification_tokens"("expiresAt");

-- Create PasswordResetToken table
CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "token" TEXT NOT NULL UNIQUE,
  "expiresAt" TIMESTAMP NOT NULL,
  "usedAt" TIMESTAMP,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "password_reset_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "password_reset_tokens_token_idx" ON "password_reset_tokens"("token");
CREATE INDEX IF NOT EXISTS "password_reset_tokens_userId_idx" ON "password_reset_tokens"("userId");
CREATE INDEX IF NOT EXISTS "password_reset_tokens_expiresAt_idx" ON "password_reset_tokens"("expiresAt");

-- Create SubscriptionEvent table
CREATE TABLE IF NOT EXISTS "subscription_events" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "fromTier" TEXT,
  "toTier" TEXT NOT NULL,
  "stripeEventId" TEXT UNIQUE,
  "metadata" JSONB,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "subscription_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "subscription_events_userId_idx" ON "subscription_events"("userId");
CREATE INDEX IF NOT EXISTS "subscription_events_eventType_idx" ON "subscription_events"("eventType");
CREATE INDEX IF NOT EXISTS "subscription_events_createdAt_idx" ON "subscription_events"("createdAt");

-- Create OAuthAccount table
CREATE TABLE IF NOT EXISTS "oauth_accounts" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "accessToken" TEXT,
  "refreshToken" TEXT,
  "expiresAt" TIMESTAMP,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "oauth_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "oauth_accounts_provider_providerId_key" UNIQUE ("provider", "providerId")
);

CREATE INDEX IF NOT EXISTS "oauth_accounts_userId_idx" ON "oauth_accounts"("userId");

-- Verify existing user
UPDATE "User" SET "emailVerified" = true, "emailVerifiedAt" = NOW()
WHERE "email" = 'andrewlandry@gmail.com' AND "emailVerified" = false;
