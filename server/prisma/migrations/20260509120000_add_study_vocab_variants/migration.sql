CREATE TABLE "study_variant_groups" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "targetWord" TEXT NOT NULL,
  "targetReading" TEXT,
  "targetMeaning" TEXT,
  "sourceSentence" TEXT,
  "sourceContext" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "study_variant_groups_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "study_variant_sentences" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "variantGroupId" TEXT NOT NULL,
  "ordinal" INTEGER NOT NULL,
  "sentenceJp" TEXT NOT NULL,
  "sentenceReading" TEXT,
  "sentenceEn" TEXT NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "study_variant_sentences_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "study_cards"
ADD COLUMN "variantGroupId" TEXT,
ADD COLUMN "variantSentenceId" TEXT,
ADD COLUMN "variantKind" TEXT,
ADD COLUMN "variantStage" INTEGER,
ADD COLUMN "variantStatus" TEXT,
ADD COLUMN "variantUnlockedAt" TIMESTAMP(3);

ALTER TABLE "study_card_drafts"
ADD COLUMN "variantGroupId" TEXT,
ADD COLUMN "variantSentenceId" TEXT,
ADD COLUMN "variantKind" TEXT,
ADD COLUMN "variantStage" INTEGER,
ADD COLUMN "variantStatus" TEXT,
ADD COLUMN "variantUnlockedAt" TIMESTAMP(3);

ALTER TABLE "study_variant_groups"
ADD CONSTRAINT "study_variant_groups_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "study_variant_sentences"
ADD CONSTRAINT "study_variant_sentences_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "study_variant_sentences"
ADD CONSTRAINT "study_variant_sentences_variantGroupId_fkey"
FOREIGN KEY ("variantGroupId") REFERENCES "study_variant_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "study_cards"
ADD CONSTRAINT "study_cards_variantGroupId_fkey"
FOREIGN KEY ("variantGroupId") REFERENCES "study_variant_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "study_cards"
ADD CONSTRAINT "study_cards_variantSentenceId_fkey"
FOREIGN KEY ("variantSentenceId") REFERENCES "study_variant_sentences"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "study_card_drafts"
ADD CONSTRAINT "study_card_drafts_variantGroupId_fkey"
FOREIGN KEY ("variantGroupId") REFERENCES "study_variant_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "study_card_drafts"
ADD CONSTRAINT "study_card_drafts_variantSentenceId_fkey"
FOREIGN KEY ("variantSentenceId") REFERENCES "study_variant_sentences"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "study_cards"
ADD CONSTRAINT "study_cards_variant_status_check"
CHECK ("variantStatus" IS NULL OR "variantStatus" IN ('available', 'locked'));

ALTER TABLE "study_card_drafts"
ADD CONSTRAINT "study_card_drafts_variant_status_check"
CHECK ("variantStatus" IS NULL OR "variantStatus" IN ('available', 'locked'));

ALTER TABLE "study_cards"
ADD CONSTRAINT "study_cards_variant_kind_check"
CHECK (
  "variantKind" IS NULL OR "variantKind" IN (
    'sentence_audio_recognition',
    'sentence_text_recognition',
    'word_audio_recognition',
    'word_text_recognition',
    'sentence_cloze'
  )
);

ALTER TABLE "study_card_drafts"
ADD CONSTRAINT "study_card_drafts_variant_kind_check"
CHECK (
  "variantKind" IS NULL OR "variantKind" IN (
    'sentence_audio_recognition',
    'sentence_text_recognition',
    'word_audio_recognition',
    'word_text_recognition',
    'sentence_cloze'
  )
);

CREATE UNIQUE INDEX "study_variant_sentences_variantGroupId_ordinal_key"
ON "study_variant_sentences"("variantGroupId", "ordinal");

CREATE INDEX "study_variant_groups_userId_createdAt_idx"
ON "study_variant_groups"("userId", "createdAt");

CREATE INDEX "study_variant_groups_userId_targetWord_idx"
ON "study_variant_groups"("userId", "targetWord");

CREATE INDEX "study_variant_sentences_userId_variantGroupId_idx"
ON "study_variant_sentences"("userId", "variantGroupId");

CREATE INDEX "study_cards_userId_variantStatus_queueState_newQueuePosition_idx"
ON "study_cards"("userId", "variantStatus", "queueState", "newQueuePosition");

CREATE INDEX "study_cards_variantGroupId_variantStage_idx"
ON "study_cards"("variantGroupId", "variantStage");

CREATE INDEX "study_cards_variantSentenceId_idx"
ON "study_cards"("variantSentenceId");

CREATE INDEX "study_card_drafts_userId_createdAt_id_idx"
ON "study_card_drafts"("userId", "createdAt", "id");

CREATE INDEX "study_card_drafts_variantGroupId_idx"
ON "study_card_drafts"("variantGroupId");

CREATE INDEX "study_card_drafts_variantSentenceId_idx"
ON "study_card_drafts"("variantSentenceId");
