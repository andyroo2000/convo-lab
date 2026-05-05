import type { StudyPromptPayload } from '@languageflow/shared/src/types.js';

import { isRecord } from './guards.js';

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

  const nonAudioPromptValues = [
    prompt.cueText,
    prompt.cueReading,
    prompt.cueMeaning,
    prompt.cueImage,
    prompt.clozeText,
    prompt.clozeDisplayText,
    prompt.clozeAnswerText,
  ];

  return !nonAudioPromptValues.some(hasMeaningfulPromptValue);
}
