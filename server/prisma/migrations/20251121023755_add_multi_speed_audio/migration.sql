-- AlterTable
ALTER TABLE "Episode" ADD COLUMN     "audioUrl_0_7" TEXT,
ADD COLUMN     "audioUrl_0_85" TEXT,
ADD COLUMN     "audioUrl_1_0" TEXT;

-- AlterTable
ALTER TABLE "Sentence" ADD COLUMN     "endTime_0_7" INTEGER,
ADD COLUMN     "endTime_0_85" INTEGER,
ADD COLUMN     "endTime_1_0" INTEGER,
ADD COLUMN     "startTime_0_7" INTEGER,
ADD COLUMN     "startTime_0_85" INTEGER,
ADD COLUMN     "startTime_1_0" INTEGER;
