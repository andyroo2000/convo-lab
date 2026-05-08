-- CreateTable
CREATE TABLE "study_card_drafts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'generating',
    "creationKind" TEXT NOT NULL,
    "cardType" TEXT NOT NULL,
    "promptJson" JSONB NOT NULL,
    "answerJson" JSONB NOT NULL,
    "imagePlacement" TEXT NOT NULL DEFAULT 'none',
    "imagePrompt" TEXT,
    "previewAudioJson" JSONB,
    "previewAudioRole" TEXT,
    "previewImageJson" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "study_card_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "study_card_drafts_userId_updatedAt_id_idx" ON "study_card_drafts"("userId", "updatedAt", "id");

-- CreateIndex
CREATE INDEX "study_card_drafts_userId_status_updatedAt_idx" ON "study_card_drafts"("userId", "status", "updatedAt");

-- AddForeignKey
ALTER TABLE "study_card_drafts" ADD CONSTRAINT "study_card_drafts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add constraints after creation so the allowed values stay visible in migration history.
ALTER TABLE "study_card_drafts"
  ADD CONSTRAINT "study_card_drafts_status_check"
  CHECK ("status" IN ('generating', 'ready', 'error'));

ALTER TABLE "study_card_drafts"
  ADD CONSTRAINT "study_card_drafts_card_type_check"
  CHECK ("cardType" IN ('recognition', 'production', 'cloze'));

ALTER TABLE "study_card_drafts"
  ADD CONSTRAINT "study_card_drafts_image_placement_check"
  CHECK ("imagePlacement" IN ('none', 'prompt', 'answer', 'both'));
