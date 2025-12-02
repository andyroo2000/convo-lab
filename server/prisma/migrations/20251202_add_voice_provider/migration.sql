-- AlterTable
ALTER TABLE "StorySegment" ADD COLUMN IF NOT EXISTS "voiceProvider" TEXT DEFAULT 'google';
