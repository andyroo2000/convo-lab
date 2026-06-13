ALTER TABLE "audio_scripts"
  ADD COLUMN "imageStatus" TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN "imageErrorMessage" TEXT;

ALTER TABLE "audio_script_segments"
  ADD COLUMN "imageStatus" TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN "imageErrorMessage" TEXT,
  ADD COLUMN "imageMediaId" TEXT,
  ADD COLUMN "imageGeneratedAt" TIMESTAMP(3);

ALTER TABLE "audio_script_segments"
  ADD CONSTRAINT "audio_script_segments_imageMediaId_fkey"
  FOREIGN KEY ("imageMediaId") REFERENCES "study_media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "audio_script_segments_imageMediaId_idx" ON "audio_script_segments"("imageMediaId");
CREATE INDEX "audio_script_segments_scriptId_imageStatus_idx" ON "audio_script_segments"("scriptId", "imageStatus");
