import { Queue, Worker } from 'bullmq';
import { prisma } from '../db/client.js';
import {
  extractCoreItems,
  extractDialogueExchanges,
  extractDialogueExchangesFromSourceText,
} from '../services/courseItemExtractor.js';
import { planCourse } from '../services/lessonPlanner.js';
import { generateLessonScript } from '../services/lessonScriptGenerator.js';
import { generateConversationalLessonScript } from '../services/conversationalLessonScriptGenerator.js';
import { assembleLessonAudio } from '../services/audioCourseAssembler.js';
import { createRedisConnection, defaultWorkerSettings } from '../config/redis.js';

const connection = createRedisConnection();

export const courseQueue = new Queue('course-generation', { connection });

async function processCourseGeneration(job: any) {
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
    const estimatedDuration = dialogueExchanges.length * 90; // ~1.5 min per exchange

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
        scriptJson: generatedScript.units as any,
        approxDurationSeconds: generatedScript.estimatedDurationSeconds,
      },
    });

    // STEP 3.5: Extract vocabulary from generated dialogue units
    console.log('Extracting vocabulary from generated dialogue...');
    const vocabularyItems: Array<{
      textL2: string;
      readingL2: string | null;
      translationL1: string;
      unitIndex: number;
    }> = [];

    // Extract vocabulary from dialogue units
    generatedScript.units.forEach((unit: any, index: number) => {
      if (unit.type === 'dialogue' && unit.vocabularyItems && unit.vocabularyItems.length > 0) {
        unit.vocabularyItems.forEach((vocab: any) => {
          vocabularyItems.push({
            textL2: vocab.textL2,
            readingL2: vocab.readingL2 || null,
            translationL1: vocab.translationL1,
            unitIndex: index,
          });
        });
      }
    });

    // Save vocabulary items with sourceUnitIndex
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
          sourceUnitIndex: item.unitIndex,
        })),
      });
      console.log(`Saved ${vocabularyItems.length} vocabulary items from dialogue units`);
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
        timingData: assembledAudio.timingData as any,
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
      vocabularyItemCount: allVocabItems.length,
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
