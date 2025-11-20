-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "hskLevel" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "pinyinDisplayMode" TEXT NOT NULL DEFAULT 'toneMarks',
ADD COLUMN     "preferredNativeLanguage" TEXT NOT NULL DEFAULT 'en',
ADD COLUMN     "preferredStudyLanguage" TEXT NOT NULL DEFAULT 'ja';
