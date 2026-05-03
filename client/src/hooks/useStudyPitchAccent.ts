import { useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import type { JapanesePitchAccentPayload, StudyCardSummary } from '@languageflow/shared/src/types';

import { resolveStudyCardPitchAccent } from './useStudy';

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
    if (enabled && !card.answer.pitchAccent && !resolvedCard && !isPending && !isError) {
      mutate(card.id);
    }
  }, [card.answer.pitchAccent, card.id, enabled, isError, isPending, mutate, resolvedCard]);

  return {
    pitchAccent: resolvedCard?.answer.pitchAccent ?? card.answer.pitchAccent ?? null,
    isLoading: isPending,
  };
}
