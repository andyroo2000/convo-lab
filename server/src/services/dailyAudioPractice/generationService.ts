import { DEFAULT_NARRATOR_VOICES } from '@languageflow/shared/src/constants-new.js';
import { Prisma } from '@prisma/client';

import { prisma } from '../../db/client.js';
import { assembleLessonAudio } from '../audioCourseAssembler.js';

import { buildDailyAudioLearningAtoms, selectDailyAudioPracticeCards } from './cardSelection.js';
import { buildDailyAudioPracticeDrillScriptResult } from './scriptGenerator.js';
import { DAILY_AUDIO_TRACKS, type DailyAudioPracticeTrackMode } from './types.js';

const GENERIC_GENERATION_ERROR =
  'Daily Audio Practice generation failed. Please try again in a moment.';
const NO_ELIGIBLE_CARDS_ERROR = 'Daily Audio Practice needs at least one eligible study card.';
const DAILY_AUDIO_GENERATED_TRACK_MODES = new Set<DailyAudioPracticeTrackMode>(['drill']);
const GOOGLE_SHOHEI_JA_VOICE_ID = 'ja-JP-Wavenet-C';
const SCRIPT_GENERATED_PROGRESS = 45;
const AUDIO_ASSEMBLY_DONE_PROGRESS = 95;

export function mapDailyAudioAssemblyProgress(current: number, total: number): number {
  if (!Number.isFinite(current) || !Number.isFinite(total) || total <= 0) {
    return SCRIPT_GENERATED_PROGRESS;
  }

  const ratio = Math.min(1, Math.max(0, current / total));
  return SCRIPT_GENERATED_PROGRESS + Math.floor(ratio * 45);
}

function getSafeGenerationErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message === NO_ELIGIBLE_CARDS_ERROR) {
    return message;
  }
  return GENERIC_GENERATION_ERROR;
}

export async function processDailyAudioPracticeJob(params: {
  practiceId: string;
  onProgress?: (progress: number) => Promise<void> | void;
}) {
  const onProgress = params.onProgress ?? (async () => {});
  let lastProgress = 0;
  const reportProgress = async (progress: number) => {
    const nextProgress = Math.min(100, Math.max(lastProgress, Math.floor(progress)));
    if (nextProgress === lastProgress) return;
    lastProgress = nextProgress;
    await onProgress(nextProgress);
  };

  await reportProgress(5);

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
      throw new Error(NO_ELIGIBLE_CARDS_ERROR);
    }

    await prisma.dailyAudioPractice.update({
      where: { id: practice.id },
      data: {
        sourceCardIdsJson: selected.cards.map((card) => card.id) as Prisma.InputJsonValue,
        selectionSummaryJson: selected.summary as unknown as Prisma.InputJsonValue,
      },
    });
    await reportProgress(20);

    const drillScript = await buildDailyAudioPracticeDrillScriptResult({
      atoms,
      targetDurationMinutes: practice.targetDurationMinutes,
      targetLanguage: practice.targetLanguage,
      nativeLanguage: practice.nativeLanguage,
      l1VoiceId:
        DEFAULT_NARRATOR_VOICES[practice.nativeLanguage as keyof typeof DEFAULT_NARRATOR_VOICES] ??
        DEFAULT_NARRATOR_VOICES.en,
      speakerVoiceIds: [GOOGLE_SHOHEI_JA_VOICE_ID, GOOGLE_SHOHEI_JA_VOICE_ID],
    });
    await reportProgress(SCRIPT_GENERATED_PROGRESS);

    for (const [index, trackConfig] of DAILY_AUDIO_TRACKS.entries()) {
      if (!DAILY_AUDIO_GENERATED_TRACK_MODES.has(trackConfig.mode)) {
        await prisma.dailyAudioPracticeTrack.upsert({
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
            status: 'skipped',
            generationMetadataJson: { reason: 'Disabled during drill development.' },
          },
          update: {
            title: trackConfig.title,
            sortOrder: trackConfig.sortOrder,
            status: 'skipped',
            scriptUnitsJson: Prisma.JsonNull,
            audioUrl: null,
            timingData: Prisma.JsonNull,
            approxDurationSeconds: null,
            generationMetadataJson: { reason: 'Disabled during drill development.' },
            errorMessage: null,
          },
        });
        await reportProgress(45 + Math.floor(((index + 1) / DAILY_AUDIO_TRACKS.length) * 45));
        continue;
      }

      const scriptUnits = drillScript.units;
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
        onProgress: (current, total) => {
          void reportProgress(mapDailyAudioAssemblyProgress(current, total));
        },
      });
      await reportProgress(AUDIO_ASSEMBLY_DONE_PROGRESS);

      await prisma.dailyAudioPracticeTrack.update({
        where: { id: track.id },
        data: {
          status: 'ready',
          audioUrl: assembled.audioUrl,
          approxDurationSeconds: assembled.actualDurationSeconds,
          timingData: assembled.timingData as Prisma.InputJsonValue,
          generationMetadataJson: {
            sourceCardCount: atoms.length,
            ...drillScript.metadata,
          } as Prisma.InputJsonValue,
        },
      });
      await reportProgress(45 + Math.floor(((index + 1) / DAILY_AUDIO_TRACKS.length) * 45));
    }

    const readyPractice = await prisma.dailyAudioPractice.update({
      where: { id: practice.id },
      data: { status: 'ready', errorMessage: null },
      include: { tracks: { orderBy: { sortOrder: 'asc' } } },
    });
    await reportProgress(100);

    return { practiceId: readyPractice.id, status: readyPractice.status };
  } catch (error) {
    const message = getSafeGenerationErrorMessage(error);
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
