-- AlterTable
ALTER TABLE "Course" ADD COLUMN "scriptUnitsJson" JSONB;

-- CreateTable
CREATE TABLE "line_audio_renderings" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "unitIndex" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "speed" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "voiceId" TEXT NOT NULL,
    "audioUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "line_audio_renderings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "line_audio_renderings_courseId_unitIndex_idx" ON "line_audio_renderings"("courseId", "unitIndex");

-- AddForeignKey
ALTER TABLE "line_audio_renderings" ADD CONSTRAINT "line_audio_renderings_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
