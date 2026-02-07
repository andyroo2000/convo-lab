/* eslint-disable no-console */
// Console logging is necessary in this background job worker for monitoring and debugging

import { Prisma } from '@prisma/client';
import { Queue, Worker } from 'bullmq';

import { createRedisConnection, defaultWorkerSettings } from '../config/redis.js';
import { prisma } from '../db/client.js';
import { assembleLessonAudio } from '../services/audioCourseAssembler.js';
import { LessonScriptUnit } from '../services/lessonScriptGenerator.js';

const connection = createRedisConnection();

export const courseAudioQueue = new Queue('course-audio-generation', { connection });

async function processCourseAudio(job: {
  data: { courseId: string };
  updateProgress: (progress: number) => Promise<void>;
}) {
  const { courseId } = job.data;

  try {
    console.log(`Starting course audio generation for course ${courseId}`);
    await job.updateProgress(5);

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: {
        id: true,
        scriptJson: true,
        targetLanguage: true,
        nativeLanguage: true,
      },
    });

    if (!course) {
      throw new Error('Course not found');
    }

    if (!Array.isArray(course.scriptJson)) {
      throw new Error('Course has no script JSON');
    }

    const scriptUnits = course.scriptJson as LessonScriptUnit[];

    const assembledAudio = await assembleLessonAudio({
      lessonId: course.id,
      scriptUnits,
      targetLanguage: course.targetLanguage,
      nativeLanguage: course.nativeLanguage,
      onProgress: (current, total) => {
        const progress = Math.min(90, Math.floor((current / total) * 90));
        job.updateProgress(progress);
      },
    });

    await prisma.course.update({
      where: { id: courseId },
      data: {
        audioUrl: assembledAudio.audioUrl,
        approxDurationSeconds: assembledAudio.actualDurationSeconds,
        timingData: assembledAudio.timingData as unknown as Prisma.JsonValue,
        status: 'ready',
      },
    });

    await job.updateProgress(100);

    console.log(`Course audio generation complete: ${courseId}`);

    return {
      courseId,
      audioUrl: assembledAudio.audioUrl,
    };
  } catch (error) {
    console.error('Course audio generation failed:', error);

    await prisma.course.update({
      where: { id: courseId },
      data: { status: 'error' },
    });

    throw error;
  }
}

export const courseAudioWorker = new Worker('course-audio-generation', processCourseAudio, {
  connection,
  ...defaultWorkerSettings,
});

courseAudioWorker.on('completed', (job) => {
  console.log(`Course audio job ${job.id} completed`);
});

courseAudioWorker.on('failed', (job, err) => {
  console.error(`Course audio job ${job?.id} failed:`, err);
});
