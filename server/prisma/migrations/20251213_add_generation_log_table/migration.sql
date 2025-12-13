-- CreateTable
CREATE TABLE "generation_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "contentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "generation_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "generation_logs_userId_idx" ON "generation_logs"("userId");

-- CreateIndex
CREATE INDEX "generation_logs_userId_createdAt_idx" ON "generation_logs"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "generation_logs" ADD CONSTRAINT "generation_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
