import { prisma } from './src/db/client.js';

async function runMigration() {
  try {
    console.log('Starting migration...');

    // Add email verification fields to User table
    console.log('Adding email verification fields...');
    await prisma.$executeRaw`
      ALTER TABLE "User"
      ADD COLUMN IF NOT EXISTS "emailVerified" BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "emailVerifiedAt" TIMESTAMP
    `;

    // Add OAuth fields to User table
    console.log('Adding OAuth fields...');
    await prisma.$executeRaw`
      ALTER TABLE "User"
      ADD COLUMN IF NOT EXISTS "googleId" TEXT
    `;

    // Make password optional for OAuth users
    console.log('Making password optional...');
    await prisma.$executeRaw`
      ALTER TABLE "User"
      ALTER COLUMN "password" DROP NOT NULL
    `;

    // Add subscription/billing fields to User table
    console.log('Adding subscription fields...');
    await prisma.$executeRaw`
      ALTER TABLE "User"
      ADD COLUMN IF NOT EXISTS "tier" TEXT NOT NULL DEFAULT 'free',
      ADD COLUMN IF NOT EXISTS "stripeCustomerId" TEXT,
      ADD COLUMN IF NOT EXISTS "stripeSubscriptionId" TEXT,
      ADD COLUMN IF NOT EXISTS "stripeSubscriptionStatus" TEXT,
      ADD COLUMN IF NOT EXISTS "stripePriceId" TEXT,
      ADD COLUMN IF NOT EXISTS "subscriptionStartedAt" TIMESTAMP,
      ADD COLUMN IF NOT EXISTS "subscriptionExpiresAt" TIMESTAMP,
      ADD COLUMN IF NOT EXISTS "subscriptionCanceledAt" TIMESTAMP
    `;

    // Create unique constraints
    console.log('Creating unique constraints...');
    try {
      await prisma.$executeRaw`
        ALTER TABLE "User"
        ADD CONSTRAINT "User_googleId_key" UNIQUE ("googleId")
      `;
    } catch (e: any) {
      if (!e.message.includes('already exists')) throw e;
      console.log('  - googleId constraint already exists');
    }

    try {
      await prisma.$executeRaw`
        ALTER TABLE "User"
        ADD CONSTRAINT "User_stripeCustomerId_key" UNIQUE ("stripeCustomerId")
      `;
    } catch (e: any) {
      if (!e.message.includes('already exists')) throw e;
      console.log('  - stripeCustomerId constraint already exists');
    }

    try {
      await prisma.$executeRaw`
        ALTER TABLE "User"
        ADD CONSTRAINT "User_stripeSubscriptionId_key" UNIQUE ("stripeSubscriptionId")
      `;
    } catch (e: any) {
      if (!e.message.includes('already exists')) throw e;
      console.log('  - stripeSubscriptionId constraint already exists');
    }

    // Create indexes for new User fields
    console.log('Creating indexes...');
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "User_emailVerified_idx" ON "User"("emailVerified")`;
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "User_googleId_idx" ON "User"("googleId")`;
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "User_tier_idx" ON "User"("tier")`;
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "User_stripeCustomerId_idx" ON "User"("stripeCustomerId")`;
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "User_stripeSubscriptionId_idx" ON "User"("stripeSubscriptionId")`;

    // Create EmailVerificationToken table
    console.log('Creating EmailVerificationToken table...');
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "email_verification_tokens" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "userId" TEXT NOT NULL,
        "token" TEXT NOT NULL UNIQUE,
        "expiresAt" TIMESTAMP NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "email_verification_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `;

    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "email_verification_tokens_token_idx" ON "email_verification_tokens"("token")`;
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "email_verification_tokens_userId_idx" ON "email_verification_tokens"("userId")`;
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "email_verification_tokens_expiresAt_idx" ON "email_verification_tokens"("expiresAt")`;

    // Create PasswordResetToken table
    console.log('Creating PasswordResetToken table...');
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "userId" TEXT NOT NULL,
        "token" TEXT NOT NULL UNIQUE,
        "expiresAt" TIMESTAMP NOT NULL,
        "usedAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "password_reset_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `;

    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "password_reset_tokens_token_idx" ON "password_reset_tokens"("token")`;
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "password_reset_tokens_userId_idx" ON "password_reset_tokens"("userId")`;
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "password_reset_tokens_expiresAt_idx" ON "password_reset_tokens"("expiresAt")`;

    // Create SubscriptionEvent table
    console.log('Creating SubscriptionEvent table...');
    await prisma.$executeRaw`
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
      )
    `;

    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "subscription_events_userId_idx" ON "subscription_events"("userId")`;
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "subscription_events_eventType_idx" ON "subscription_events"("eventType")`;
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "subscription_events_createdAt_idx" ON "subscription_events"("createdAt")`;

    // Create OAuthAccount table
    console.log('Creating OAuthAccount table...');
    await prisma.$executeRaw`
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
        CONSTRAINT "oauth_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `;

    // Add unique constraint for provider + providerId
    try {
      await prisma.$executeRaw`
        ALTER TABLE "oauth_accounts"
        ADD CONSTRAINT "oauth_accounts_provider_providerId_key" UNIQUE ("provider", "providerId")
      `;
    } catch (e: any) {
      if (!e.message.includes('already exists')) throw e;
      console.log('  - provider/providerId constraint already exists');
    }

    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "oauth_accounts_userId_idx" ON "oauth_accounts"("userId")`;

    // Verify existing user
    console.log('Verifying admin user email...');
    await prisma.$executeRaw`
      UPDATE "User"
      SET "emailVerified" = true, "emailVerifiedAt" = NOW()
      WHERE "email" = 'andrewlandry@gmail.com'
    `;

    console.log('✅ Migration completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

runMigration();
