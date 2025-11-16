-- Add unique constraint to prevent duplicate lessons with same order
CREATE UNIQUE INDEX "Lesson_courseId_order_key" ON "Lesson"("courseId", "order");
