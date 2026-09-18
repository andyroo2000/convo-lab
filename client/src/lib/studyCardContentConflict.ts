import type { StudyCardSummary } from '@languageflow/shared/src/types';

import { JsonRequestError } from './apiClient';
import { decodeStudyCardSummary } from './learningOsContractDecoders';

interface CardEditSnapshot {
  cardId: string;
  expectedRevision: number;
  baseCard?: StudyCardSummary;
}

const canonicalJson = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (typeof value !== 'object' || value === null) return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonicalJson(entry)])
  );
};

const editableContent = (card: StudyCardSummary) => {
  // Pitch accent is cached while viewing the answer. Every other prompt/answer
  // field, including media and readings, must still match the loaded snapshot.
  const answer = { ...card.answer };
  delete answer.pitchAccent;
  return JSON.stringify(canonicalJson([card.cardType, card.prompt, answer]));
};

const conflictCard = (error: unknown): StudyCardSummary | null => {
  if (!(error instanceof JsonRequestError) || error.status !== 409) return null;
  const { payload } = error;
  if (typeof payload !== 'object' || payload === null) return null;
  if (!('code' in payload) || payload.code !== 'card_revision_conflict') return null;
  if (!('card' in payload)) return null;
  try {
    return decodeStudyCardSummary(payload.card);
  } catch {
    return null;
  }
};

const matchingBaseCard = (snapshot: CardEditSnapshot): StudyCardSummary | null => {
  const { baseCard, cardId, expectedRevision } = snapshot;
  if (!baseCard || baseCard.id !== cardId) return null;
  if ((baseCard.revision ?? 0) !== expectedRevision) return null;
  return baseCard;
};

export default function metadataOnlyRetryRevision(
  error: unknown,
  snapshot: CardEditSnapshot
): number | null {
  const baseCard = matchingBaseCard(snapshot);
  if (!baseCard) return null;
  const current = conflictCard(error);
  if (!current || current.id !== snapshot.cardId) return null;
  if (current.revision === undefined || current.revision <= snapshot.expectedRevision) return null;
  if (editableContent(baseCard) !== editableContent(current)) return null;
  return current.revision;
}
