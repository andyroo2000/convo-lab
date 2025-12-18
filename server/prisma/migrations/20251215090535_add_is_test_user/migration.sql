-- AlterTable
ALTER TABLE "User" ADD COLUMN "isTestUser" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "User_isTestUser_idx" ON "User"("isTestUser");
