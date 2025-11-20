import { Queue, Worker } from 'bullmq';
import { prisma } from '../db/client.js';
import { generateNarrowListeningPack } from '../services/narrowListeningGenerator.js';
import { generateNarrowListeningAudio } from '../services/narrowListeningAudioGenerator.js';
import { TTS_VOICES } from '../../../shared/src/constants.js';
import { createRedisConnection, defaultWorkerSettings } from '../config/redis.js';

const connection = createRedisConnection();

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

      // STEP 3: Generate 0.85x speed audio for this version (new default)
      console.log(`Generating 0.85x audio for version ${i + 1}...`);
      const audioResult = await generateNarrowListeningAudio(
        packId,
        segmentData,
        voiceId,
        0.85,
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
          audioUrl_0_7: null, // Will be generated on demand
          audioUrl_0_85: audioResult.combinedAudioUrl,
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
          audioUrl_0_7: null,
          startTime_0_7: null,
          endTime_0_7: null,
          audioUrl_0_85: seg.audioUrl || null,
          startTime_0_85: seg.startTime,
          endTime_0_85: seg.endTime,
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
 * Process on-demand speed audio generation job (for 0.7x or 1.0x)
 */
async function processOnDemandSpeedGeneration(job: any) {
  const { packId, speed } = job.data;

  // Validate speed
  if (speed !== 0.7 && speed !== 0.85 && speed !== 1.0) {
    throw new Error(`Invalid speed: ${speed}. Must be 0.7, 0.85, or 1.0`);
  }

  const speedLabel = speed === 0.7 ? '0.7x' : speed === 0.85 ? '0.85x' : '1.0x';
  const audioUrlField = speed === 0.7 ? 'audioUrl_0_7' : speed === 0.85 ? 'audioUrl_0_85' : 'audioUrl_1_0';
  const startTimeField = speed === 0.7 ? 'startTime_0_7' : speed === 0.85 ? 'startTime_0_85' : 'startTime_1_0';
  const endTimeField = speed === 0.7 ? 'endTime_0_7' : speed === 0.85 ? 'endTime_0_85' : 'endTime_1_0';

  try {
    console.log(`Generating ${speedLabel} speed audio for pack ${packId}`);

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

      // Skip if already has audio for this speed
      if (version[audioUrlField]) {
        console.log(`Version ${i + 1} already has ${speedLabel} audio, skipping`);
        await job.updateProgress((i + 1) * progressPerVersion);
        continue;
      }

      console.log(`Generating ${speedLabel} audio for version ${i + 1}/${pack.versions.length}`);

      // Use existing segment data from database
      const segmentData = version.segments.map(seg => ({
        text: seg.japaneseText,
        translation: seg.englishTranslation,
      }));

      // Generate audio at specified speed
      const audioResult = await generateNarrowListeningAudio(
        packId,
        segmentData,
        version.voiceId,
        speed,
        i
      );

      // Update version with audio URL
      await prisma.storyVersion.update({
        where: { id: version.id },
        data: { [audioUrlField]: audioResult.combinedAudioUrl },
      });

      // Update segments with timing data
      for (let segIdx = 0; segIdx < audioResult.segments.length; segIdx++) {
        const seg = audioResult.segments[segIdx];
        await prisma.storySegment.update({
          where: { id: version.segments[segIdx].id },
          data: {
            [audioUrlField]: seg.audioUrl || null,
            [startTimeField]: seg.startTime,
            [endTimeField]: seg.endTime,
          },
        });
      }

      console.log(`✅ Generated ${speedLabel} audio for version ${i + 1}`);
      await job.updateProgress((i + 1) * progressPerVersion);
    }

    console.log(`✅ ${speedLabel} speed audio generation complete for pack ${packId}`);

    return {
      packId,
      speed: speedLabel,
      versionsUpdated: pack.versions.length,
    };
  } catch (error: any) {
    console.error(`❌ Error generating ${speedLabel} audio for pack ${packId}:`, error);
    throw error;
  }
}

// Create worker
export const narrowListeningWorker = new Worker(
  'narrow-listening-generation',
  async (job) => {
    if (job.name === 'generate-narrow-listening') {
      return processNarrowListeningGeneration(job);
    } else if (job.name === 'generate-speed') {
      return processOnDemandSpeedGeneration(job);
    } else {
      throw new Error(`Unknown job type: ${job.name}`);
    }
  },
  {
    connection,
    ...defaultWorkerSettings,
  }
);

narrowListeningWorker.on('completed', (job) => {
  console.log(`✅ Job ${job.id} completed`);
});

narrowListeningWorker.on('failed', (job, err) => {
  console.error(`❌ Job ${job?.id} failed:`, err);
});
