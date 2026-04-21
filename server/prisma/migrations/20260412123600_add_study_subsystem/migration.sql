-- CreateTable
CREATE TABLE "study_import_jobs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "sourceType" TEXT NOT NULL DEFAULT 'anki_colpkg',
    "sourceFilename" TEXT NOT NULL,
    "deckName" TEXT NOT NULL DEFAULT '日本語',
    "previewJson" JSONB NOT NULL,
    "summaryJson" JSONB,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "study_import_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "study_notes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "importJobId" TEXT,
    "sourceKind" TEXT NOT NULL DEFAULT 'anki_import',
    "sourceNoteId" BIGINT,
    "sourceGuid" TEXT,
    "sourceDeckId" BIGINT,
    "sourceDeckName" TEXT,
    "sourceNotetypeId" BIGINT,
    "sourceNotetypeName" TEXT,
    "rawFieldsJson" JSONB NOT NULL,
    "canonicalJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "study_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "study_media" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "importJobId" TEXT,
    "sourceKind" TEXT NOT NULL DEFAULT 'anki_import',
    "sourceMediaKey" TEXT,
    "sourceFilename" TEXT NOT NULL,
    "normalizedFilename" TEXT NOT NULL,
    "mediaKind" TEXT NOT NULL,
    "contentType" TEXT,
    "storagePath" TEXT,
    "publicUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "study_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "study_cards" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "importJobId" TEXT,
    "sourceKind" TEXT NOT NULL DEFAULT 'anki_import',
    "sourceCardId" BIGINT,
    "sourceDeckId" BIGINT,
    "sourceDeckName" TEXT,
    "sourceTemplateOrd" INTEGER,
    "sourceTemplateName" TEXT,
    "sourceQueue" INTEGER,
    "sourceCardType" INTEGER,
    "sourceDue" INTEGER,
    "sourceInterval" INTEGER,
    "sourceFactor" INTEGER,
    "sourceReps" INTEGER,
    "sourceLapses" INTEGER,
    "sourceLeft" INTEGER,
    "sourceOriginalDue" INTEGER,
    "sourceOriginalDeckId" BIGINT,
    "sourceFsrsJson" JSONB,
    "cardType" TEXT NOT NULL,
    "queueState" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3),
    "lastReviewedAt" TIMESTAMP(3),
    "promptJson" JSONB NOT NULL,
    "answerJson" JSONB NOT NULL,
    "schedulerStateJson" JSONB,
    "answerAudioSource" TEXT NOT NULL DEFAULT 'missing',
    "promptAudioMediaId" TEXT,
    "answerAudioMediaId" TEXT,
    "imageMediaId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "study_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "study_review_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "importJobId" TEXT,
    "source" TEXT NOT NULL,
    "sourceReviewId" BIGINT,
    "reviewedAt" TIMESTAMP(3) NOT NULL,
    "rating" INTEGER NOT NULL,
    "durationMs" INTEGER,
    "sourceEase" INTEGER,
    "sourceInterval" INTEGER,
    "sourceLastInterval" INTEGER,
    "sourceFactor" INTEGER,
    "sourceTimeMs" INTEGER,
    "sourceReviewType" INTEGER,
    "stateBeforeJson" JSONB,
    "stateAfterJson" JSONB,
    "rawPayloadJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "study_review_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "study_import_jobs_userId_createdAt_idx" ON "study_import_jobs"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "study_import_jobs_status_idx" ON "study_import_jobs"("status");

-- CreateIndex
CREATE UNIQUE INDEX "study_notes_userId_sourceNoteId_key" ON "study_notes"("userId", "sourceNoteId");

-- CreateIndex
CREATE INDEX "study_notes_userId_sourceKind_idx" ON "study_notes"("userId", "sourceKind");

-- CreateIndex
CREATE INDEX "study_notes_importJobId_idx" ON "study_notes"("importJobId");

-- CreateIndex
CREATE INDEX "study_media_userId_sourceKind_idx" ON "study_media"("userId", "sourceKind");

-- CreateIndex
CREATE INDEX "study_media_importJobId_idx" ON "study_media"("importJobId");

-- CreateIndex
CREATE INDEX "study_media_normalizedFilename_idx" ON "study_media"("normalizedFilename");

-- CreateIndex
CREATE UNIQUE INDEX "study_cards_userId_sourceCardId_key" ON "study_cards"("userId", "sourceCardId");

-- CreateIndex
CREATE INDEX "study_cards_userId_queueState_dueAt_idx" ON "study_cards"("userId", "queueState", "dueAt");

-- CreateIndex
CREATE INDEX "study_cards_noteId_idx" ON "study_cards"("noteId");

-- CreateIndex
CREATE INDEX "study_cards_importJobId_idx" ON "study_cards"("importJobId");

-- CreateIndex
CREATE UNIQUE INDEX "study_review_logs_userId_sourceReviewId_key" ON "study_review_logs"("userId", "sourceReviewId");

-- CreateIndex
CREATE INDEX "study_review_logs_cardId_reviewedAt_idx" ON "study_review_logs"("cardId", "reviewedAt");

-- CreateIndex
CREATE INDEX "study_review_logs_importJobId_idx" ON "study_review_logs"("importJobId");

-- AddForeignKey
ALTER TABLE "study_import_jobs" ADD CONSTRAINT "study_import_jobs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_notes" ADD CONSTRAINT "study_notes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_notes" ADD CONSTRAINT "study_notes_importJobId_fkey" FOREIGN KEY ("importJobId") REFERENCES "study_import_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_media" ADD CONSTRAINT "study_media_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_media" ADD CONSTRAINT "study_media_importJobId_fkey" FOREIGN KEY ("importJobId") REFERENCES "study_import_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_cards" ADD CONSTRAINT "study_cards_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_cards" ADD CONSTRAINT "study_cards_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "study_notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_cards" ADD CONSTRAINT "study_cards_importJobId_fkey" FOREIGN KEY ("importJobId") REFERENCES "study_import_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_cards" ADD CONSTRAINT "study_cards_promptAudioMediaId_fkey" FOREIGN KEY ("promptAudioMediaId") REFERENCES "study_media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_cards" ADD CONSTRAINT "study_cards_answerAudioMediaId_fkey" FOREIGN KEY ("answerAudioMediaId") REFERENCES "study_media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_cards" ADD CONSTRAINT "study_cards_imageMediaId_fkey" FOREIGN KEY ("imageMediaId") REFERENCES "study_media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_review_logs" ADD CONSTRAINT "study_review_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_review_logs" ADD CONSTRAINT "study_review_logs_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "study_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_review_logs" ADD CONSTRAINT "study_review_logs_importJobId_fkey" FOREIGN KEY ("importJobId") REFERENCES "study_import_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
