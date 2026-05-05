import {
  DEFAULT_NARRATOR_VOICES,
  DEFAULT_SPEAKER_VOICES,
} from '@languageflow/shared/src/constants-new.js';
import { Prisma } from '@prisma/client';

import { prisma } from '../../db/client.js';
import { assembleLessonAudio } from '../audioCourseAssembler.js';

import { buildDailyAudioLearningAtoms, selectDailyAudioPracticeCards } from './cardSelection.js';
import { buildDailyAudioPracticeScripts } from './scriptGenerator.js';
import { DAILY_AUDIO_TRACKS } from './types.js';

export async function processDailyAudioPracticeJob(params: {
  practiceId: string;
  onProgress?: (progress: number) => Promise<void> | void;
}) {
  const onProgress = params.onProgress ?? (async () => {});
  await onProgress(5);

  const practice = await prisma.dailyAudioPractice.findUnique({
    where: { id: params.practiceId },
    include: { tracks: true },
  });
  if (!practice) {
    throw new Error('Daily audio practice not found');
  }

  try {
    if (practice.status !== 'generating') {
      await prisma.dailyAudioPractice.update({
        where: { id: practice.id },
        data: { status: 'generating', errorMessage: null },
      });
    }

    const selected = await selectDailyAudioPracticeCards({
      userId: practice.userId,
      limit: 30,
      candidatePoolSize: 80,
    });
    const atoms = await buildDailyAudioLearningAtoms(selected.cards);
    if (atoms.length === 0) {
      throw new Error('Daily Audio Practice needs at least one eligible study card.');
    }

    await prisma.dailyAudioPractice.update({
      where: { id: practice.id },
      data: {
        sourceCardIdsJson: selected.cards.map((card) => card.id) as Prisma.InputJsonValue,
        selectionSummaryJson: selected.summary as unknown as Prisma.InputJsonValue,
      },
    });
    await onProgress(20);

    const scripts = await buildDailyAudioPracticeScripts({
      atoms,
      targetDurationMinutes: practice.targetDurationMinutes,
      targetLanguage: practice.targetLanguage,
      nativeLanguage: practice.nativeLanguage,
      l1VoiceId:
        DEFAULT_NARRATOR_VOICES[practice.nativeLanguage as keyof typeof DEFAULT_NARRATOR_VOICES] ??
        DEFAULT_NARRATOR_VOICES.en,
      speakerVoiceIds: [
        DEFAULT_SPEAKER_VOICES[practice.targetLanguage]?.speaker1 ?? 'ja-JP-Neural2-B',
        DEFAULT_SPEAKER_VOICES[practice.targetLanguage]?.speaker2 ?? 'ja-JP-Neural2-C',
      ],
    });
    await onProgress(45);

    for (const [index, trackConfig] of DAILY_AUDIO_TRACKS.entries()) {
      const scriptUnits = scripts[trackConfig.mode];
      const existingReadyTrack = practice.tracks.find(
        (track) => track.mode === trackConfig.mode && track.status === 'ready' && track.audioUrl
      );
      if (existingReadyTrack) {
        await onProgress(45 + Math.floor(((index + 1) / DAILY_AUDIO_TRACKS.length) * 45));
        continue;
      }

      const track = await prisma.dailyAudioPracticeTrack.upsert({
        where: {
          practiceId_mode: {
            practiceId: practice.id,
            mode: trackConfig.mode,
          },
        },
        create: {
          practiceId: practice.id,
          mode: trackConfig.mode,
          title: trackConfig.title,
          sortOrder: trackConfig.sortOrder,
          status: 'generating',
          scriptUnitsJson: scriptUnits as Prisma.InputJsonValue,
        },
        update: {
          title: trackConfig.title,
          sortOrder: trackConfig.sortOrder,
          status: 'generating',
          scriptUnitsJson: scriptUnits as Prisma.InputJsonValue,
          errorMessage: null,
        },
      });

      const assembled = await assembleLessonAudio({
        lessonId: track.id,
        scriptUnits,
        targetLanguage: practice.targetLanguage,
        nativeLanguage: practice.nativeLanguage,
        outputFolder: `daily-audio-practice/${practice.id}`,
        outputFilename: `${trackConfig.mode}-${track.id}.mp3`,
      });

      await prisma.dailyAudioPracticeTrack.update({
        where: { id: track.id },
        data: {
          status: 'ready',
          audioUrl: assembled.audioUrl,
          approxDurationSeconds: assembled.actualDurationSeconds,
          timingData: assembled.timingData as Prisma.InputJsonValue,
          generationMetadataJson: {
            unitCount: scriptUnits.length,
            sourceCardCount: atoms.length,
          } as Prisma.InputJsonValue,
        },
      });
      await onProgress(45 + Math.floor(((index + 1) / DAILY_AUDIO_TRACKS.length) * 45));
    }

    const readyPractice = await prisma.dailyAudioPractice.update({
      where: { id: practice.id },
      data: { status: 'ready', errorMessage: null },
      include: { tracks: { orderBy: { sortOrder: 'asc' } } },
    });
    await onProgress(100);

    return { practiceId: readyPractice.id, status: readyPractice.status };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await prisma.dailyAudioPractice.update({
      where: { id: practice.id },
      data: { status: 'error', errorMessage: message },
    });
    await prisma.dailyAudioPracticeTrack.updateMany({
      where: { practiceId: practice.id, status: 'generating' },
      data: { status: 'error', errorMessage: message },
    });
    throw error;
  }
}
