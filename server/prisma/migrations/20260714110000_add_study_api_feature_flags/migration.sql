ALTER TABLE "feature_flags"
  ADD COLUMN "studyApiEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "studyApiSettings" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "studyApiOverview" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "studyApiBrowser" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "studyApiNewQueue" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "studyApiImports" BOOLEAN NOT NULL DEFAULT false;
