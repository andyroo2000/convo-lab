/* eslint-disable no-console */
// Console logging is necessary in this background job worker for monitoring and debugging

import { Prisma } from '@prisma/client';
import { Queue, Worker } from 'bullmq';

import { createRedisConnection, defaultWorkerSettings } from '../config/redis.js';
import { prisma } from '../db/client.js';
import { assembleLessonAudio } from '../services/audioCourseAssembler.js';
import { generateConversationalLessonScript } from '../services/conversationalLessonScriptGenerator.js';
import { extractDialogueExchangesFromSourceText } from '../services/courseItemExtractor.js';

const connection = createRedisConnection();

export const courseQueue = new Queue('course-generation', { connection });

async function processCourseGeneration(job: {
  data: { courseId: string };
  updateProgress: (progress: number) => Promise<void>;
}) {
  const { courseId } = job.data;

  try {
    console.log(`Starting course generation for course ${courseId}`);

    // Update course status
    await prisma.course.update({
      where: { id: courseId },
      data: { status: 'generating' },
    });

    await job.updateProgress(5);

    // Get course with associated episodes
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: {
        courseEpisodes: {
          include: {
            episode: {
              include: {
                dialogue: {
                  include: {
                    speakers: true,
                  },
                },
              },
            },
          },
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!course) {
      throw new Error('Course not found');
    }

    if (course.courseEpisodes.length === 0) {
      throw new Error('Course has no episodes');
    }

    await job.updateProgress(10);

    // For MVP: Use first episode only
    // Future: combine multiple episodes
    const firstEpisode = course.courseEpisodes[0].episode;

    if (!firstEpisode.sourceText) {
      throw new Error('Episode has no source text');
    }

    console.log(`Generating dialogue exchanges from episode source text: ${firstEpisode.title}`);
    console.log(`Target duration: ${course.maxLessonDurationMinutes} minutes`);
    console.log(`JLPT Level: ${course.jlptLevel || 'unspecified'}`);

    // Get speaker voices from existing dialogue if available
    const speakerVoices =
      firstEpisode.dialogue?.speakers?.map((speaker) => ({
        speakerName: speaker.name,
        voiceId: speaker.voiceId,
      })) || [];

    // STEP 1: Extract dialogue exchanges from source text (with JLPT level targeting)
    // This uses the original prompt which has richer context than the generated dialogue
    const dialogueExchanges = await extractDialogueExchangesFromSourceText(
      firstEpisode.sourceText,
      firstEpisode.title,
      course.targetLanguage,
      course.nativeLanguage,
      course.maxLessonDurationMinutes,
      course.jlptLevel || undefined,
      speakerVoices,
      course.speaker1Gender as 'male' | 'female',
      course.speaker2Gender as 'male' | 'female',
      course.speaker1VoiceId || undefined,
      course.speaker2VoiceId || undefined
    );

    console.log(`Extracted ${dialogueExchanges.length} dialogue exchanges from source text`);
    await job.updateProgress(20);

    // For now, create a single lesson per episode
    // Future: could split long dialogues into multiple lessons
    const lessonTitle = `${firstEpisode.title} - Lesson 1`;
    const _estimatedDuration = dialogueExchanges.length * 90; // ~1.5 min per exchange

    console.log(`Planning conversational lesson: ${lessonTitle}`);
    await job.updateProgress(30);

    // STEP 2: Check if course already has content (scriptJson)
    // With the flattened model, we store lesson data directly on Course
    if (course.scriptJson && course.audioUrl) {
      console.log(`Course already has content, nothing to do`);
      await prisma.course.update({
        where: { id: course.id },
        data: { status: 'ready' },
      });
      return {
        courseId,
        lessonCount: 1,
        vocabularyItemCount: 0,
        exchangeCount: dialogueExchanges.length,
      };
    }

    await job.updateProgress(35);

    // NOTE: Vocabulary creation moved to AFTER script generation
    // so we can extract from actual dialogue units with exact text matches
    await job.updateProgress(40);

    // STEP 3: Generate conversational script with Gemini
    console.log('Generating conversational lesson script with Gemini...');

    // Build speaker voice ID map
    const l2VoiceIds: Record<string, string> = {};
    for (const exchange of dialogueExchanges) {
      l2VoiceIds[exchange.speakerName] = exchange.speakerVoiceId;
    }

    const generatedScript = await generateConversationalLessonScript(dialogueExchanges, {
      episodeTitle: firstEpisode.title,
      targetLanguage: course.targetLanguage,
      nativeLanguage: course.nativeLanguage,
      l1VoiceId: course.l1VoiceId,
      l2VoiceIds,
      jlptLevel: course.jlptLevel || undefined,
    });

    console.log(`Generated conversational script with ${generatedScript.units.length} units`);
    await job.updateProgress(60);

    // Update course with script (flattened from lesson)
    await prisma.course.update({
      where: { id: course.id },
      data: {
        scriptJson: generatedScript.units as unknown as Prisma.JsonValue,
        approxDurationSeconds: generatedScript.estimatedDurationSeconds,
      },
    });

    // STEP 3.5: Extract vocabulary from dialogue exchanges and map to script units
    console.log('Extracting vocabulary from dialogue exchanges...');
    const vocabularyItems: Array<{
      textL2: string;
      readingL2: string | null;
      translationL1: string;
      sourceUnitIndex: number | null;
    }> = [];

    // Extract vocabulary from each dialogue exchange and find matching script units
    dialogueExchanges.forEach((exchange) => {
      if (exchange.vocabularyItems && exchange.vocabularyItems.length > 0) {
        exchange.vocabularyItems.forEach((vocab) => {
          // Find the script unit that contains the full dialogue sentence (not just the vocab word)
          // We want the actual dialogue, not standalone vocabulary units
          let sourceUnitIndex: number | null = null;

          // Search for an L2 unit that:
          // 1. Contains this vocabulary word
          // 2. Is NOT just the vocabulary word itself (must be longer)
          const unitIndex = generatedScript.units.findIndex(
            (unit: { type: string; text?: string }) =>
              unit.type === 'L2' &&
              unit.text &&
              unit.text.includes(vocab.textL2) &&
              unit.text.length > vocab.textL2.length // Ensure it's a sentence, not just the word
          );

          if (unitIndex !== -1) {
            sourceUnitIndex = unitIndex;
            const unit = generatedScript.units[unitIndex];
            const unitText = 'text' in unit ? unit.text : '';
            console.log(
              `Found vocab "${vocab.textL2}" in sentence unit ${unitIndex}: "${unitText}"`
            );
          } else {
            console.warn(`Could not find vocab "${vocab.textL2}" in any dialogue sentence`);
          }

          vocabularyItems.push({
            textL2: vocab.textL2,
            readingL2: vocab.readingL2 || null,
            translationL1: vocab.translationL1,
            sourceUnitIndex,
          });
        });
      }
    });

    // Save vocabulary items
    if (vocabularyItems.length > 0) {
      await prisma.courseCoreItem.createMany({
        data: vocabularyItems.map((item, idx) => ({
          courseId: course.id,
          textL2: item.textL2,
          readingL2: item.readingL2,
          translationL1: item.translationL1,
          complexityScore: idx,
          sourceEpisodeId: firstEpisode.id,
          sourceSentenceId: null,
        })),
      });
      console.log(`Saved ${vocabularyItems.length} vocabulary items from dialogue exchanges`);
      const withAudio = vocabularyItems.filter((item) => item.sourceUnitIndex !== null).length;
      console.log(`  → ${withAudio} items have audio mappings`);
    } else {
      console.log('⚠️  No vocabulary items found in dialogue exchanges');
    }

    // STEP 4: Assemble audio
    console.log('Assembling course audio with Edge TTS...');

    const assembledAudio = await assembleLessonAudio({
      lessonId: course.id, // Using courseId (lessonId parameter name kept for backward compatibility)
      scriptUnits: generatedScript.units,
      targetLanguage: course.targetLanguage,
      nativeLanguage: course.nativeLanguage,
      onProgress: (current, total) => {
        // Map audio assembly progress from 60% to 85%
        const audioProgress = 60 + Math.floor((current / total) * 25);
        job.updateProgress(audioProgress);
      },
    });

    console.log(`Audio assembled: ${assembledAudio.audioUrl}`);
    await job.updateProgress(85);

    // Update course with audio URL, actual duration, and timing data
    await prisma.course.update({
      where: { id: course.id },
      data: {
        audioUrl: assembledAudio.audioUrl,
        approxDurationSeconds: assembledAudio.actualDurationSeconds,
        timingData: assembledAudio.timingData as unknown as Prisma.JsonValue,
        status: 'ready',
      },
    });

    console.log(`Course complete!`);
    await job.updateProgress(90);

    // Update course status to ready
    await prisma.course.update({
      where: { id: courseId },
      data: { status: 'ready' },
    });

    await job.updateProgress(100);

    console.log(`Course generation complete: ${courseId}`);

    return {
      courseId,
      lessonCount: 1,
      vocabularyItemCount: vocabularyItems.length,
      exchangeCount: dialogueExchanges.length,
    };
  } catch (error) {
    console.error('Course generation failed:', error);

    // Update course status to error
    await prisma.course.update({
      where: { id: courseId },
      data: { status: 'error' },
    });

    throw error;
  }
}

export const courseWorker = new Worker('course-generation', processCourseGeneration, {
  connection,
  ...defaultWorkerSettings,
});

courseWorker.on('completed', (job) => {
  console.log(`Course job ${job.id} completed successfully`);
});

courseWorker.on('failed', (job, err) => {
  console.error(`Course job ${job?.id} failed:`, err);
});

courseWorker.on('progress', (job, progress) => {
  console.log(`Course job ${job.id} progress: ${progress}%`);
});
