import { useQuery } from '@tanstack/react-query';
import { getStudyPiles, saveStudyPile, type StudyPileAttributes } from '../lib/studyPilesApi';
import useStudyMutationWithInvalidations from '../lib/studyQueryInvalidation';

export function useStudyPiles() {
  return useQuery({ queryKey: ['study', 'piles'], queryFn: getStudyPiles, staleTime: 15_000 });
}
export function useSaveStudyPile() {
  return useStudyMutationWithInvalidations(
    ({
      id,
      attributes,
      pileId,
    }: {
      id: string;
      attributes: StudyPileAttributes;
      pileId?: string;
    }) => saveStudyPile(id, attributes, pileId),
    ['piles', 'overview', 'new-queue']
  );
}
