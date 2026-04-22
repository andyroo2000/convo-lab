CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE "study_notes"
ADD COLUMN "searchText" TEXT NOT NULL DEFAULT '';

ALTER TABLE "study_cards"
ADD COLUMN "searchText" TEXT NOT NULL DEFAULT '';

UPDATE "study_notes"
SET "searchText" = trim(concat_ws(' ', COALESCE("rawFieldsJson"::text, ''), COALESCE("canonicalJson"::text, '')));

UPDATE "study_cards"
SET "searchText" = trim(concat_ws(' ', COALESCE("promptJson"::text, ''), COALESCE("answerJson"::text, '')));

CREATE INDEX "study_import_jobs_userId_updatedAt_id_idx"
ON "study_import_jobs"("userId", "updatedAt", "id");

CREATE UNIQUE INDEX "study_import_jobs_userId_processing_unique"
ON "study_import_jobs"("userId")
WHERE "status" = 'processing';

CREATE INDEX "study_media_userId_updatedAt_id_idx"
ON "study_media"("userId", "updatedAt", "id");

CREATE INDEX "study_cards_userId_updatedAt_id_idx"
ON "study_cards"("userId", "updatedAt", "id");

CREATE INDEX "study_notes_searchText_trgm_idx"
ON "study_notes"
USING GIN ("searchText" gin_trgm_ops);

CREATE INDEX "study_cards_searchText_trgm_idx"
ON "study_cards"
USING GIN ("searchText" gin_trgm_ops);
