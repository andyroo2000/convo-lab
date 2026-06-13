-- Add script episodes as a first-class created content type.
ALTER TABLE "Episode"
  ADD COLUMN "contentType" TEXT NOT NULL DEFAULT 'dialogue';

CREATE INDEX "Episode_contentType_idx" ON "Episode"("contentType");

CREATE TABLE "audio_scripts" (
  "id" TEXT NOT NULL,
  "episodeId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "voiceId" TEXT NOT NULL,
  "voiceProvider" TEXT NOT NULL DEFAULT 'google',
  "generationMetadataJson" JSONB,
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "audio_scripts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "audio_script_segments" (
  "id" TEXT NOT NULL,
  "scriptId" TEXT NOT NULL,
  "order" INTEGER NOT NULL,
  "text" TEXT NOT NULL,
  "reading" TEXT,
  "translation" TEXT NOT NULL,
  "imagePrompt" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "audio_script_segments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "audio_script_renders" (
  "id" TEXT NOT NULL,
  "scriptId" TEXT NOT NULL,
  "speed" TEXT NOT NULL,
  "numericSpeed" DOUBLE PRECISION NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "audioUrl" TEXT,
  "timingData" JSONB,
  "approxDurationSeconds" DOUBLE PRECISION,
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "audio_script_renders_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "audio_scripts_episodeId_key" ON "audio_scripts"("episodeId");
CREATE INDEX "audio_scripts_status_idx" ON "audio_scripts"("status");

CREATE UNIQUE INDEX "audio_script_segments_scriptId_order_key" ON "audio_script_segments"("scriptId", "order");
CREATE INDEX "audio_script_segments_scriptId_order_idx" ON "audio_script_segments"("scriptId", "order");

CREATE UNIQUE INDEX "audio_script_renders_scriptId_speed_key" ON "audio_script_renders"("scriptId", "speed");
CREATE INDEX "audio_script_renders_scriptId_status_idx" ON "audio_script_renders"("scriptId", "status");

ALTER TABLE "audio_scripts"
  ADD CONSTRAINT "audio_scripts_episodeId_fkey"
  FOREIGN KEY ("episodeId") REFERENCES "Episode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "audio_script_segments"
  ADD CONSTRAINT "audio_script_segments_scriptId_fkey"
  FOREIGN KEY ("scriptId") REFERENCES "audio_scripts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "audio_script_renders"
  ADD CONSTRAINT "audio_script_renders_scriptId_fkey"
  FOREIGN KEY ("scriptId") REFERENCES "audio_scripts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
