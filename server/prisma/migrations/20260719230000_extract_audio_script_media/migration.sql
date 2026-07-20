-- Expand first: the legacy imageMediaId reference stays populated until every deployed
-- ConvoLab instance reads from the Audio Script-owned relation.
CREATE TABLE "audio_script_media" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceKind" TEXT NOT NULL DEFAULT 'generated',
    "sourceFilename" TEXT NOT NULL,
    "normalizedFilename" TEXT NOT NULL,
    "mediaKind" TEXT NOT NULL DEFAULT 'image',
    "contentType" TEXT,
    "storagePath" TEXT,
    "publicUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "audio_script_media_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "audio_script_segments"
  ADD COLUMN "audioScriptMediaId" TEXT;

INSERT INTO "audio_script_media" (
    "id",
    "userId",
    "sourceKind",
    "sourceFilename",
    "normalizedFilename",
    "mediaKind",
    "contentType",
    "storagePath",
    "publicUrl",
    "createdAt",
    "updatedAt"
)
SELECT
    media."id",
    media."userId",
    media."sourceKind",
    media."sourceFilename",
    media."normalizedFilename",
    media."mediaKind",
    media."contentType",
    media."storagePath",
    media."publicUrl",
    media."createdAt",
    media."updatedAt"
FROM "study_media" AS media
WHERE EXISTS (
    SELECT 1
    FROM "audio_script_segments" AS segment
    WHERE segment."imageMediaId" = media."id"
);

UPDATE "audio_script_segments"
SET "audioScriptMediaId" = "imageMediaId"
WHERE "imageMediaId" IS NOT NULL;

CREATE INDEX "audio_script_media_userId_updatedAt_id_idx"
  ON "audio_script_media"("userId", "updatedAt", "id");
CREATE INDEX "audio_script_media_normalizedFilename_idx"
  ON "audio_script_media"("normalizedFilename");
CREATE INDEX "audio_script_segments_audioScriptMediaId_idx"
  ON "audio_script_segments"("audioScriptMediaId");

ALTER TABLE "audio_script_media"
  ADD CONSTRAINT "audio_script_media_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "audio_script_segments"
  ADD CONSTRAINT "audio_script_segments_audioScriptMediaId_fkey"
  FOREIGN KEY ("audioScriptMediaId") REFERENCES "audio_script_media"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
