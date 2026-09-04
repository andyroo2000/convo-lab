import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { useNavigate } from 'react-router-dom';
import type { DragEndEvent } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import type { StudyNewCardQueueItem } from '@languageflow/shared/src/types';
import { useTranslation } from 'react-i18next';

import {
  createStudyIntroductionCohortId,
  useCreateStudyLessonFollowupCohort,
  useReorderStudyNewCardQueue,
} from './useStudy';
import useStudyBackgroundTask from './useStudyBackgroundTask';
import useStudyCardListQueries, { uniqueStudyItemsById } from './useStudyCardListQueries';

type QueueData = ReturnType<typeof useStudyCardListQueries>['queueQuery']['data'];

const useSynchronizedQueueItems = (queueData: QueueData) => {
  const [queueItems, setQueueItems] = useState<StudyNewCardQueueItem[]>([]);
  const queueDataRef = useRef(queueData);
  queueDataRef.current = queueData;
  const previousPageCountRef = useRef(0);
  const previousFirstPageSignatureRef = useRef('');
  const pageSignature = useMemo(
    () =>
      queueData?.pages
        .map((page) => `${page.nextCursor ?? 'end'}:${page.items.map((item) => item.id).join(',')}`)
        .join('|') ?? '',
    [queueData]
  );

  useEffect(() => {
    const pages = queueDataRef.current?.pages ?? [];
    const loadedItems = uniqueStudyItemsById(pages.flatMap((page) => page.items));
    const firstPageSignature = pages[0]?.items.map((item) => item.id).join(',') ?? '';
    const previousPageCount = previousPageCountRef.current;
    // Only a larger page count with an unchanged first page is an append.
    // Any first-page change is authoritative server data from a refresh/reset.
    const isPageAppend =
      previousPageCount > 0 &&
      pages.length > previousPageCount &&
      firstPageSignature === previousFirstPageSignatureRef.current;

    setQueueItems((current) =>
      isPageAppend
        ? uniqueStudyItemsById([
            ...current,
            ...pages.slice(previousPageCount).flatMap((page) => page.items),
          ])
        : loadedItems
    );
    previousPageCountRef.current = pages.length;
    previousFirstPageSignatureRef.current = firstPageSignature;
  }, [pageSignature]);

  return [queueItems, setQueueItems] as const;
};

const reorderIndexes = (event: DragEndEvent, items: StudyNewCardQueueItem[]) => {
  const { active, over } = event;
  if (!over || active.id === over.id) return null;
  const oldIndex = items.findIndex((item) => item.id === active.id);
  const newIndex = items.findIndex((item) => item.id === over.id);
  return oldIndex < 0 || newIndex < 0 ? null : { oldIndex, newIndex };
};

interface UseQueueReorderOptions {
  items: StudyNewCardQueueItem[];
  setItems: Dispatch<SetStateAction<StudyNewCardQueueItem[]>>;
  disabled: boolean;
}

const useQueueReorder = ({ items, setItems, disabled }: UseQueueReorderOptions) => {
  const { t } = useTranslation('study');
  const [error, setError] = useState<string | null>(null);
  const mutation = useReorderStudyNewCardQueue();
  const runBackgroundTask = useStudyBackgroundTask();

  const handleDragEnd = (event: DragEndEvent) => {
    if (disabled) return;
    const indexes = reorderIndexes(event, items);
    if (!indexes) return;

    const previousItems = items;
    const nextItems = arrayMove(items, indexes.oldIndex, indexes.newIndex);
    setItems(nextItems);
    setError(null);
    runBackgroundTask(
      async () => {
        try {
          await mutation.mutateAsync({ cardIds: nextItems.map((item) => item.id) });
        } catch (reorderError) {
          setItems(previousItems);
          setError(reorderError instanceof Error ? reorderError.message : t('cards.reorderFailed'));
          throw reorderError;
        }
      },
      { label: 'Study new-card reorder' }
    );
  };

  return { error, setError, handleDragEnd };
};

interface UseLessonFollowupOptions {
  items: StudyNewCardQueueItem[];
  selectedIds: Set<string>;
  label: string;
  setQueueError: Dispatch<SetStateAction<string | null>>;
}

const useLessonFollowup = ({
  items,
  selectedIds,
  label,
  setQueueError,
}: UseLessonFollowupOptions) => {
  const { t } = useTranslation('study');
  const navigate = useNavigate();
  const mutation = useCreateStudyLessonFollowupCohort();
  const runBackgroundTask = useStudyBackgroundTask();
  const creatingRef = useRef(false);

  const start = () => {
    if (creatingRef.current) return;
    const cardIds = items.filter((item) => selectedIds.has(item.id)).map((item) => item.id);
    if (cardIds.length === 0) return;

    creatingRef.current = true;
    setQueueError(null);
    runBackgroundTask(
      async () => {
        try {
          const cohort = await mutation.mutateAsync({
            cohortId: createStudyIntroductionCohortId(),
            cardIds,
            label: label.trim() || null,
          });
          navigate(`/app/study?lessonCohortId=${encodeURIComponent(cohort.id)}`);
        } catch (error) {
          setQueueError(
            error instanceof Error ? error.message : t('cards.lessonFollowupCreateFailed')
          );
          throw error;
        } finally {
          creatingRef.current = false;
        }
      },
      { label: 'Create lesson follow-up cohort' }
    );
  };

  return { start, isPending: mutation.isPending };
};

const useStudyCardsQueue = (queueData: QueueData) => {
  const [items, setItems] = useSynchronizedQueueItems(queueData);
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [label, setLabel] = useState('');
  const reorderDisabled = items.length > 100;
  const reorder = useQueueReorder({
    items,
    setItems,
    disabled: reorderDisabled || selecting,
  });
  const lesson = useLessonFollowup({ items, selectedIds, label, setQueueError: reorder.setError });

  const cancelLesson = () => {
    setSelecting(false);
    setSelectedIds(new Set());
    setLabel('');
    reorder.setError(null);
  };

  return {
    items,
    reorderDisabled,
    queueError: reorder.error,
    handleDragEnd: reorder.handleDragEnd,
    selecting,
    setSelecting,
    selectedIds,
    setSelectedIds,
    label,
    setLabel,
    startLesson: lesson.start,
    cancelLesson,
    isCreatingLesson: lesson.isPending,
  };
};

export default useStudyCardsQueue;
