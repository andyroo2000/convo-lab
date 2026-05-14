import {
  DEFAULT_NARRATOR_VOICES,
  MANUAL_STUDY_CARD_DEFAULT_VOICE_IDS,
  selectManualStudyCardDefaultVoiceId,
} from '@languageflow/shared/src/constants-new';
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
  _creationKind: StudyCardCreationKind
): string {
  return selectManualStudyCardDefaultVoiceId();
}

export function isStudyCardCreationDefaultVoice(voiceId: string): boolean {
  return (
    voiceId === DEFAULT_NARRATOR_VOICES.ja ||
    MANUAL_STUDY_CARD_DEFAULT_VOICE_IDS.some((manualVoiceId) => manualVoiceId === voiceId)
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
