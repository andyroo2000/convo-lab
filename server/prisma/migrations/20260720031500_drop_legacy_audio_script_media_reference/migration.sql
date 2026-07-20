-- Contract only after every ConvoLab server and worker reads Audio Script media
-- through audioScriptMediaId. Refuse to discard a populated legacy reference if
-- the expand/backfill migration did not copy it successfully.
BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "audio_script_segments"
    WHERE "imageMediaId" IS NOT NULL
      AND "audioScriptMediaId" IS NULL
  ) THEN
    RAISE EXCEPTION
      'Cannot drop audio_script_segments.imageMediaId: legacy media references are not fully backfilled';
  END IF;
END
$$;

ALTER TABLE "audio_script_segments"
  DROP CONSTRAINT IF EXISTS "audio_script_segments_imageMediaId_fkey";

DROP INDEX IF EXISTS "audio_script_segments_imageMediaId_idx";

ALTER TABLE "audio_script_segments"
  DROP COLUMN IF EXISTS "imageMediaId";

COMMIT;
