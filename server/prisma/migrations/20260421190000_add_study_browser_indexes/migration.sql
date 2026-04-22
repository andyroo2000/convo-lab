-- Improve study browser list/filter query performance.
CREATE INDEX "study_notes_userId_updatedAt_id_idx"
ON "study_notes"("userId", "updatedAt", "id");

CREATE INDEX "study_notes_userId_sourceNotetypeName_updatedAt_id_idx"
ON "study_notes"("userId", "sourceNotetypeName", "updatedAt", "id");

CREATE INDEX "study_cards_userId_noteId_cardType_idx"
ON "study_cards"("userId", "noteId", "cardType");

CREATE INDEX "study_cards_userId_noteId_queueState_idx"
ON "study_cards"("userId", "noteId", "queueState");
