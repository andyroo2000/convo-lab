UPDATE "study_cards"
SET "schedulerStateJson" = jsonb_build_object(
  'due',
  to_char(timezone('UTC', COALESCE("dueAt", now())), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
  'stability',
  -- Imported SM-2 intervals seed FSRS stability, with a small non-zero floor for legacy rows.
  GREATEST(COALESCE("sourceInterval"::double precision, 0.1), 0.1),
  'difficulty',
  -- Imported cards fall back to a neutral FSRS difficulty when no source FSRS value exists.
  5,
  'elapsed_days',
  CASE
    WHEN "lastReviewedAt" IS NULL THEN 0
    ELSE GREATEST(
      0,
      FLOOR(EXTRACT(EPOCH FROM (now() - "lastReviewedAt")) / 86400)
    )::int
  END,
  'scheduled_days',
  GREATEST(COALESCE("sourceInterval", 0), 0),
  'learning_steps',
  0,
  'reps',
  GREATEST(COALESCE("sourceReps", 0), 0),
  'lapses',
  GREATEST(COALESCE("sourceLapses", 0), 0),
  'state',
  CASE "queueState"
    WHEN 'new' THEN 0
    WHEN 'learning' THEN 1
    WHEN 'relearning' THEN 3
    ELSE 2
  END,
  'last_review',
  CASE
    WHEN "lastReviewedAt" IS NULL THEN NULL
    ELSE to_char(timezone('UTC', "lastReviewedAt"), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  END
)
WHERE "schedulerStateJson" IS NULL;

ALTER TABLE "study_cards"
ALTER COLUMN "schedulerStateJson" SET NOT NULL;

ALTER TABLE "study_cards"
ADD CONSTRAINT "study_cards_queue_state_check"
CHECK (
  "queueState" IN (
    'new',
    'learning',
    'review',
    'relearning',
    'suspended',
    'buried'
  )
);
