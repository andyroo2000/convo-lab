-- CreateTable
CREATE TABLE IF NOT EXISTS "feature_flags" (
    "id" TEXT NOT NULL,
    "dialoguesEnabled" BOOLEAN NOT NULL DEFAULT true,
    "audioCourseEnabled" BOOLEAN NOT NULL DEFAULT true,
    "narrowListeningEnabled" BOOLEAN NOT NULL DEFAULT true,
    "processingInstructionEnabled" BOOLEAN NOT NULL DEFAULT true,
    "lexicalChunksEnabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("id")
);

-- Insert default feature flags if table is empty
INSERT INTO "feature_flags" ("id", "dialoguesEnabled", "audioCourseEnabled", "narrowListeningEnabled", "processingInstructionEnabled", "lexicalChunksEnabled", "updatedAt")
SELECT 'default', true, true, true, true, true, NOW()
WHERE NOT EXISTS (SELECT 1 FROM "feature_flags" LIMIT 1);
