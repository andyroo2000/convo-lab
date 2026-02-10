-- CreateTable
CREATE TABLE "sentence_script_tests" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sentence" TEXT NOT NULL,
    "translation" TEXT,
    "targetLanguage" TEXT NOT NULL DEFAULT 'ja',
    "nativeLanguage" TEXT NOT NULL DEFAULT 'en',
    "jlptLevel" TEXT,
    "l1VoiceId" TEXT NOT NULL,
    "l2VoiceId" TEXT NOT NULL,
    "promptTemplate" TEXT NOT NULL,
    "unitsJson" JSONB,
    "rawResponse" TEXT NOT NULL,
    "estimatedDurationSecs" DOUBLE PRECISION,
    "parseError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sentence_script_tests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sentence_script_tests_userId_createdAt_idx" ON "sentence_script_tests"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "sentence_script_tests_createdAt_idx" ON "sentence_script_tests"("createdAt");

-- CreateIndex
CREATE INDEX "sentence_script_tests_sentence_idx" ON "sentence_script_tests"("sentence");
