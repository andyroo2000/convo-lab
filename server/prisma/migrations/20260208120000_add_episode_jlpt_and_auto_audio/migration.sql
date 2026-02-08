-- Add JLPT level and audio generation toggle to episodes
ALTER TABLE "Episode" ADD COLUMN "jlptLevel" TEXT;
ALTER TABLE "Episode" ADD COLUMN "autoGenerateAudio" BOOLEAN NOT NULL DEFAULT true;
