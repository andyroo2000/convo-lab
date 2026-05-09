import type { StudyVocabVariantKind } from '@languageflow/shared/src/types.js';

export const STUDY_VARIANT_SUCCESS_RATINGS = new Set([3, 4]);
export const STUDY_VARIANT_WIN_THRESHOLD = 2;

export const STUDY_VOCAB_VARIANT_STAGES = {
  sentenceAudio: 1,
  sentenceText: 2,
  wordAudio: 3,
  wordText: 4,
  sentenceCloze: 5,
} as const;

export const STUDY_VOCAB_VARIANT_KINDS_BY_STAGE: Record<number, StudyVocabVariantKind> = {
  [STUDY_VOCAB_VARIANT_STAGES.sentenceAudio]: 'sentence_audio_recognition',
  [STUDY_VOCAB_VARIANT_STAGES.sentenceText]: 'sentence_text_recognition',
  [STUDY_VOCAB_VARIANT_STAGES.wordAudio]: 'word_audio_recognition',
  [STUDY_VOCAB_VARIANT_STAGES.wordText]: 'word_text_recognition',
  [STUDY_VOCAB_VARIANT_STAGES.sentenceCloze]: 'sentence_cloze',
};

export const STUDY_VOCAB_VARIANT_STAGE_LABELS: Record<StudyVocabVariantKind, string> = {
  sentence_audio_recognition: 'Sentence listening',
  sentence_text_recognition: 'Sentence recognition',
  word_audio_recognition: 'Word listening',
  word_text_recognition: 'Word recognition',
  sentence_cloze: 'Sentence cloze',
};
