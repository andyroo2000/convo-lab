import { Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { prisma } from '../db/client.js';
import { generateNarrowListeningPack } from '../services/narrowListeningGenerator.js';
import { generateNarrowListeningAudio } from '../services/narrowListeningAudioGenerator.js';
import { TTS_VOICES } from '../../../shared/src/constants.js';

const connection = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
});

export const narrowListeningQueue = new Queue('narrow-listening-generation', { connection });

/**
 * Process narrow listening pack generation job
 */
async function processNarrowListeningGeneration(job: any) {
  const { packId, topic, jlptLevel, versionCount, grammarFocus } = job.data;

  try {
    console.log(`Starting narrow listening pack generation for pack ${packId}`);

    // Update pack status
    await prisma.narrowListeningPack.update({
      where: { id: packId },
      data: { status: 'generating' },
    });

    await job.updateProgress(5);

    // STEP 1: Generate story content using Gemini
    console.log(`Generating story content with Gemini...`);
    const storyPack = await generateNarrowListeningPack(
      topic,
      jlptLevel,
      versionCount,
      grammarFocus
    );

    console.log(`Generated story: "${storyPack.title}" with ${storyPack.versions.length} versions`);

    // Update pack title
    await prisma.narrowListeningPack.update({
      where: { id: packId },
      data: { title: storyPack.title },
    });

    await job.updateProgress(20);

    // STEP 2: Create StoryVersion and StorySegment records
    const japaneseVoices = TTS_VOICES.ja.voices;
    const progressPerVersion = 70 / storyPack.versions.length; // 70% total for all versions (20% to 90%)

    for (let i = 0; i < storyPack.versions.length; i++) {
      const version = storyPack.versions[i];
      const baseProgress = 20 + (i * progressPerVersion);

      console.log(`Processing version ${i + 1}/${storyPack.versions.length}: ${version.title}`);

      // Select a random Japanese voice for this version
      const randomVoice = japaneseVoices[Math.floor(Math.random() * japaneseVoices.length)];
      const voiceId = randomVoice.id;

      console.log(`Selected voice: ${randomVoice.description} (${voiceId})`);

      // Use segments directly from Gemini (already have correct translations)
      const segmentData = version.segments.map(seg => ({
        text: seg.japaneseText,
        translation: seg.englishTranslation,
      }));

      console.log(`Using ${segmentData.length} segments from Gemini`);

      await job.updateProgress(baseProgress + (progressPerVersion * 0.2));

      // STEP 3: Generate 0.7x speed audio for this version
      console.log(`Generating 0.7x audio for version ${i + 1}...`);
      const audioResult = await generateNarrowListeningAudio(
        packId,
        segmentData,
        voiceId,
        0.7,
        i
      );

      console.log(`Audio generated: ${audioResult.combinedAudioUrl}`);

      await job.updateProgress(baseProgress + (progressPerVersion * 0.7));

      // STEP 4: Create database records
      const storyVersion = await prisma.storyVersion.create({
        data: {
          packId,
          variationType: version.variationType,
          title: version.title,
          voiceId,
          order: i,
          audioUrl_0_7: audioResult.combinedAudioUrl,
          audioUrl_1_0: null, // Will be generated on demand
        },
      });

      console.log(`Created StoryVersion record: ${storyVersion.id}`);

      // Create segment records
      await prisma.storySegment.createMany({
        data: audioResult.segments.map((seg: any, segIdx: number) => ({
          versionId: storyVersion.id,
          order: segIdx,
          japaneseText: seg.text,
          englishTranslation: seg.translation,
          reading: seg.reading || null,
          audioUrl_0_7: seg.audioUrl || null,
          startTime_0_7: seg.startTime,
          endTime_0_7: seg.endTime,
          audioUrl_1_0: null,
          startTime_1_0: null,
          endTime_1_0: null,
        })),
      });

      console.log(`Created ${audioResult.segments.length} StorySegment records`);

      await job.updateProgress(baseProgress + progressPerVersion);
    }

    // STEP 5: Update pack status to ready
    await prisma.narrowListeningPack.update({
      where: { id: packId },
      data: { status: 'ready' },
    });

    await job.updateProgress(100);

    console.log(`✅ Narrow listening pack generation complete: ${packId}`);

    return {
      packId,
      title: storyPack.title,
      versionCount: storyPack.versions.length,
    };
  } catch (error: any) {
    console.error(`❌ Error generating narrow listening pack ${packId}:`, error);

    // Update pack status to error
    await prisma.narrowListeningPack.update({
      where: { id: packId },
      data: {
        status: 'error',
      },
    });

    throw error;
  }
}

/**
 * Process normal speed (1.0x) audio generation job
 */
async function processNormalSpeedGeneration(job: any) {
  const { packId } = job.data;

  try {
    console.log(`Generating 1.0x speed audio for pack ${packId}`);

    // Get pack with versions and segments
    const pack = await prisma.narrowListeningPack.findUnique({
      where: { id: packId },
      include: {
        versions: {
          include: {
            segments: {
              orderBy: { order: 'asc' },
            },
          },
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!pack) {
      throw new Error('Pack not found');
    }

    const progressPerVersion = 100 / pack.versions.length;

    for (let i = 0; i < pack.versions.length; i++) {
      const version = pack.versions[i];

      // Skip if already has 1.0x audio
      if (version.audioUrl_1_0) {
        console.log(`Version ${i + 1} already has 1.0x audio, skipping`);
        await job.updateProgress((i + 1) * progressPerVersion);
        continue;
      }

      console.log(`Generating 1.0x audio for version ${i + 1}/${pack.versions.length}`);

      // Use existing segment data from database
      const segmentData = version.segments.map(seg => ({
        text: seg.japaneseText,
        translation: seg.englishTranslation,
      }));

      // Generate normal speed audio
      const audioResult = await generateNarrowListeningAudio(
        packId,
        segmentData,
        version.voiceId,
        1.0,
        i
      );

      // Update version with 1.0x audio URL
      await prisma.storyVersion.update({
        where: { id: version.id },
        data: { audioUrl_1_0: audioResult.combinedAudioUrl },
      });

      // Update segments with 1.0x timing data
      for (let segIdx = 0; segIdx < audioResult.segments.length; segIdx++) {
        const seg = audioResult.segments[segIdx];
        await prisma.storySegment.update({
          where: { id: version.segments[segIdx].id },
          data: {
            audioUrl_1_0: seg.audioUrl || null,
            startTime_1_0: seg.startTime,
            endTime_1_0: seg.endTime,
          },
        });
      }

      console.log(`✅ Generated 1.0x audio for version ${i + 1}`);
      await job.updateProgress((i + 1) * progressPerVersion);
    }

    console.log(`✅ Normal speed audio generation complete for pack ${packId}`);

    return {
      packId,
      versionsUpdated: pack.versions.length,
    };
  } catch (error: any) {
    console.error(`❌ Error generating normal speed audio for pack ${packId}:`, error);
    throw error;
  }
}

// Create worker
export const narrowListeningWorker = new Worker(
  'narrow-listening-generation',
  async (job) => {
    if (job.name === 'generate-narrow-listening') {
      return processNarrowListeningGeneration(job);
    } else if (job.name === 'generate-normal-speed') {
      return processNormalSpeedGeneration(job);
    } else {
      throw new Error(`Unknown job type: ${job.name}`);
    }
  },
  {
    connection,
    concurrency: 1, // Process one pack at a time to avoid overwhelming TTS/LLM
  }
);

narrowListeningWorker.on('completed', (job) => {
  console.log(`✅ Job ${job.id} completed`);
});

narrowListeningWorker.on('failed', (job, err) => {
  console.error(`❌ Job ${job?.id} failed:`, err);
});
