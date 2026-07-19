import { useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import type { JapanesePitchAccentPayload, StudyCardSummary } from '@languageflow/shared/src/types';

import { resolveStudyCardPitchAccent } from './useStudy';

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

  useEffect(() => {
    reset();
  }, [card.id, reset]);

  useEffect(() => {
    // Keep failed requests quiet for the current card; changing cards resets the mutation above.
    if (
      enabled &&
      shouldResolvePitchAccent(card.answer.pitchAccent) &&
      !resolvedCard &&
      !isPending &&
      !isError
    ) {
      mutate(card.id);
    }
  }, [card.answer.pitchAccent, card.id, enabled, isError, isPending, mutate, resolvedCard]);

  return {
    pitchAccent: resolvedCard?.answer.pitchAccent ?? card.answer.pitchAccent ?? null,
    isLoading: isPending,
  };
}
