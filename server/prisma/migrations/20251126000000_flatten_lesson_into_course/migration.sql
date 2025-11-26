-- Flatten Lesson into Course
-- This migration removes the Lesson model and moves its fields directly to Course

-- Step 1: Add new columns to Course
ALTER TABLE "Course" ADD COLUMN "scriptJson" JSONB;
ALTER TABLE "Course" ADD COLUMN "approxDurationSeconds" INTEGER;
ALTER TABLE "Course" ADD COLUMN "audioUrl" TEXT;

-- Step 2: Migrate data from Lesson to Course (take the first lesson for each course)
UPDATE "Course" c
SET
  "scriptJson" = l."scriptJson",
  "approxDurationSeconds" = l."approxDurationSeconds",
  "audioUrl" = l."audioUrl"
FROM "Lesson" l
WHERE l."courseId" = c."id";

-- Step 3: Add courseId column to LessonCoreItem
ALTER TABLE "LessonCoreItem" ADD COLUMN "courseId" TEXT;

-- Step 4: Populate courseId from the Lesson table
UPDATE "LessonCoreItem" lci
SET "courseId" = l."courseId"
FROM "Lesson" l
WHERE lci."lessonId" = l."id";

-- Step 5: Drop the foreign key constraint on lessonId
ALTER TABLE "LessonCoreItem" DROP CONSTRAINT "LessonCoreItem_lessonId_fkey";

-- Step 6: Drop the lessonId column and index
DROP INDEX "LessonCoreItem_lessonId_idx";
ALTER TABLE "LessonCoreItem" DROP COLUMN "lessonId";

-- Step 7: Rename table to CourseCoreItem
ALTER TABLE "LessonCoreItem" RENAME TO "CourseCoreItem";

-- Step 8: Add foreign key constraint for courseId
ALTER TABLE "CourseCoreItem" ADD CONSTRAINT "CourseCoreItem_courseId_fkey"
  FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 9: Create index on courseId
CREATE INDEX "CourseCoreItem_courseId_idx" ON "CourseCoreItem"("courseId");

-- Step 10: Drop Lesson table (this will also drop its indexes and foreign keys)
DROP TABLE "Lesson";
