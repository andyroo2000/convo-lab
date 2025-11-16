-- Add speaker gender fields to Course table
ALTER TABLE "Course" ADD COLUMN "speaker1Gender" TEXT NOT NULL DEFAULT 'male';
ALTER TABLE "Course" ADD COLUMN "speaker2Gender" TEXT NOT NULL DEFAULT 'female';
