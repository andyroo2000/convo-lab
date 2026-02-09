-- AlterTable
ALTER TABLE "Course" ADD COLUMN "isTestCourse" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Course_isTestCourse_idx" ON "Course"("isTestCourse");
