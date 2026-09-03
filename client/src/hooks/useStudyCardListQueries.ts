import { useMemo } from 'react';

import { useStudyLearningItemsInfinite, useStudyNewCardQueueInfinite } from './useStudy';

interface StudyCardListQueryOptions {
  enabled: boolean;
  mode: 'queue' | 'all';
  searchQuery: string;
}

export const uniqueStudyItemsById = <T extends { id: string }>(items: T[]) => {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
};

const useStudyCardListQueries = ({ enabled, mode, searchQuery }: StudyCardListQueryOptions) => {
  const learningItemsQuery = useStudyLearningItemsInfinite({
    enabled: enabled && mode === 'all',
    query: searchQuery,
  });
  const queueQuery = useStudyNewCardQueueInfinite({ enabled: enabled && mode === 'queue' });
  const learningItems = useMemo(
    () => uniqueStudyItemsById(learningItemsQuery.data?.pages.flatMap((page) => page.items) ?? []),
    [learningItemsQuery.data]
  );

  return { learningItems, learningItemsQuery, queueQuery };
};

export default useStudyCardListQueries;
