import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { TFunction } from 'i18next';
import type { NavigateFunction } from 'react-router-dom';

import type { useEpisodes } from '../../hooks/useEpisodes';
import {
  generateCompletedDialogueAudio,
  generateCompletedDialogueCourse,
} from './dialogueCompletion';

type EpisodeActions = Pick<
  ReturnType<typeof useEpisodes>,
  'generateAllSpeedsAudio' | 'getEpisode' | 'pollJobStatus'
>;

interface DialogueGenerationPollingOptions extends EpisodeActions {
  audioCourseEnabled: boolean;
  autoGenerateAudio: boolean;
  createAudioCourse: boolean;
  createCourseFromEpisode: (episodeId: string, signal: AbortSignal) => Promise<string | null>;
  generatedEpisodeId: string | null;
  invalidateLibrary: () => void;
  jobId: string | null;
  navigate: NavigateFunction;
  pollingRunRef: MutableRefObject<symbol | null>;
  redirectTimerRef: MutableRefObject<number | null>;
  scopedRoute: (path: string, scopedUserId?: string) => string;
  setCourseError: Dispatch<SetStateAction<string | null>>;
  setJobId: Dispatch<SetStateAction<string | null>>;
  setStep: Dispatch<SetStateAction<'input' | 'generating' | 'complete'>>;
  t: TFunction<'dialogue'[]>;
}

const clearRedirectTimer = (timerRef: MutableRefObject<number | null>) => {
  const redirectTimerRef = timerRef;
  if (redirectTimerRef.current === null) return;
  window.clearTimeout(redirectTimerRef.current);
  redirectTimerRef.current = null;
};

const loadGeneratedDialogueId = async (
  options: DialogueGenerationPollingOptions,
  signal: AbortSignal
) => {
  if (!options.generatedEpisodeId) return undefined;
  const episode = await options.getEpisode(options.generatedEpisodeId, false, undefined, signal);
  return episode.dialogue?.id;
};

const generateCompletedEpisodeAudio = (
  options: DialogueGenerationPollingOptions,
  dialogueId: string,
  signal: AbortSignal
) => {
  if (!options.generatedEpisodeId) return Promise.resolve();
  return options.generateAllSpeedsAudio(options.generatedEpisodeId, dialogueId, signal);
};

const createCompletedEpisodeCourse = (
  options: DialogueGenerationPollingOptions,
  signal: AbortSignal
) => {
  if (!options.generatedEpisodeId) return Promise.resolve(null);
  return options.createCourseFromEpisode(options.generatedEpisodeId, signal);
};

const courseFailureMessage = (error: unknown, t: TFunction<'dialogue'[]>) =>
  error instanceof Error ? error.message : t('dialogue:complete.courseFailureFallback');

const navigateToCompletedGeneration = (
  options: DialogueGenerationPollingOptions,
  courseId: string | null
) => {
  if (courseId) {
    options.navigate(options.scopedRoute(`/app/courses/${courseId}`));
  } else if (options.generatedEpisodeId) {
    options.navigate(options.scopedRoute(`/app/playback/${options.generatedEpisodeId}`));
  }
};

const scheduleCompletedGenerationRedirect = (
  options: DialogueGenerationPollingOptions,
  courseId: string | null,
  isCurrentRun: () => boolean
) => {
  if (options.createAudioCourse && !courseId) return;
  const { redirectTimerRef } = options;
  redirectTimerRef.current = window.setTimeout(() => {
    redirectTimerRef.current = null;
    if (isCurrentRun()) navigateToCompletedGeneration(options, courseId);
  }, 2000);
};

const completeDialogueGeneration = async (
  options: DialogueGenerationPollingOptions,
  signal: AbortSignal,
  isCurrentRun: () => boolean
) => {
  options.setCourseError(null);
  const audioIsCurrent = await generateCompletedDialogueAudio({
    enabled: Boolean(options.generatedEpisodeId) && options.autoGenerateAudio,
    signal,
    isCurrentRun,
    loadDialogueId: (currentSignal) => loadGeneratedDialogueId(options, currentSignal),
    generateAudio: (dialogueId, currentSignal) =>
      generateCompletedEpisodeAudio(options, dialogueId, currentSignal),
  });
  if (!audioIsCurrent) return;

  const courseResult = await generateCompletedDialogueCourse({
    enabled:
      Boolean(options.generatedEpisodeId) &&
      options.createAudioCourse &&
      options.audioCourseEnabled,
    signal,
    isCurrentRun,
    createCourse: (currentSignal) => createCompletedEpisodeCourse(options, currentSignal),
    onError: (error) => {
      console.error('Failed to create audio course:', error);
      options.setCourseError(courseFailureMessage(error, options.t));
    },
  });
  if (!courseResult.isCurrent) return;
  if (!isCurrentRun()) return;

  options.setStep('complete');
  options.invalidateLibrary();
  scheduleCompletedGenerationRedirect(options, courseResult.courseId, isCurrentRun);
};

const runDialogueGenerationPoll = async (
  options: DialogueGenerationPollingOptions,
  signal: AbortSignal,
  isCurrentRun: () => boolean
) => {
  try {
    const status = await options.pollJobStatus(options.jobId!, undefined, 'dialogue', signal);
    if (!isCurrentRun()) return;
    if (status === 'completed') {
      await completeDialogueGeneration(options, signal, isCurrentRun);
    } else if (status === 'failed') {
      options.setJobId(null);
      options.setStep('input');
      // eslint-disable-next-line no-alert
      alert(options.t('dialogue:alerts.generationFailed'));
    }
  } catch (error) {
    if (isCurrentRun()) console.error('Failed to poll dialogue generation:', error);
  }
};

const useDialogueGenerationPolling = (options: DialogueGenerationPollingOptions) => {
  const { pollingRunRef, redirectTimerRef } = options;
  useEffect(() => {
    if (!options.jobId) return undefined;
    clearRedirectTimer(redirectTimerRef);
    const controller = new AbortController();
    const runToken = Symbol(options.jobId);
    pollingRunRef.current = runToken;
    const isCurrentRun = () => pollingRunRef.current === runToken && !controller.signal.aborted;

    runDialogueGenerationPoll(options, controller.signal, isCurrentRun).catch(() => undefined);
    return () => {
      if (pollingRunRef.current === runToken) pollingRunRef.current = null;
      controller.abort();
      clearRedirectTimer(redirectTimerRef);
    };
    // The caller passes a fresh options object; its individual fields are the lifecycle contract.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    options.audioCourseEnabled,
    options.autoGenerateAudio,
    options.createAudioCourse,
    options.createCourseFromEpisode,
    options.generateAllSpeedsAudio,
    options.generatedEpisodeId,
    options.getEpisode,
    options.jobId,
    options.navigate,
    options.pollJobStatus,
    options.scopedRoute,
  ]);
};

export default useDialogueGenerationPolling;
