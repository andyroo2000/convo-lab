-- Japanese-only cleanup: remove non-JA content and deprecated tables/columns

-- Normalize user language preferences
UPDATE "User"
SET "preferredStudyLanguage" = 'ja',
    "preferredNativeLanguage" = 'en'
WHERE "preferredStudyLanguage" IS DISTINCT FROM 'ja'
   OR "preferredNativeLanguage" IS DISTINCT FROM 'en';

-- Remove non-Japanese content
DELETE FROM "Course"
WHERE "targetLanguage" <> 'ja';

DELETE FROM "Episode"
WHERE "targetLanguage" <> 'ja';

-- Remove non-Japanese speaker avatars
DELETE FROM "SpeakerAvatar"
WHERE "language" <> 'ja';

-- Drop deprecated columns
ALTER TABLE "User" DROP COLUMN IF EXISTS "pinyinDisplayMode";
ALTER TABLE "User" DROP COLUMN IF EXISTS "hskLevel";
ALTER TABLE "User" DROP COLUMN IF EXISTS "cefrLevel";
ALTER TABLE "Course" DROP COLUMN IF EXISTS "hskLevel";
ALTER TABLE "Course" DROP COLUMN IF EXISTS "cefrLevel";
ALTER TABLE "feature_flags" DROP COLUMN IF EXISTS "narrowListeningEnabled";
ALTER TABLE "feature_flags" DROP COLUMN IF EXISTS "processingInstructionEnabled";
ALTER TABLE "feature_flags" DROP COLUMN IF EXISTS "lexicalChunksEnabled";

-- Drop deprecated tables
DROP TABLE IF EXISTS "StorySegment" CASCADE;
DROP TABLE IF EXISTS "StoryVersion" CASCADE;
DROP TABLE IF EXISTS "NarrowListeningPack" CASCADE;
DROP TABLE IF EXISTS "ChunkExercise" CASCADE;
DROP TABLE IF EXISTS "ChunkStorySegment" CASCADE;
DROP TABLE IF EXISTS "ChunkStory" CASCADE;
DROP TABLE IF EXISTS "ChunkExample" CASCADE;
DROP TABLE IF EXISTS "Chunk" CASCADE;
DROP TABLE IF EXISTS "ChunkPack" CASCADE;
