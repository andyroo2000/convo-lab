import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getStudyPiles,
  saveStudyPile,
  type StudyPile,
  type StudyPileAttributes,
  type StudyPileCatalog,
} from '../lib/studyPilesApi';
import { invalidateStudyQueries } from '../lib/studyQueryInvalidation';

const pileQueryKey = ['study', 'piles'];
const pileMutationKey = ['study', 'save-pile'];
interface PileChange {
  id: string;
  attributes: StudyPileAttributes;
  pileId?: string;
}

function applyPileChange(pile: StudyPile, { id, attributes, pileId }: PileChange): StudyPile {
  if (!pileId) return pile.id === id ? { ...pile, ...attributes } : pile;
  if (pile.id !== pileId) return pile;
  return {
    ...pile,
    chapters: pile.chapters.map((chapter) =>
      chapter.id === id ? { ...chapter, ...attributes } : chapter
    ),
  };
}

export function useStudyPiles() {
  return useQuery({ queryKey: pileQueryKey, queryFn: getStudyPiles, staleTime: 15_000 });
}
export function useSaveStudyPile() {
  const queryClient = useQueryClient();
  const cancelRefresh = () => queryClient.cancelQueries({ queryKey: pileQueryKey });
  return useMutation({
    mutationKey: pileMutationKey,
    mutationFn: ({ id, attributes, pileId }: PileChange) => saveStudyPile(id, attributes, pileId),
    onMutate: cancelRefresh,
    onSuccess: async (_response, change) => {
      // A focus refresh may have started during the save; discard its old snapshot.
      await cancelRefresh();
      queryClient.setQueryData<StudyPileCatalog>(pileQueryKey, (catalog) =>
        catalog
          ? { ...catalog, piles: catalog.piles.map((pile) => applyPileChange(pile, change)) }
          : catalog
      );
    },
    onSettled: () => {
      // Refresh once after overlapping saves, without keeping the checkboxes disabled.
      if (queryClient.isMutating({ mutationKey: pileMutationKey }) === 1) {
        invalidateStudyQueries(queryClient, ['piles', 'overview', 'new-queue']).catch(
          () => undefined
        );
      }
    },
  });
}
