ALTER TABLE "feature_flags"
  ADD COLUMN "studyApiSettingsWrite" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "studyApiNewQueueWrite" BOOLEAN NOT NULL DEFAULT false;
