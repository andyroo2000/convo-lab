-- CreateTable
CREATE TABLE "SpeakerAvatar" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "croppedUrl" TEXT NOT NULL,
    "originalUrl" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "gender" TEXT NOT NULL,
    "tone" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpeakerAvatar_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SpeakerAvatar_filename_key" ON "SpeakerAvatar"("filename");

-- CreateIndex
CREATE INDEX "SpeakerAvatar_filename_idx" ON "SpeakerAvatar"("filename");

-- CreateIndex
CREATE INDEX "SpeakerAvatar_language_gender_tone_idx" ON "SpeakerAvatar"("language", "gender", "tone");
