-- AlterTable
ALTER TABLE "User" ADD COLUMN     "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "proficiencyLevel" TEXT NOT NULL DEFAULT 'beginner';
