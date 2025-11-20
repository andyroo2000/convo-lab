import { Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { prisma } from '../db/client.js';
import { generateChunkPack } from '../services/chunkPackGenerator.js';
import {
  generateExampleAudio,
  generateStoryAudio,
  generateExerciseAudio,
} from '../services/chunkPackAudioGenerator.js';
import { ChunkPackJobData, ChunkPackJobResult } from '../types/chunkPack.js';

const connection = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  enableOfflineQueue: false,
  // Enable TLS for Upstash
  tls: process.env.REDIS_HOST?.includes('upstash.io') ? {} : undefined,
});

export const chunkPackQueue = new Queue('chunk-pack-generation', { connection });

/**
 * Process chunk pack generation job
 */
async function processChunkPackGeneration(job: any) {
  const { userId, jlptLevel, theme }: ChunkPackJobData = job.data;
  let packId: string | null = null;

  try {
    console.log(`Starting chunk pack generation: ${jlptLevel} ${theme}`);

    await job.updateProgress(5);

    // STEP 1: Generate chunk pack content using Gemini
    console.log(`Generating chunk pack content with Gemini...`);
    const generated = await generateChunkPack(jlptLevel, theme);

    console.log(`Generated pack: "${generated.title}" with ${generated.chunks.length} chunks`);

    await job.updateProgress(20);

    // STEP 2: Create database records
    console.log(`Creating database records...`);

    const pack = await prisma.chunkPack.create({
      data: {
        userId,
        title: generated.title,
        theme,
        jlptLevel,
        status: 'generating',
      },
    });

    packId = pack.id;
    console.log(`Created pack with ID: ${packId}`);

    await job.updateProgress(25);

    // Create chunks
    for (let i = 0; i < generated.chunks.length; i++) {
      const chunkData = generated.chunks[i];
      await prisma.chunk.create({
        data: {
          packId: pack.id,
          order: i,
          form: chunkData.form,
          translation: chunkData.translation,
          literalGloss: chunkData.literalGloss || null,
          register: chunkData.register,
          function: chunkData.function,
          notes: chunkData.notes,
        },
      });
    }

    console.log(`Created ${generated.chunks.length} chunks`);
    await job.updateProgress(30);

    // STEP 3: Generate audio for examples
    console.log(`Generating audio for ${generated.examples.length} examples...`);
    const exampleAudioUrls = await generateExampleAudio(pack.id, generated.examples);

    await job.updateProgress(50);

    // Create example records with audio URLs
    const chunks = await prisma.chunk.findMany({
      where: { packId: pack.id },
      orderBy: { order: 'asc' },
    });

    for (let i = 0; i < generated.examples.length; i++) {
      const exampleData = generated.examples[i];

      // Find the chunk this example belongs to
      const chunk = chunks.find(c => c.form === exampleData.chunkForm);
      if (!chunk) {
        console.warn(`Could not find chunk for example: ${exampleData.chunkForm}`);
        continue;
      }

      const audioData = exampleAudioUrls.get(exampleData.sentence);
      await prisma.chunkExample.create({
        data: {
          packId: pack.id,
          chunkId: chunk.id,
          order: i,
          sentence: exampleData.sentence,
          english: exampleData.english,
          contextNote: exampleData.contextNote || null,
          audioUrl: audioData?.audioUrl_0_85 || null, // Legacy field, use 0.85x
          audioUrl_0_7: audioData?.audioUrl_0_7 || null,
          audioUrl_0_85: audioData?.audioUrl_0_85 || null,
          audioUrl_1_0: audioData?.audioUrl_1_0 || null,
        },
      });
    }

    console.log(`Created ${generated.examples.length} examples`);
    await job.updateProgress(55);

    // STEP 4: Generate audio for stories
    console.log(`Generating audio for ${generated.stories.length} stories...`);

    for (let storyIndex = 0; storyIndex < generated.stories.length; storyIndex++) {
      const storyData = generated.stories[storyIndex];

      console.log(`Generating audio for story: ${storyData.title}`);

      // Generate audio with timings
      const storyAudio = await generateStoryAudio(pack.id, storyIndex, storyData.segments);

      // Create story record
      const story = await prisma.chunkStory.create({
        data: {
          packId: pack.id,
          title: storyData.title,
          type: storyData.type,
          storyText: storyData.storyText,
          english: storyData.english,
          audioUrl: storyAudio.combinedAudioUrl,
        },
      });

      // Create segment records with audio URLs and timings
      for (let segIndex = 0; segIndex < storyData.segments.length; segIndex++) {
        const segmentData = storyData.segments[segIndex];
        const segmentAudio = storyAudio.segmentAudioData[segIndex];

        await prisma.chunkStorySegment.create({
          data: {
            storyId: story.id,
            order: segIndex,
            japaneseText: segmentData.japaneseText,
            englishTranslation: segmentData.englishTranslation,
            audioUrl: segmentAudio.audioUrl,
            startTime: segmentAudio.startTime,
            endTime: segmentAudio.endTime,
          },
        });
      }

      console.log(`Created story "${storyData.title}" with ${storyData.segments.length} segments`);
    }

    await job.updateProgress(75);

    // STEP 5: Generate audio for gap-fill exercises
    console.log(`Generating audio for exercises...`);
    const exerciseAudioUrls = await generateExerciseAudio(pack.id, generated.exercises);

    await job.updateProgress(80);

    // Create exercise records
    for (let i = 0; i < generated.exercises.length; i++) {
      const exerciseData = generated.exercises[i];

      await prisma.chunkExercise.create({
        data: {
          packId: pack.id,
          order: i,
          exerciseType: exerciseData.exerciseType,
          prompt: exerciseData.prompt,
          options: exerciseData.options,
          correctOption: exerciseData.correctOption,
          explanation: exerciseData.explanation,
          audioUrl: exerciseAudioUrls.get(exerciseData.prompt) || null,
        },
      });
    }

    console.log(`Created ${generated.exercises.length} exercises`);
    await job.updateProgress(90);

    // STEP 6: Mark pack as ready
    await prisma.chunkPack.update({
      where: { id: pack.id },
      data: { status: 'ready' },
    });

    console.log(`Chunk pack ${pack.id} generation complete!`);
    await job.updateProgress(100);

    return {
      packId: pack.id,
      status: 'completed' as const,
    };
  } catch (error: any) {
    console.error('Error generating chunk pack:', error);

    // Mark pack as error if it was created
    if (packId) {
      await prisma.chunkPack.update({
        where: { id: packId },
        data: { status: 'error' },
      });
    }

    return {
      packId: packId || '',
      status: 'error' as const,
      error: error.message,
    };
  }
}

// Create worker
export const chunkPackWorker = new Worker('chunk-pack-generation', processChunkPackGeneration, {
  connection,
  concurrency: 1, // Process one at a time to avoid resource contention
});

chunkPackWorker.on('completed', (job) => {
  console.log(`Chunk pack job ${job.id} completed`);
});

chunkPackWorker.on('failed', (job, err) => {
  console.error(`Chunk pack job ${job?.id} failed:`, err);
});

console.log('Chunk pack worker started');
