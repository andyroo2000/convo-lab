-- AlterTable
ALTER TABLE "Speaker" ADD COLUMN IF NOT EXISTS "voiceProvider" TEXT DEFAULT 'google';
