import type { StudyCardCandidateKind, StudyCardType } from '@languageflow/shared/src/types.js';

export const STUDY_CARD_CANDIDATE_KINDS = new Set<StudyCardCandidateKind>([
  'text-recognition',
  'audio-recognition',
  'production',
  'cloze',
]);

export function cardTypeForStudyCardCandidateKind(
  candidateKind: StudyCardCandidateKind
): StudyCardType {
  if (candidateKind === 'production') return 'production';
  if (candidateKind === 'cloze') return 'cloze';
  return 'recognition';
}
