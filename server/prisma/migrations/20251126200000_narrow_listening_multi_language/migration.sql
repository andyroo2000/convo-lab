-- Add Chinese language support to Narrow Listening
-- 1. Add hskLevel column to NarrowListeningPack
-- 2. Make jlptLevel nullable (was required before)
-- 3. Rename japaneseText to targetText in StorySegment

-- Add hskLevel column
ALTER TABLE "NarrowListeningPack" ADD COLUMN "hskLevel" TEXT;

-- Make jlptLevel nullable (it was NOT NULL before)
ALTER TABLE "NarrowListeningPack" ALTER COLUMN "jlptLevel" DROP NOT NULL;

-- Rename japaneseText to targetText
ALTER TABLE "StorySegment" RENAME COLUMN "japaneseText" TO "targetText";
