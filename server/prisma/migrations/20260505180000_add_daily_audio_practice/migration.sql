-- Add Daily Audio Practice models

CREATE TABLE "daily_audio_practices" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "practiceDate" DATE NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "targetDurationMinutes" INTEGER NOT NULL DEFAULT 30,
  "targetLanguage" TEXT NOT NULL DEFAULT 'ja',
  "nativeLanguage" TEXT NOT NULL DEFAULT 'en',
  "sourceCardIdsJson" JSONB,
  "selectionSummaryJson" JSONB,
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "daily_audio_practices_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "daily_audio_practice_tracks" (
  "id" TEXT NOT NULL,
  "practiceId" TEXT NOT NULL,
  "mode" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "title" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL,
  "scriptUnitsJson" JSONB,
  "audioUrl" TEXT,
  "timingData" JSONB,
  "approxDurationSeconds" INTEGER,
  "generationMetadataJson" JSONB,
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "daily_audio_practice_tracks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "daily_audio_practices_userId_practiceDate_key"
  ON "daily_audio_practices"("userId", "practiceDate");
CREATE INDEX "daily_audio_practices_userId_status_practiceDate_idx"
  ON "daily_audio_practices"("userId", "status", "practiceDate");
CREATE INDEX "daily_audio_practices_status_idx"
  ON "daily_audio_practices"("status");
CREATE UNIQUE INDEX "daily_audio_practice_tracks_practiceId_mode_key"
  ON "daily_audio_practice_tracks"("practiceId", "mode");
CREATE INDEX "daily_audio_practice_tracks_practiceId_sortOrder_idx"
  ON "daily_audio_practice_tracks"("practiceId", "sortOrder");
CREATE INDEX "daily_audio_practice_tracks_status_idx"
  ON "daily_audio_practice_tracks"("status");

ALTER TABLE "daily_audio_practices"
  ADD CONSTRAINT "daily_audio_practices_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "daily_audio_practice_tracks"
  ADD CONSTRAINT "daily_audio_practice_tracks_practiceId_fkey"
  FOREIGN KEY ("practiceId") REFERENCES "daily_audio_practices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
