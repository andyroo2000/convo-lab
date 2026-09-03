import { useCallback, useEffect } from 'react';

import {
  abandonGenerationIntent,
  type GenerationIntent,
  readGenerationIntent,
  writeGenerationIntent,
} from '../../lib/generationIntentStore';
import { generationRequestErrorMessage } from '../../lib/generationRequest';
import {
  buildDialogueGenerationIntentPayload,
  getDialogueGenerationValidationError,
  type DialogueGenerationIntentPayload,
} from './dialogueGenerationRequest';
import {
  acknowledgeRejectedDialogueIntent,
  submitDialogueIntent,
} from './dialogueIntentSubmission';
import type { DialogueGeneratorState } from './useDialogueGeneratorState';

const useRunDialogueIntent = (state: DialogueGeneratorState) => {
  const { submissionInFlightRef } = state;
  return useCallback(
    async (intent: GenerationIntent<DialogueGenerationIntentPayload>) => {
      state.setGenerationError(null);
      state.setConflictedIntent(null);
      state.setCourseError(null);
      state.setStep('generating');
      try {
        await submitDialogueIntent(state, intent);
      } catch (error) {
        acknowledgeRejectedDialogueIntent(state, intent, error);
        console.error('Failed to generate dialogue:', error);
        state.setGenerationError(
          generationRequestErrorMessage(error, 'Failed to generate dialogue. Please try again.')
        );
        state.setStep('input');
      } finally {
        submissionInFlightRef.current = false;
      }
    },
    // The callback only depends on the two API operations; state setters and refs are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.createEpisode, state.generateDialogue]
  );
};

type RunDialogueIntent = ReturnType<typeof useRunDialogueIntent>;

const shouldSkipDialogueRecovery = (state: DialogueGeneratorState, ownerId: string | undefined) =>
  !ownerId ||
  state.dialogueRecoveryAttemptedForOwnerRef.current === ownerId ||
  state.submissionInFlightRef.current;

const useDialogueIntentRecovery = (state: DialogueGeneratorState, runIntent: RunDialogueIntent) => {
  const { dialogueRecoveryAttemptedForOwnerRef, submissionInFlightRef } = state;
  useEffect(() => {
    const ownerId = state.viewAsUserId ?? state.user?.id;
    if (shouldSkipDialogueRecovery(state, ownerId)) return;
    dialogueRecoveryAttemptedForOwnerRef.current = ownerId!;
    try {
      const intent = readGenerationIntent<DialogueGenerationIntentPayload>(ownerId!, 'dialogue');
      if (!intent) return;
      submissionInFlightRef.current = true;
      runIntent(intent).catch(() => undefined);
    } catch (error) {
      state.setGenerationError(
        error instanceof Error ? error.message : 'Could not recover the saved generation request.'
      );
    }
    // The state object is re-created every render; listed fields define this recovery lifecycle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runIntent, state.user?.id, state.viewAsUserId]);
};

const getDialogueValidationError = (state: DialogueGeneratorState) =>
  getDialogueGenerationValidationError({
    sourceText: state.sourceText,
    speakers: state.speakers,
    createAudioCourse: state.createAudioCourse,
    audioCourseEnabled: state.audioCourseEnabled,
    courseTitle: state.courseTitle,
    courseNarratorVoice: state.courseNarratorVoice,
  });

const buildDialogueIntentPayload = (state: DialogueGeneratorState) =>
  buildDialogueGenerationIntentPayload({
    title: state.t('dialogue:placeholderTitle'),
    sourceText: state.sourceText,
    targetLanguage: state.targetLanguage,
    nativeLanguage: state.nativeLanguage,
    speakers: state.speakers,
    jlptLevel: state.jlptLevel,
    autoGenerateAudio: state.autoGenerateAudio,
    dialogueLength: state.dialogueLength,
    vocabSeedOverride: state.vocabSeedOverride,
    grammarSeedOverride: state.grammarSeedOverride,
    viewAsUserId: state.viewAsUserId,
  });

const generateDialogueFromForm = async (
  state: DialogueGeneratorState,
  runIntent: RunDialogueIntent
) => {
  const { submissionInFlightRef } = state;
  if (submissionInFlightRef.current) return;
  if (state.isDemo) {
    state.setShowDemoModal(true);
    return;
  }
  const validationError = getDialogueValidationError(state);
  if (validationError) {
    // eslint-disable-next-line no-alert
    alert(state.t(validationError));
    return;
  }
  const ownerId = state.viewAsUserId ?? state.user?.id;
  if (!ownerId) {
    state.setGenerationError('Your account is still loading. Please try again.');
    return;
  }
  try {
    const payload = buildDialogueIntentPayload(state);
    const intent =
      readGenerationIntent<DialogueGenerationIntentPayload>(ownerId, 'dialogue') ??
      writeGenerationIntent(ownerId, 'dialogue', payload);
    submissionInFlightRef.current = true;
    await runIntent(intent);
  } catch (error) {
    state.setGenerationError(
      error instanceof Error ? error.message : 'Could not save the generation request.'
    );
  }
};

const abandonConflictedRequest = (state: DialogueGeneratorState) => {
  if (!state.conflictedIntent) return;
  try {
    abandonGenerationIntent(state.conflictedIntent);
    state.setConflictedIntent(null);
    state.setGenerationError(null);
  } catch (error) {
    state.setGenerationError(
      error instanceof Error ? error.message : 'Could not clear the request.'
    );
  }
};

const useDialogueIntentGeneration = (state: DialogueGeneratorState) => {
  const runDialogueIntent = useRunDialogueIntent(state);
  useDialogueIntentRecovery(state, runDialogueIntent);
  return {
    abandonConflictedRequest: () => abandonConflictedRequest(state),
    handleGenerate: () => generateDialogueFromForm(state, runDialogueIntent),
  };
};

export type DialogueIntentGeneration = ReturnType<typeof useDialogueIntentGeneration>;

export default useDialogueIntentGeneration;
