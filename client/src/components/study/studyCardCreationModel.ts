import type {
  StudyCardCreationKind,
  StudyCardImagePlacement,
  StudyCardImageRole,
  StudyCardType,
  StudyMediaRef,
} from '@languageflow/shared/src/types';

import type { StudyCardFormPayload, StudyCardFormValues } from './studyCardFormModel';

export const DEFAULT_STUDY_CARD_CREATION_KIND: StudyCardCreationKind = 'text-recognition';
export const DEFAULT_STUDY_CARD_IMAGE_PLACEMENT: StudyCardImagePlacement = 'none';

export function cardTypeForStudyCardCreationKind(
  creationKind: StudyCardCreationKind
): StudyCardType {
  if (creationKind === 'cloze') return 'cloze';
  if (creationKind === 'production-text' || creationKind === 'production-image') {
    return 'production';
  }
  return 'recognition';
}

export function defaultCreationKindForCardType(cardType: StudyCardType): StudyCardCreationKind {
  if (cardType === 'production') return 'production-text';
  if (cardType === 'cloze') return 'cloze';
  return DEFAULT_STUDY_CARD_CREATION_KIND;
}

export function mergeBlankStudyCardFormFields(
  current: StudyCardFormValues,
  completed: StudyCardFormValues
): StudyCardFormValues {
  const next = { ...current };
  (Object.keys(current) as Array<keyof StudyCardFormValues>).forEach((field) => {
    if (typeof current[field] !== 'string' || typeof completed[field] !== 'string') {
      return;
    }
    if (current[field].trim().length === 0 && completed[field].trim().length > 0) {
      next[field] = completed[field] as never;
    }
  });

  return {
    ...next,
    cardType: current.cardType,
  };
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
