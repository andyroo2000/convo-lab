import { Queue, Worker } from 'bullmq';
import { prisma } from '../db/client.js';
import { generateNarrowListeningPack } from '../services/narrowListeningGenerator.js';
import {
  generateNarrowListeningAudio,
  assignVoicesToSegments,
  type VoiceInfo,
} from '../services/narrowListeningAudioGenerator.js';
import { processJapaneseBatch, processChineseBatch } from '../services/languageProcessor.js';
import { TTS_VOICES } from '../../../shared/src/constants-new.js';
import { createRedisConnection, defaultWorkerSettings } from '../config/redis.js';
import { generateSilence } from '../services/ttsClient.js';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

const connection = createRedisConnection();

export const narrowListeningQueue = new Queue('narrow-listening-generation', { connection });

/**
 * Process narrow listening pack generation job
 */
async function processNarrowListeningGeneration(job: any) {
  const { packId, topic, targetLanguage, proficiencyLevel, versionCount, grammarFocus } = job.data;

  try {
    console.log(`Starting narrow listening pack generation for pack ${packId}`);

    // Update pack status
    await prisma.narrowListeningPack.update({
      where: { id: packId },
      data: { status: 'generating' },
    });

    await job.updateProgress(5);

    // STEP 1: Generate story content using Gemini
    console.log(`Generating story content with Gemini for ${targetLanguage}...`);
    const storyPack = await generateNarrowListeningPack(
      topic,
      targetLanguage,
      proficiencyLevel,
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

    // STEP 2: Get available voices and generate shared silence buffer
    const languageVoices = TTS_VOICES[targetLanguage as keyof typeof TTS_VOICES]?.voices || TTS_VOICES.ja.voices;
    const availableVoices: VoiceInfo[] = languageVoices.map(v => ({
      id: v.id,
      gender: v.gender as 'male' | 'female',
      description: v.description,
    }));

    console.log(
      `Using ${availableVoices.length} voices for ${targetLanguage}: ${availableVoices.map(v => v.id).join(', ')}`
    );

    // Generate shared 800ms silence buffer (cached across all versions in this pack)
    const tempDir = path.join(os.tmpdir(), `nl-silence-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });
    const sharedSilencePath = path.join(tempDir, 'shared-silence.mp3');
    const silenceBuffer = await generateSilence(0.8);
    await fs.writeFile(sharedSilencePath, silenceBuffer);
    console.log(`[NL] Generated shared silence buffer: ${sharedSilencePath}`);

    const progressPerVersion = 70 / storyPack.versions.length; // 70% total for all versions (20% to 90%)

    try {
      for (let i = 0; i < storyPack.versions.length; i++) {
      const version = storyPack.versions[i];
      const baseProgress = 20 + (i * progressPerVersion);

      console.log(`Processing version ${i + 1}/${storyPack.versions.length}: ${version.title}`);

      // Assign voices with gender alternation and balanced distribution
      const voiceAssignments = assignVoicesToSegments(
        version.segments.length,
        availableVoices
      );

      const uniqueVoicesUsed = new Set(voiceAssignments);
      console.log(
        `Assigned ${uniqueVoicesUsed.size} unique voices to ${version.segments.length} segments`
      );

      // Process all segments through language processor in a single batch call
      const segmentTexts = version.segments.map(seg => seg.targetText);
      let readings: string[] = [];

      if (targetLanguage === 'ja') {
        console.log(`[NL] Batching furigana for ${segmentTexts.length} segments`);
        const furiganaResults = await processJapaneseBatch(segmentTexts);
        readings = furiganaResults.map(r => r.furigana);
        console.log(`[NL] Furigana batch complete (1 call instead of ${segmentTexts.length})`);
      } else if (targetLanguage === 'zh') {
        console.log(`[NL] Batching pinyin for ${segmentTexts.length} segments`);
        const pinyinResults = await processChineseBatch(segmentTexts);
        readings = pinyinResults.map(r => r.pinyinToneMarks);
        console.log(`[NL] Pinyin batch complete (1 call instead of ${segmentTexts.length})`);
      }

      const segmentData = version.segments.map((seg, idx) => ({
        text: seg.targetText,
        translation: seg.englishTranslation,
        reading: readings[idx] || '',
      }));

      await job.updateProgress(baseProgress + (progressPerVersion * 0.1));

      // STEP 3: Generate all three speed audio files for this version
      console.log(`Generating all speed audio files for version ${i + 1}...`);

      // Generate 0.7x speed audio
      console.log(`  Generating 0.7x audio...`);
      const audioResult_0_7 = await generateNarrowListeningAudio(
        packId,
        segmentData,
        voiceAssignments,
        0.7,
        i,
        targetLanguage,
        sharedSilencePath
      );

      await job.updateProgress(baseProgress + (progressPerVersion * 0.3));

      // Generate 0.85x speed audio
      console.log(`  Generating 0.85x audio...`);
      const audioResult_0_85 = await generateNarrowListeningAudio(
        packId,
        segmentData,
        voiceAssignments,
        0.85,
        i,
        targetLanguage,
        sharedSilencePath
      );

      await job.updateProgress(baseProgress + (progressPerVersion * 0.5));

      // Generate 1.0x speed audio
      console.log(`  Generating 1.0x audio...`);
      const audioResult_1_0 = await generateNarrowListeningAudio(
        packId,
        segmentData,
        voiceAssignments,
        1.0,
        i,
        targetLanguage,
        sharedSilencePath
      );

      console.log(`All speed audio generated for version ${i + 1}`);

      await job.updateProgress(baseProgress + (progressPerVersion * 0.7));

      // STEP 4: Create database records
      // Pick the first voice from assignments as the "primary" voice for backward compatibility
      const primaryVoiceId = voiceAssignments[0];

      const storyVersion = await prisma.storyVersion.create({
        data: {
          packId,
          variationType: version.variationType,
          title: version.title,
          voiceId: primaryVoiceId, // Primary voice (for backward compatibility)
          order: i,
          audioUrl_0_7: audioResult_0_7.combinedAudioUrl,
          audioUrl_0_85: audioResult_0_85.combinedAudioUrl,
          audioUrl_1_0: audioResult_1_0.combinedAudioUrl,
        },
      });

      console.log(`Created StoryVersion record: ${storyVersion.id}`);

      // Create segment records with individual voiceId per segment
      // Use 0.85x as the base timing (since it's the default speed)
      await prisma.storySegment.createMany({
        data: audioResult_0_85.segments.map((seg: any, segIdx: number) => ({
          versionId: storyVersion.id,
          order: segIdx,
          targetText: seg.text,
          englishTranslation: seg.translation,
          reading: seg.reading || null,
          voiceId: seg.voiceId, // NEW: Store voice per segment
          audioUrl_0_7: null,
          startTime_0_7: audioResult_0_7.segments[segIdx].startTime,
          endTime_0_7: audioResult_0_7.segments[segIdx].endTime,
          audioUrl_0_85: seg.audioUrl || null,
          startTime_0_85: seg.startTime,
          endTime_0_85: seg.endTime,
          audioUrl_1_0: null,
          startTime_1_0: audioResult_1_0.segments[segIdx].startTime,
          endTime_1_0: audioResult_1_0.segments[segIdx].endTime,
        })),
      });

      console.log(`Created ${audioResult_0_85.segments.length} StorySegment records`);

      await job.updateProgress(baseProgress + progressPerVersion);
      }
    } finally {
      // Cleanup shared silence buffer temp directory
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
        console.log(`[NL] Cleaned up shared silence temp directory`);
      } catch (e) {
        console.warn('[NL] Failed to cleanup silence temp directory:', e);
      }
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

    const targetLanguage = pack.targetLanguage;
    const progressPerVersion = 100 / pack.versions.length;

    // Generate shared 800ms silence buffer (cached across all versions)
    const tempDir = path.join(os.tmpdir(), `nl-silence-ondemand-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });
    const sharedSilencePath = path.join(tempDir, 'shared-silence.mp3');
    const silenceBuffer = await generateSilence(0.8);
    await fs.writeFile(sharedSilencePath, silenceBuffer);
    console.log(`[NL] Generated shared silence buffer for on-demand generation`);

    try {

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
        text: seg.targetText,
        translation: seg.englishTranslation,
        reading: seg.reading || undefined,
      }));

      // Build voice assignments from existing segment voiceIds
      // Fall back to version voiceId if segment doesn't have one (backward compatibility)
      const voiceAssignments = version.segments.map(
        seg => seg.voiceId || version.voiceId
      );

      // Generate audio at specified speed with multi-voice support
      const audioResult = await generateNarrowListeningAudio(
        packId,
        segmentData,
        voiceAssignments,
        speed,
        i,
        targetLanguage,
        sharedSilencePath
      );

      // Update version with audio URL
      await prisma.storyVersion.update({
        where: { id: version.id },
        data: { [audioUrlField]: audioResult.combinedAudioUrl },
      });

      // Update segments with timing data and voiceId (if missing)
      for (let segIdx = 0; segIdx < audioResult.segments.length; segIdx++) {
        const seg = audioResult.segments[segIdx];
        const existingSegment = version.segments[segIdx];

        await prisma.storySegment.update({
          where: { id: existingSegment.id },
          data: {
            // Update timing data
            [audioUrlField]: seg.audioUrl || null,
            [startTimeField]: seg.startTime,
            [endTimeField]: seg.endTime,
            // Backfill voiceId if missing (for backward compatibility)
            ...(existingSegment.voiceId ? {} : { voiceId: seg.voiceId }),
          },
        });
      }

      console.log(`✅ Generated ${speedLabel} audio for version ${i + 1}`);
      await job.updateProgress((i + 1) * progressPerVersion);
    }
    } finally {
      // Cleanup shared silence buffer temp directory
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
        console.log(`[NL] Cleaned up shared silence temp directory`);
      } catch (e) {
        console.warn('[NL] Failed to cleanup silence temp directory:', e);
      }
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
