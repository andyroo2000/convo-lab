import type { StudyPromptPayload } from '@languageflow/shared/src/types.js';

import { isRecord } from './guards.js';

type NonAudioPromptKey = Exclude<keyof StudyPromptPayload, 'cueAudio'>;

function hasMeaningfulPromptValue(value: unknown): boolean {
  if (typeof value === 'string') {
    return value.trim().length > 0;
  }

  return isRecord(value);
}

export function isAudioRecognitionPrompt(prompt: StudyPromptPayload): boolean {
  if (!isRecord(prompt.cueAudio)) {
    return false;
  }

  const nonAudioPromptValuesByField = {
    cueText: prompt.cueText,
    cueReading: prompt.cueReading,
    cueMeaning: prompt.cueMeaning,
    cueImage: prompt.cueImage,
    clozeText: prompt.clozeText,
    clozeDisplayText: prompt.clozeDisplayText,
    clozeAnswerText: prompt.clozeAnswerText,
    clozeHint: prompt.clozeHint,
    clozeResolvedHint: prompt.clozeResolvedHint,
  } satisfies Record<NonAudioPromptKey, unknown>;

  return !Object.values(nonAudioPromptValuesByField).some(hasMeaningfulPromptValue);
}
