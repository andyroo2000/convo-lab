-- CreateTable
CREATE TABLE "ChunkPack" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "theme" TEXT NOT NULL,
    "jlptLevel" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChunkPack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Chunk" (
    "id" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "form" TEXT NOT NULL,
    "translation" TEXT NOT NULL,
    "literalGloss" TEXT,
    "register" TEXT NOT NULL,
    "function" TEXT NOT NULL,
    "notes" TEXT NOT NULL,

    CONSTRAINT "Chunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChunkExample" (
    "id" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "chunkId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "sentence" TEXT NOT NULL,
    "english" TEXT NOT NULL,
    "contextNote" TEXT,
    "audioUrl" TEXT,

    CONSTRAINT "ChunkExample_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChunkStory" (
    "id" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "storyText" TEXT NOT NULL,
    "english" TEXT NOT NULL,
    "audioUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChunkStory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChunkStorySegment" (
    "id" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "japaneseText" TEXT NOT NULL,
    "englishTranslation" TEXT NOT NULL,
    "audioUrl" TEXT,
    "startTime" INTEGER,
    "endTime" INTEGER,

    CONSTRAINT "ChunkStorySegment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChunkExercise" (
    "id" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "exerciseType" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "options" JSONB NOT NULL,
    "correctOption" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "audioUrl" TEXT,

    CONSTRAINT "ChunkExercise_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChunkPack_userId_idx" ON "ChunkPack"("userId");

-- CreateIndex
CREATE INDEX "ChunkPack_status_idx" ON "ChunkPack"("status");

-- CreateIndex
CREATE INDEX "ChunkPack_jlptLevel_idx" ON "ChunkPack"("jlptLevel");

-- CreateIndex
CREATE INDEX "Chunk_packId_idx" ON "Chunk"("packId");

-- CreateIndex
CREATE INDEX "Chunk_order_idx" ON "Chunk"("order");

-- CreateIndex
CREATE INDEX "ChunkExample_packId_idx" ON "ChunkExample"("packId");

-- CreateIndex
CREATE INDEX "ChunkExample_chunkId_idx" ON "ChunkExample"("chunkId");

-- CreateIndex
CREATE INDEX "ChunkExample_order_idx" ON "ChunkExample"("order");

-- CreateIndex
CREATE INDEX "ChunkStory_packId_idx" ON "ChunkStory"("packId");

-- CreateIndex
CREATE INDEX "ChunkStorySegment_storyId_idx" ON "ChunkStorySegment"("storyId");

-- CreateIndex
CREATE INDEX "ChunkStorySegment_order_idx" ON "ChunkStorySegment"("order");

-- CreateIndex
CREATE INDEX "ChunkExercise_packId_idx" ON "ChunkExercise"("packId");

-- CreateIndex
CREATE INDEX "ChunkExercise_order_idx" ON "ChunkExercise"("order");

-- AddForeignKey
ALTER TABLE "ChunkPack" ADD CONSTRAINT "ChunkPack_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chunk" ADD CONSTRAINT "Chunk_packId_fkey" FOREIGN KEY ("packId") REFERENCES "ChunkPack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChunkExample" ADD CONSTRAINT "ChunkExample_packId_fkey" FOREIGN KEY ("packId") REFERENCES "ChunkPack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChunkExample" ADD CONSTRAINT "ChunkExample_chunkId_fkey" FOREIGN KEY ("chunkId") REFERENCES "Chunk"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChunkStory" ADD CONSTRAINT "ChunkStory_packId_fkey" FOREIGN KEY ("packId") REFERENCES "ChunkPack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChunkStorySegment" ADD CONSTRAINT "ChunkStorySegment_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "ChunkStory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChunkExercise" ADD CONSTRAINT "ChunkExercise_packId_fkey" FOREIGN KEY ("packId") REFERENCES "ChunkPack"("id") ON DELETE CASCADE ON UPDATE CASCADE;
