ALTER TABLE "study_cards"
ADD COLUMN "failedAt" TIMESTAMP(3);

WITH latest_convolab_review AS (
  SELECT DISTINCT ON ("cardId")
    "cardId",
    "rating",
    "reviewedAt"
  FROM "study_review_logs"
  WHERE "source" = 'convolab'
  ORDER BY "cardId", "reviewedAt" DESC, "id" DESC
)
UPDATE "study_cards" AS card
SET "failedAt" = latest."reviewedAt"
FROM latest_convolab_review AS latest
WHERE card."id" = latest."cardId"
  AND latest."rating" = 1;

CREATE INDEX "study_cards_userId_failedAt_idx"
ON "study_cards"("userId", "failedAt");
