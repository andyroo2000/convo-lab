ALTER TABLE "study_import_jobs"
ADD COLUMN "sourceObjectPath" TEXT,
ADD COLUMN "sourceContentType" TEXT,
ADD COLUMN "sourceSizeBytes" BIGINT,
ADD COLUMN "uploadedAt" TIMESTAMP(3);
