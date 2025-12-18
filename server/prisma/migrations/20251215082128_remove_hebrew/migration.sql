-- Migration to handle Hebrew language removal
-- This migration will:
-- 1. Update users with Hebrew as study language to default (Japanese)
-- 2. Update users with Hebrew as native language to default (English)
-- 3. Update any episodes/courses with Hebrew to Japanese

-- Update users with Hebrew as study language
UPDATE "User"
SET "preferredStudyLanguage" = 'ja'
WHERE "preferredStudyLanguage" = 'he';

-- Update users with Hebrew as native language
UPDATE "User"
SET "preferredNativeLanguage" = 'en'
WHERE "preferredNativeLanguage" = 'he';

-- Update episodes with Hebrew as target language
UPDATE "Episode"
SET "targetLanguage" = 'ja'
WHERE "targetLanguage" = 'he';

-- Update episodes with Hebrew as native language
UPDATE "Episode"
SET "nativeLanguage" = 'en'
WHERE "nativeLanguage" = 'he';

-- Update courses with Hebrew as target language
UPDATE "Course"
SET "targetLanguage" = 'ja'
WHERE "targetLanguage" = 'he';

-- Update courses with Hebrew as native language
UPDATE "Course"
SET "nativeLanguage" = 'en'
WHERE "nativeLanguage" = 'he';

-- Update narrow listening packs with Hebrew
UPDATE "NarrowListeningPack"
SET "targetLanguage" = 'ja'
WHERE "targetLanguage" = 'he';

-- Update chunk packs with Hebrew
UPDATE "ChunkPack"
SET "targetLanguage" = 'ja'
WHERE "targetLanguage" = 'he';
