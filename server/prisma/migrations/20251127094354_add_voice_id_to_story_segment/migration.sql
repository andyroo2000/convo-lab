-- AlterTable
ALTER TABLE "StorySegment" ADD COLUMN "voiceId" TEXT;

-- Backfill voiceId from version's voiceId for backward compatibility
UPDATE "StorySegment"
SET "voiceId" = (
  SELECT "voiceId"
  FROM "StoryVersion"
  WHERE "StoryVersion"."id" = "StorySegment"."versionId"
);

-- CreateIndex
CREATE INDEX "StorySegment_voiceId_idx" ON "StorySegment"("voiceId");
