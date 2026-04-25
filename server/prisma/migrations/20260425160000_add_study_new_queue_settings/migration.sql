CREATE TABLE "study_settings" (
    "userId" TEXT NOT NULL,
    "newCardsPerDay" INTEGER NOT NULL DEFAULT 20,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "study_settings_pkey" PRIMARY KEY ("userId")
);

ALTER TABLE "study_settings"
ADD CONSTRAINT "study_settings_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "study_cards"
ADD COLUMN "introducedAt" TIMESTAMP(3),
ADD COLUMN "newQueuePosition" INTEGER;

WITH ordered_new_cards AS (
    SELECT
        "id",
        ROW_NUMBER() OVER (
            PARTITION BY "userId"
            ORDER BY "sourceDue" ASC NULLS LAST, "createdAt" ASC, "id" ASC
        ) AS position
    FROM "study_cards"
    WHERE "queueState" = 'new'
)
UPDATE "study_cards" AS card
SET "newQueuePosition" = ordered_new_cards.position
FROM ordered_new_cards
WHERE card."id" = ordered_new_cards."id";

CREATE INDEX "study_cards_userId_queueState_newQueuePosition_idx"
ON "study_cards"("userId", "queueState", "newQueuePosition");

CREATE INDEX "study_cards_userId_introducedAt_idx"
ON "study_cards"("userId", "introducedAt");
