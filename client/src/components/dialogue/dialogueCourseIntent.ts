import { getTtsVoiceById } from '@languageflow/shared/src/voiceSelection';

import {
  type CourseGenerationIntentPayload,
  submitCourseGenerationIntent,
} from '../../lib/courseGenerationRequest';
import {
  acknowledgeGenerationIntent,
  type GenerationIntent,
} from '../../lib/generationIntentStore';
import {
  isAcknowledgedGenerationFailure,
  isDefinitiveGenerationRejection,
} from '../../lib/generationRequest';
import type { DialogueGeneratorState } from './useDialogueGeneratorState';

const getTargetVoiceGender = (voiceId: string): 'male' | 'female' =>
  getTtsVoiceById('ja', voiceId)?.gender === 'female' ? 'female' : 'male';

export const buildCourseIntentPayload = (
  state: DialogueGeneratorState,
  episodeId: string
): CourseGenerationIntentPayload => ({
  course: {
    title: state.courseTitle.trim(),
    episodeIds: [episodeId],
    nativeLanguage: state.nativeLanguage,
    targetLanguage: state.targetLanguage,
    maxLessonDurationMinutes: state.courseMaxDuration,
    l1VoiceId: state.courseNarratorVoice,
    jlptLevel: state.jlptLevel,
    speaker1Gender: getTargetVoiceGender(state.speakers[0]?.voiceId),
    speaker2Gender: getTargetVoiceGender(state.speakers[1]?.voiceId),
    speaker1VoiceId: state.speakers[0]?.voiceId,
    speaker2VoiceId: state.speakers[1]?.voiceId,
  },
  ...(state.viewAsUserId ? { viewAsUserId: state.viewAsUserId } : {}),
});

const acknowledgeRejectedCourseIntent = (
  state: DialogueGeneratorState,
  intent: GenerationIntent<CourseGenerationIntentPayload>,
  error: unknown
) => {
  const acknowledgedFailure = isAcknowledgedGenerationFailure(error, intent.intentId);
  const definitiveRejection = isDefinitiveGenerationRejection(error);
  if (acknowledgedFailure) acknowledgeGenerationIntent(intent);
  if (definitiveRejection) acknowledgeGenerationIntent(intent);
  if (!acknowledgedFailure && !definitiveRejection) state.setConflictedCourseIntent(intent);
};

export const submitCourseIntent = async (
  state: DialogueGeneratorState,
  intent: GenerationIntent<CourseGenerationIntentPayload>,
  signal?: AbortSignal
) => {
  try {
    const result = await submitCourseGenerationIntent(intent.intentId, intent.payload, signal);
    if (result.acknowledgement.state === 'failed') {
      acknowledgeGenerationIntent(intent);
      throw new Error(result.acknowledgement.message || 'Course generation failed.');
    }
    acknowledgeGenerationIntent(intent);
    return result;
  } catch (error) {
    acknowledgeRejectedCourseIntent(state, intent, error);
    throw error;
  }
};
