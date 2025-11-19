-- DropIndex (conditional)
DROP INDEX IF EXISTS "Lesson_courseId_order_key";

-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "speaker1VoiceId" TEXT,
ADD COLUMN     "speaker2VoiceId" TEXT;
