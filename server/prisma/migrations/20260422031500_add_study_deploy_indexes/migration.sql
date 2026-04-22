CREATE INDEX "study_import_jobs_userId_status_idx"
ON "study_import_jobs"("userId", "status");

CREATE INDEX "study_cards_userId_lastReviewedAt_idx"
ON "study_cards"("userId", "lastReviewedAt");
