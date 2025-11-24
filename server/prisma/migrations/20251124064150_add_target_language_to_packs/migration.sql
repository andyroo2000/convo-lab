-- AlterTable
ALTER TABLE "ChunkPack" ADD COLUMN     "targetLanguage" TEXT NOT NULL DEFAULT 'ja';

-- AlterTable
ALTER TABLE "NarrowListeningPack" ADD COLUMN     "targetLanguage" TEXT NOT NULL DEFAULT 'ja';
