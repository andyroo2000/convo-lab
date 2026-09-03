import { useCallback, useEffect } from 'react';
import { type CourseGenerationIntentPayload } from '../../lib/courseGenerationRequest';
import {
  abandonGenerationIntent,
  type GenerationIntent,
  readGenerationIntent,
  writeGenerationIntent,
} from '../../lib/generationIntentStore';
import { generationRequestErrorMessage } from '../../lib/generationRequest';
import { buildCourseIntentPayload, submitCourseIntent } from './dialogueCourseIntent';
import type { DialogueGeneratorState } from './useDialogueGeneratorState';

export const useCreateCourseFromEpisode = (state: DialogueGeneratorState) =>
  useCallback(
    async (episodeId: string, signal: AbortSignal): Promise<string | null> => {
      if (!state.createAudioCourse || !state.audioCourseEnabled) return null;
      const ownerId = state.viewAsUserId ?? state.user?.id;
      if (!ownerId) throw new Error('Your account is still loading. Please try again.');
      const payload = buildCourseIntentPayload(state, episodeId);
      const intent =
        readGenerationIntent<CourseGenerationIntentPayload>(ownerId, 'dialogue-course') ??
        writeGenerationIntent(ownerId, 'dialogue-course', payload);
      return (await submitCourseIntent(state, intent, signal)).courseId;
    },
    // The callback's state setters and service methods are stable; form fields are listed below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      state.audioCourseEnabled,
      state.courseMaxDuration,
      state.courseNarratorVoice,
      state.courseTitle,
      state.createAudioCourse,
      state.jlptLevel,
      state.nativeLanguage,
      state.speakers,
      state.targetLanguage,
      state.user?.id,
      state.viewAsUserId,
    ]
  );

const recoverCourseIntent = async (
  state: DialogueGeneratorState,
  intent: GenerationIntent<CourseGenerationIntentPayload>
) => {
  const { courseRecoveryInFlightRef } = state;
  courseRecoveryInFlightRef.current = true;
  const episodeId = intent.payload.course.episodeIds?.[0];
  if (episodeId) state.setGeneratedEpisodeId(episodeId);
  state.setStep('generating');
  try {
    const { courseId } = await submitCourseIntent(state, intent);
    state.setStep('complete');
    state.invalidateLibrary();
    state.navigate(state.scopedRoute(`/app/courses/${courseId}`, intent.payload.viewAsUserId));
  } catch (error) {
    state.setCourseError(generationRequestErrorMessage(error, 'Failed to create audio course.'));
    state.setStep('complete');
  } finally {
    courseRecoveryInFlightRef.current = false;
  }
};

const shouldSkipCourseRecovery = (state: DialogueGeneratorState, ownerId: string | undefined) =>
  !ownerId ||
  state.courseRecoveryAttemptedForOwnerRef.current === ownerId ||
  state.courseRecoveryInFlightRef.current;

const useCourseIntentRecovery = (state: DialogueGeneratorState) => {
  const { courseRecoveryAttemptedForOwnerRef } = state;
  useEffect(() => {
    const ownerId = state.viewAsUserId ?? state.user?.id;
    if (shouldSkipCourseRecovery(state, ownerId)) return;
    courseRecoveryAttemptedForOwnerRef.current = ownerId!;
    try {
      const intent = readGenerationIntent<CourseGenerationIntentPayload>(
        ownerId!,
        'dialogue-course'
      );
      if (intent) recoverCourseIntent(state, intent).catch(() => undefined);
    } catch (error) {
      state.setCourseError(
        error instanceof Error ? error.message : 'Could not recover the saved course request.'
      );
    }
    // The state object is re-created every render; listed fields define this recovery lifecycle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    state.invalidateLibrary,
    state.navigate,
    state.scopedRoute,
    state.user?.id,
    state.viewAsUserId,
  ]);
};

const abandonConflictedCourseRequest = (state: DialogueGeneratorState) => {
  if (!state.conflictedCourseIntent) return;
  try {
    abandonGenerationIntent(state.conflictedCourseIntent);
    state.setConflictedCourseIntent(null);
    state.setCourseError(null);
  } catch (error) {
    state.setCourseError(error instanceof Error ? error.message : 'Could not clear the request.');
  }
};

const useDialogueCourseGeneration = (
  state: DialogueGeneratorState,
  createCourseFromEpisode: ReturnType<typeof useCreateCourseFromEpisode>
) => {
  useCourseIntentRecovery(state);
  return {
    abandonConflictedCourseRequest: () => abandonConflictedCourseRequest(state),
    createCourseFromEpisode,
  };
};

export type DialogueCourseGeneration = ReturnType<typeof useDialogueCourseGeneration>;

export default useDialogueCourseGeneration;
