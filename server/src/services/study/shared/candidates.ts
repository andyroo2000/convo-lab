import type {
  StudyCardCandidateKind,
  StudyCardCreationKind,
  StudyCardImagePlacement,
  StudyCardType,
} from '@languageflow/shared/src/types.js';

export const STUDY_CARD_CANDIDATE_KINDS = new Set<StudyCardCandidateKind>([
  'text-recognition',
  'audio-recognition',
  'production',
  'cloze',
]);

export const STUDY_CARD_CREATION_KINDS = new Set<StudyCardCreationKind>([
  'text-recognition',
  'audio-recognition',
  'production-text',
  'production-image',
  'cloze',
]);

export const STUDY_CARD_IMAGE_PLACEMENTS = new Set<StudyCardImagePlacement>([
  'none',
  'prompt',
  'answer',
  'both',
]);

export function cardTypeForStudyCardCandidateKind(
  candidateKind: StudyCardCandidateKind
): StudyCardType {
  if (candidateKind === 'production') return 'production';
  if (candidateKind === 'cloze') return 'cloze';
  return 'recognition';
}

export function cardTypeForStudyCardCreationKind(
  creationKind: StudyCardCreationKind
): StudyCardType {
  if (creationKind === 'production-text' || creationKind === 'production-image') {
    return 'production';
  }
  if (creationKind === 'cloze') return 'cloze';
  return 'recognition';
}
