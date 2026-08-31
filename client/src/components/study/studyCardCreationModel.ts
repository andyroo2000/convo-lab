import { DEFAULT_NARRATOR_VOICES } from '@languageflow/shared/src/constants-new';
import type {
  StudyCardCreationKind,
  StudyCardImagePlacement,
  StudyCardImageRole,
  StudyCardType,
  StudyMediaRef,
} from '@languageflow/shared/src/types';

import type { StudyCardFormPayload } from './studyCardFormModel';

export const DEFAULT_STUDY_CARD_CREATION_KIND: StudyCardCreationKind = 'text-recognition';
const DEFAULT_STUDY_CARD_IMAGE_PLACEMENT: StudyCardImagePlacement = 'none';

export function defaultImagePlacementForStudyCardCreationKind(
  creationKind: StudyCardCreationKind
): StudyCardImagePlacement {
  if (creationKind === 'production-image') return 'prompt';
  if (creationKind === 'cloze') return 'both';
  return DEFAULT_STUDY_CARD_IMAGE_PLACEMENT;
}

export function cardTypeForStudyCardCreationKind(
  creationKind: StudyCardCreationKind
): StudyCardType {
  if (creationKind === 'cloze') return 'cloze';
  if (creationKind === 'production-text' || creationKind === 'production-image') {
    return 'production';
  }
  return 'recognition';
}

export function defaultVoiceIdForStudyCardCreationKind(
  _creationKind: StudyCardCreationKind,
  defaultVoiceIds: readonly string[],
  randomValue = Math.random()
): string {
  if (defaultVoiceIds.length === 0) return '';
  const boundedRandomValue = Math.min(Math.max(randomValue, 0), 0.9999999999999999);
  return defaultVoiceIds[Math.floor(boundedRandomValue * defaultVoiceIds.length)] ?? '';
}

export function isStudyCardCreationDefaultVoice(
  voiceId: string,
  defaultVoiceIds: readonly string[]
): boolean {
  return (
    voiceId === DEFAULT_NARRATOR_VOICES.ja ||
    defaultVoiceIds.some((defaultVoiceId) => defaultVoiceId === voiceId)
  );
}

export function applyStudyCardImageToPayload(
  payload: StudyCardFormPayload,
  image: StudyMediaRef | null,
  imagePlacement: StudyCardImageRole | StudyCardImagePlacement
): StudyCardFormPayload {
  if (!image || imagePlacement === 'none') {
    return payload;
  }

  return {
    ...payload,
    prompt:
      imagePlacement === 'prompt' || imagePlacement === 'both'
        ? { ...payload.prompt, cueImage: image }
        : payload.prompt,
    answer:
      imagePlacement === 'answer' || imagePlacement === 'both'
        ? { ...payload.answer, answerImage: image }
        : payload.answer,
  };
}
