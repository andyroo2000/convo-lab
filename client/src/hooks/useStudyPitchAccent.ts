import { useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import type { JapanesePitchAccentPayload, StudyCardSummary } from '@languageflow/shared/src/types';

import { resolveStudyCardPitchAccent } from './useStudy';
import { getStudyCardPresentation } from '../components/study/studyCardUtils';

const shouldResolvePitchAccent = (pitchAccent: JapanesePitchAccentPayload | null | undefined) =>
  !pitchAccent || pitchAccent.status === 'unresolved';

export default function useStudyPitchAccent(
  card: StudyCardSummary,
  enabled: boolean
): {
  pitchAccent: JapanesePitchAccentPayload | null;
  isLoading: boolean;
} {
  const mutation = useMutation({
    mutationFn: resolveStudyCardPitchAccent,
  });
  const { data, isError, isPending, mutate, reset } = mutation;
  const resolvedCard = data?.id === card.id ? data : null;
  const resolvedPresentation = resolvedCard ? getStudyCardPresentation(resolvedCard) : null;
  const rawPitchAccent = card.answer.pitchAccent;
  const presentation = getStudyCardPresentation(card);
  const pitchAccentForResolution = presentation ? presentation.answer.pitchAccent : rawPitchAccent;

  useEffect(() => {
    reset();
  }, [card.id, reset]);

  useEffect(() => {
    // Keep failed requests quiet for the current card; changing cards resets the mutation above.
    if (
      enabled &&
      shouldResolvePitchAccent(pitchAccentForResolution) &&
      !resolvedCard &&
      !isPending &&
      !isError
    ) {
      mutate(card.id);
    }
  }, [card.id, enabled, isError, isPending, mutate, pitchAccentForResolution, resolvedCard]);

  let pitchAccent: JapanesePitchAccentPayload | null;
  if (resolvedCard) {
    pitchAccent = resolvedPresentation
      ? resolvedPresentation.answer.pitchAccent
      : (resolvedCard.answer.pitchAccent ?? null);
  } else {
    pitchAccent = presentation ? presentation.answer.pitchAccent : (rawPitchAccent ?? null);
  }

  return {
    pitchAccent,
    isLoading: isPending,
  };
}
