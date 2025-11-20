/*
  Warnings:

  - You are about to drop the column `useDraftMode` on the `Course` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Lesson_courseId_order_key";

-- AlterTable
ALTER TABLE "Course" DROP COLUMN "useDraftMode";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "avatarColor" TEXT DEFAULT 'indigo',
ADD COLUMN     "displayName" TEXT;

-- CreateTable
CREATE TABLE "NarrowListeningPack" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "jlptLevel" TEXT NOT NULL,
    "grammarFocus" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NarrowListeningPack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoryVersion" (
    "id" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "variationType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "voiceId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "audioUrl_0_7" TEXT,
    "audioUrl_0_85" TEXT,
    "audioUrl_1_0" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoryVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StorySegment" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "japaneseText" TEXT NOT NULL,
    "englishTranslation" TEXT NOT NULL,
    "reading" TEXT,
    "audioUrl_0_7" TEXT,
    "audioUrl_0_85" TEXT,
    "audioUrl_1_0" TEXT,
    "startTime_0_7" INTEGER,
    "endTime_0_7" INTEGER,
    "startTime_0_85" INTEGER,
    "endTime_0_85" INTEGER,
    "startTime_1_0" INTEGER,
    "endTime_1_0" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StorySegment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NarrowListeningPack_userId_idx" ON "NarrowListeningPack"("userId");

-- CreateIndex
CREATE INDEX "NarrowListeningPack_status_idx" ON "NarrowListeningPack"("status");

-- CreateIndex
CREATE INDEX "StoryVersion_packId_idx" ON "StoryVersion"("packId");

-- CreateIndex
CREATE INDEX "StoryVersion_order_idx" ON "StoryVersion"("order");

-- CreateIndex
CREATE INDEX "StorySegment_versionId_idx" ON "StorySegment"("versionId");

-- CreateIndex
CREATE INDEX "StorySegment_order_idx" ON "StorySegment"("order");

-- AddForeignKey
ALTER TABLE "NarrowListeningPack" ADD CONSTRAINT "NarrowListeningPack_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoryVersion" ADD CONSTRAINT "StoryVersion_packId_fkey" FOREIGN KEY ("packId") REFERENCES "NarrowListeningPack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StorySegment" ADD CONSTRAINT "StorySegment_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "StoryVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
