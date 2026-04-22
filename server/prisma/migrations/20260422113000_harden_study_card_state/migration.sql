UPDATE "study_cards"
SET "scheduler_state_json" = jsonb_build_object(
  'due',
  to_char(timezone('UTC', COALESCE("due_at", now())), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
  'stability',
  -- Imported SM-2 intervals seed FSRS stability, with a small non-zero floor for legacy rows.
  GREATEST(COALESCE("source_interval"::double precision, 0.1), 0.1),
  'difficulty',
  -- Imported cards fall back to a neutral FSRS difficulty when no source FSRS value exists.
  5,
  'elapsed_days',
  CASE
    WHEN "last_reviewed_at" IS NULL THEN 0
    ELSE GREATEST(
      0,
      FLOOR(EXTRACT(EPOCH FROM (now() - "last_reviewed_at")) / 86400)
    )::int
  END,
  'scheduled_days',
  GREATEST(COALESCE("source_interval", 0), 0),
  'learning_steps',
  0,
  'reps',
  GREATEST(COALESCE("source_reps", 0), 0),
  'lapses',
  GREATEST(COALESCE("source_lapses", 0), 0),
  'state',
  CASE "queue_state"
    WHEN 'new' THEN 0
    WHEN 'learning' THEN 1
    WHEN 'relearning' THEN 3
    ELSE 2
  END,
  'last_review',
  CASE
    WHEN "last_reviewed_at" IS NULL THEN NULL
    ELSE to_char(timezone('UTC', "last_reviewed_at"), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  END
)
WHERE "scheduler_state_json" IS NULL;

ALTER TABLE "study_cards"
ALTER COLUMN "scheduler_state_json" SET NOT NULL;

ALTER TABLE "study_cards"
ADD CONSTRAINT "study_cards_queue_state_check"
CHECK (
  "queue_state" IN (
    'new',
    'learning',
    'review',
    'relearning',
    'suspended',
    'buried'
  )
);
