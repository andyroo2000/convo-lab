import type { StudyAnswerPayload } from '@languageflow/shared/src/types.js';

const JAPANESE_TEXT_PATTERN = /[\u3040-\u30ff\u3400-\u9fff]/;

export function getEnglishClozeHintFallback(answer: StudyAnswerPayload): string | null {
  const candidates = [answer.sentenceEn, answer.meaning];
  return (
    candidates.find(
      (candidate): candidate is string =>
        typeof candidate === 'string' && !JAPANESE_TEXT_PATTERN.test(candidate)
    ) ?? null
  );
}
