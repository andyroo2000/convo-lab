import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type {
  StudyLearningItem,
  StudyLearningItemStageStatus,
  StudyNewCardQueueItem,
} from '@languageflow/shared/src/types';
import {
  BookOpenCheck,
  CheckCircle2,
  ChevronDown,
  GripVertical,
  Layers3,
  LockKeyhole,
  Plus,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { useFeatureFlags } from '../hooks/useFeatureFlags';
import {
  createStudyIntroductionCohortId,
  useCreateStudyLessonFollowupCohort,
  useReorderStudyNewCardQueue,
  useStudyLearningItemsInfinite,
  useStudyNewCardQueueInfinite,
} from '../hooks/useStudy';
import useStudyBackgroundTask from '../hooks/useStudyBackgroundTask';

type CollectionMode = 'queue' | 'all';

const uniqueById = <T extends { id: string }>(items: T[]) => {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
};

const browserHref = (cardId: string, noteId: string | null) => {
  const params = new URLSearchParams({ cardId });
  // Native/manual cards are their own browser group and do not expose a note id.
  params.set('noteId', noteId ?? cardId);
  return `/app/study/browse?${params.toString()}`;
};

const stageStatusClass = (status: StudyLearningItemStageStatus, isCurrent: boolean) => {
  if (status === 'retired') return 'bg-green-500';
  if (isCurrent) return 'bg-navy';
  if (status === 'available') return 'bg-sky-300';
  return 'bg-gray-200';
};

const LearningItemRow = ({ item }: { item: StudyLearningItem }) => {
  const { t } = useTranslation('study');
  const isPath = item.groupId !== null;
  // Keep the family row's title and destination stable as later stages unlock.
  const destinationCard = item.representativeCard;

  if (!isPath) {
    return (
      <li className="border-b border-navy/10 bg-white/70 last:border-b-0">
        <Link
          to={browserHref(destinationCard.id, destinationCard.noteId)}
          className="block px-4 py-4 hover:bg-cream/60 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-navy"
        >
          <p className="break-words font-bold text-navy">{destinationCard.displayText}</p>
          {destinationCard.meaning ? (
            <p className="mt-1 line-clamp-2 break-words text-sm text-gray-600">
              {destinationCard.meaning}
            </p>
          ) : null}
          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.12em] text-gray-400">
            {t(`form.${destinationCard.cardType}`)}
          </p>
        </Link>
      </li>
    );
  }

  return (
    <li
      className="border-b border-navy/10 bg-white/70 px-4 py-4 last:border-b-0"
      data-testid="study-learning-item"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 rounded-lg bg-sky-100 p-2 text-navy" aria-hidden="true">
          <Layers3 className="h-4 w-4" />
        </span>
        <Link
          to={browserHref(destinationCard.id, destinationCard.noteId)}
          className="min-w-0 flex-1 rounded focus:outline-none focus:ring-2 focus:ring-navy"
        >
          <div className="flex flex-wrap items-center gap-2">
            <p className="break-words font-bold text-navy">{item.representativeCard.displayText}</p>
            {item.transferDemonstrated ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-1 text-[0.65rem] font-bold uppercase tracking-wide text-green-700">
                <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                {t('cards.transferDemonstrated')}
              </span>
            ) : null}
          </div>
          {item.representativeCard.meaning ? (
            <p className="mt-1 line-clamp-2 break-words text-sm text-gray-600">
              {item.representativeCard.meaning}
            </p>
          ) : null}
          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.12em] text-sky-700">
            {t('cards.learningPathItem')} ·{' '}
            {item.currentStageNumber === null
              ? t('cards.stageCount', { count: item.stageCount })
              : t('cards.stageProgress', {
                  current: item.currentStageNumber,
                  total: item.stageCount,
                })}{' '}
            · {t('cards.cardCount', { count: item.cardCount })}
          </p>
        </Link>
      </div>

      <div
        className="mt-3 grid gap-1"
        style={{ gridTemplateColumns: `repeat(${Math.max(item.stageCount, 1)}, minmax(0, 1fr))` }}
        role="img"
        aria-label={
          item.currentStageNumber === null
            ? t('cards.pathProgressPending', { total: item.stageCount })
            : t('cards.pathProgressLabel', {
                current: item.currentStageNumber,
                total: item.stageCount,
              })
        }
      >
        {item.stages.map((stage, index) => (
          <span
            key={stage.number ?? stage.representativeCard.syncId}
            className={`h-1.5 rounded-full ${stageStatusClass(
              stage.status,
              stage.number === item.currentStageNumber
            )}`}
            title={t('learningPath.stage', { number: stage.number ?? index + 1 })}
          />
        ))}
      </div>

      <details className="group mt-3 rounded-xl border border-navy/10 bg-white/60">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-sm font-semibold text-navy focus:outline-none focus:ring-2 focus:ring-inset focus:ring-navy">
          {t('cards.viewStages', { count: item.stageCount })}
          <ChevronDown
            className="h-4 w-4 transition-transform group-open:rotate-180"
            aria-hidden="true"
          />
        </summary>
        <ol className="space-y-2 border-t border-navy/10 p-3">
          {item.stages.map((stage, stageIndex) => (
            <li
              key={stage.number ?? stage.representativeCard.syncId}
              className="rounded-lg bg-cream/50 p-3"
            >
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-[0.12em] text-navy">
                  {t('learningPath.stage', { number: stage.number ?? stageIndex + 1 })}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 text-[0.65rem] font-semibold text-gray-600">
                  {stage.status === 'locked' ? (
                    <LockKeyhole className="h-3 w-3" aria-hidden="true" />
                  ) : null}
                  {stage.status
                    ? t(`learningPath.status.${stage.status}`)
                    : t('cards.independentStage')}
                  {' · '}
                  {t('cards.cardCount', { count: stage.cardCount })}
                </span>
              </div>
              <ul className="space-y-1">
                {stage.cards.map((card) => (
                  <li key={card.syncId}>
                    <Link
                      to={browserHref(card.id, card.noteId)}
                      className="block rounded-lg px-2 py-2 hover:bg-white focus:outline-none focus:ring-2 focus:ring-navy"
                    >
                      <span className="block break-words text-sm font-semibold text-navy">
                        {card.displayText}
                      </span>
                      {card.meaning ? (
                        <span className="block break-words text-xs text-gray-600">
                          {card.meaning}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </details>
    </li>
  );
};

const useInfiniteScroll = (enabled: boolean, loadMore: () => void) => {
  const targetRef = useRef<HTMLDivElement | null>(null);
  const loadMoreRef = useRef(loadMore);
  loadMoreRef.current = loadMore;

  useEffect(() => {
    const target = targetRef.current;
    if (!enabled || !target) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) loadMoreRef.current();
      },
      { rootMargin: '320px 0px' }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [enabled]);

  return targetRef;
};

interface QueueRowProps {
  item: StudyNewCardQueueItem;
  ordinal: number;
  reorderDisabled: boolean;
  selectionMode: boolean;
  selected: boolean;
  onToggleSelected: () => void;
}

const QueueRow = ({
  item,
  ordinal,
  reorderDisabled,
  selectionMode,
  selected,
  onToggleSelected,
}: QueueRowProps) => {
  const { t } = useTranslation('study');
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-start gap-3 border-b border-navy/10 bg-white/70 px-4 py-4 last:border-b-0 ${
        isDragging ? 'relative z-10 shadow-lg ring-2 ring-navy/30' : ''
      }`}
      data-testid="study-new-queue-row"
    >
      {selectionMode ? (
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelected}
          aria-label={t('cards.selectForLessonFollowup', { text: item.displayText })}
          className="mt-1 h-5 w-5 rounded border-gray-300 text-navy focus:ring-navy"
        />
      ) : (
        <button
          type="button"
          className="mt-0.5 rounded p-1 text-gray-400 hover:bg-cream hover:text-navy focus:outline-none focus:ring-2 focus:ring-navy"
          aria-label={t('cards.dragHandle', { text: item.displayText })}
          disabled={reorderDisabled}
          title={reorderDisabled ? t('cards.reorderLimit') : undefined}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-5 w-5" aria-hidden="true" />
        </button>
      )}
      <span className="mt-1 w-8 shrink-0 text-right font-mono text-xs font-bold text-gray-500">
        {ordinal}
      </span>
      <Link
        to={browserHref(item.id, item.noteId)}
        className="min-w-0 flex-1 rounded focus:outline-none focus:ring-2 focus:ring-navy"
      >
        <p className="break-words text-base font-bold text-navy">{item.displayText}</p>
        {item.meaning ? (
          <p className="mt-1 line-clamp-2 break-words text-sm text-gray-600">{item.meaning}</p>
        ) : null}
      </Link>
    </li>
  );
};

const StudyCardsPage = () => {
  const { t } = useTranslation('study');
  const navigate = useNavigate();
  const { isFeatureEnabled } = useFeatureFlags();
  const enabled = isFeatureEnabled('flashcardsEnabled');
  const [mode, setMode] = useState<CollectionMode>('queue');
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [queueItems, setQueueItems] = useState<StudyNewCardQueueItem[]>([]);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [selectingLessonFollowup, setSelectingLessonFollowup] = useState(false);
  const [selectedLessonCardIds, setSelectedLessonCardIds] = useState<Set<string>>(new Set());
  const [lessonLabel, setLessonLabel] = useState('');
  const queueQuery = useStudyNewCardQueueInfinite(enabled && mode === 'queue');
  const learningItemsQuery = useStudyLearningItemsInfinite(enabled && mode === 'all', searchQuery);
  const reorderMutation = useReorderStudyNewCardQueue();
  const createLessonFollowupMutation = useCreateStudyLessonFollowupCohort();
  const runBackgroundTask = useStudyBackgroundTask();
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const learningItems = useMemo(
    () => uniqueById(learningItemsQuery.data?.pages.flatMap((page) => page.items) ?? []),
    [learningItemsQuery.data]
  );
  const queueTotal = queueQuery.data?.pages[0]?.total ?? queueItems.length;
  const reorderDisabled = queueItems.length > 100;
  const queueDataRef = useRef(queueQuery.data);
  queueDataRef.current = queueQuery.data;
  const previousQueuePageCountRef = useRef(0);
  const previousFirstQueuePageSignatureRef = useRef('');
  const creatingLessonFollowupRef = useRef(false);
  const queuePageSignature = useMemo(
    () =>
      queueQuery.data?.pages
        .map((page) => `${page.nextCursor ?? 'end'}:${page.items.map((item) => item.id).join(',')}`)
        .join('|') ?? '',
    [queueQuery.data]
  );

  useEffect(() => {
    const pages = queueDataRef.current?.pages ?? [];
    const loadedQueueItems = uniqueById(pages.flatMap((page) => page.items));
    const firstPageSignature = pages[0]?.items.map((item) => item.id).join(',') ?? '';
    const previousPageCount = previousQueuePageCountRef.current;
    // Only a larger page count with an unchanged first page is an append.
    // Any first-page change is authoritative server data from a refresh/reset.
    const isPageAppend =
      previousPageCount > 0 &&
      pages.length > previousPageCount &&
      firstPageSignature === previousFirstQueuePageSignatureRef.current;

    setQueueItems((current) => {
      if (isPageAppend) {
        return uniqueById([
          ...current,
          ...pages.slice(previousPageCount).flatMap((page) => page.items),
        ]);
      }

      return loadedQueueItems;
    });
    previousQueuePageCountRef.current = pages.length;
    previousFirstQueuePageSignatureRef.current = firstPageSignature;
  }, [queuePageSignature]);

  const queueSentinelRef = useInfiniteScroll(
    mode === 'queue' && Boolean(queueQuery.hasNextPage) && !queueQuery.isFetchingNextPage,
    () => queueQuery.fetchNextPage()
  );
  const cardsSentinelRef = useInfiniteScroll(
    mode === 'all' &&
      Boolean(learningItemsQuery.hasNextPage) &&
      !learningItemsQuery.isFetchingNextPage,
    () => learningItemsQuery.fetchNextPage()
  );

  const handleDragEnd = (event: DragEndEvent) => {
    if (reorderDisabled || selectingLessonFollowup) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = queueItems.findIndex((item) => item.id === active.id);
    const newIndex = queueItems.findIndex((item) => item.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const previousItems = queueItems;
    const nextItems = arrayMove(queueItems, oldIndex, newIndex);
    setQueueItems(nextItems);
    setQueueError(null);
    runBackgroundTask(
      async () => {
        try {
          await reorderMutation.mutateAsync(nextItems.map((item) => item.id));
        } catch (error) {
          setQueueItems(previousItems);
          setQueueError(error instanceof Error ? error.message : t('cards.reorderFailed'));
          throw error;
        }
      },
      { label: 'Study new-card reorder' }
    );
  };

  const cancelLessonFollowup = () => {
    setSelectingLessonFollowup(false);
    setSelectedLessonCardIds(new Set());
    setLessonLabel('');
    setQueueError(null);
  };

  const startLessonFollowup = () => {
    if (creatingLessonFollowupRef.current) return;
    const cardIds = queueItems
      .filter((item) => selectedLessonCardIds.has(item.id))
      .map((item) => item.id);
    if (cardIds.length === 0) return;

    creatingLessonFollowupRef.current = true;
    setQueueError(null);
    runBackgroundTask(
      async () => {
        try {
          const cohort = await createLessonFollowupMutation.mutateAsync({
            cohortId: createStudyIntroductionCohortId(),
            cardIds,
            label: lessonLabel.trim() || null,
          });
          navigate(`/app/study?lessonCohortId=${encodeURIComponent(cohort.id)}`);
        } catch (error) {
          setQueueError(
            error instanceof Error ? error.message : t('cards.lessonFollowupCreateFailed')
          );
          throw error;
        } finally {
          creatingLessonFollowupRef.current = false;
        }
      },
      { label: 'Create lesson follow-up cohort' }
    );
  };

  if (!enabled) {
    return (
      <section className="card retro-paper-panel max-w-3xl">
        <h1 className="mb-4 text-3xl font-bold text-navy">{t('cards.title')}</h1>
        <p className="text-gray-600">{t('disabled')}</p>
      </section>
    );
  }

  return (
    <div className="papercraft-cards mx-auto max-w-4xl space-y-5">
      <section className="card retro-paper-panel papercraft-card-sheet papercraft-card-header">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-3xl font-bold text-navy">{t('cards.title')}</h1>
            <p className="text-gray-600">{t('cards.description')}</p>
          </div>
          <Link
            to="/app/study/create"
            aria-label={t('overview.create')}
            title={t('overview.create')}
            className="papercraft-plus grid size-11 shrink-0 place-items-center border-2 border-navy bg-navy text-white transition hover:bg-cyan hover:text-navy focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan"
          >
            <Plus className="size-6" strokeWidth={2.5} aria-hidden="true" />
          </Link>
        </div>
      </section>

      <section className="card retro-paper-panel papercraft-card-sheet papercraft-card-tray space-y-4">
        <div
          className="papercraft-index-tabs grid grid-cols-2 rounded-xl bg-navy/10 p-1"
          role="tablist"
          aria-label={t('cards.collections')}
        >
          {(['queue', 'all'] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              id={`study-cards-${value}-tab`}
              aria-controls={`study-cards-${value}-panel`}
              aria-selected={mode === value}
              onClick={() => setMode(value)}
              className={`rounded-lg px-4 py-2 text-sm font-bold transition ${
                mode === value ? 'bg-white text-navy shadow-sm' : 'text-navy/60 hover:text-navy'
              }`}
            >
              {t(`cards.${value}`)}
            </button>
          ))}
        </div>

        {mode === 'all' ? (
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              setSearchQuery(searchInput.trim());
            }}
          >
            <label className="sr-only" htmlFor="study-card-search">
              {t('cards.search')}
            </label>
            <input
              id="study-card-search"
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder={t('cards.searchPlaceholder')}
              className="min-w-0 flex-1 rounded-xl border border-gray-300 px-3 py-2 text-navy focus:border-navy focus:outline-none focus:ring-2 focus:ring-navy/20"
            />
            <button
              type="submit"
              className="rounded-full border border-gray-300 px-4 py-2 text-sm font-semibold text-navy hover:bg-white/50"
            >
              {t('cards.search')}
            </button>
          </form>
        ) : null}

        {mode === 'queue' ? (
          <div id="study-cards-queue-panel" role="tabpanel" aria-labelledby="study-cards-queue-tab">
            <div className="flex items-center justify-between border-b border-navy/15 px-1 pb-2">
              <h2 className="font-bold uppercase tracking-[0.12em] text-navy">
                {t('cards.upNext')}
              </h2>
              <span className="text-sm text-gray-500">
                {t('cards.queuedCount', { count: queueTotal })}
              </span>
            </div>
            {selectingLessonFollowup ? (
              <div className="my-3 space-y-3 rounded-xl border border-sky-200 bg-sky-50 p-3">
                <div>
                  <label htmlFor="lesson-followup-label" className="text-sm font-bold text-navy">
                    {t('cards.lessonFollowupLabel')}
                  </label>
                  <input
                    id="lesson-followup-label"
                    value={lessonLabel}
                    onChange={(event) => setLessonLabel(event.target.value)}
                    placeholder={t('cards.lessonFollowupLabelPlaceholder')}
                    maxLength={120}
                    className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-navy focus:border-navy focus:outline-none focus:ring-2 focus:ring-navy/20"
                  />
                </div>
                <p className="text-sm text-gray-600">{t('cards.lessonFollowupHelp')}</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={startLessonFollowup}
                    disabled={
                      selectedLessonCardIds.size === 0 || createLessonFollowupMutation.isPending
                    }
                    className="rounded-full bg-navy px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {createLessonFollowupMutation.isPending
                      ? t('cards.lessonFollowupStarting')
                      : t('cards.studySelectedNow', { count: selectedLessonCardIds.size })}
                  </button>
                  <button
                    type="button"
                    onClick={cancelLessonFollowup}
                    disabled={createLessonFollowupMutation.isPending}
                    className="rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-navy"
                  >
                    {t('cards.cancelLessonFollowup')}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setSelectingLessonFollowup(true)}
                disabled={queueItems.length === 0}
                className="my-3 inline-flex items-center gap-2 rounded-full border border-navy/20 bg-white px-4 py-2 text-sm font-semibold text-navy disabled:opacity-50"
              >
                <BookOpenCheck className="h-4 w-4" aria-hidden="true" />
                {t('cards.makeLessonFollowup')}
              </button>
            )}
            {queueQuery.isLoading ? (
              <p className="py-8 text-center text-gray-500">{t('cards.loadingQueue')}</p>
            ) : null}
            {queueQuery.error || queueError ? (
              <p
                role="alert"
                className="my-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
              >
                {queueError ?? t('cards.failedQueue')}
              </p>
            ) : null}
            {!queueQuery.isLoading && queueItems.length === 0 ? (
              <p className="py-10 text-center text-gray-500">{t('cards.emptyQueue')}</p>
            ) : null}
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={queueItems.map((item) => item.id)}
                strategy={verticalListSortingStrategy}
              >
                <ol className="overflow-hidden rounded-xl border border-navy/10">
                  {queueItems.map((item, index) => (
                    <QueueRow
                      key={item.id}
                      item={item}
                      ordinal={index + 1}
                      reorderDisabled={reorderDisabled || selectingLessonFollowup}
                      selectionMode={selectingLessonFollowup}
                      selected={selectedLessonCardIds.has(item.id)}
                      onToggleSelected={() => {
                        setSelectedLessonCardIds((current) => {
                          const next = new Set(current);
                          if (next.has(item.id)) next.delete(item.id);
                          else next.add(item.id);
                          return next;
                        });
                      }}
                    />
                  ))}
                </ol>
              </SortableContext>
            </DndContext>
            <div ref={queueSentinelRef} data-testid="queue-scroll-sentinel" className="h-1" />
            {queueQuery.isFetchingNextPage ? (
              <p className="py-3 text-center text-sm text-gray-500">{t('cards.loadingMore')}</p>
            ) : null}
            {reorderDisabled ? (
              <p className="py-3 text-center text-sm text-gray-500">{t('cards.reorderLimit')}</p>
            ) : null}
          </div>
        ) : (
          <div id="study-cards-all-panel" role="tabpanel" aria-labelledby="study-cards-all-tab">
            {learningItemsQuery.isLoading ? (
              <p className="py-8 text-center text-gray-500">{t('cards.loadingCards')}</p>
            ) : null}
            {learningItemsQuery.error ? (
              <p
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
              >
                {t('cards.failedCards')}
              </p>
            ) : null}
            {!learningItemsQuery.isLoading && learningItems.length === 0 ? (
              <p className="py-10 text-center text-gray-500">
                {searchQuery ? t('cards.noSearchResults') : t('cards.emptyCards')}
              </p>
            ) : null}
            <ul className="overflow-hidden rounded-xl border border-navy/10">
              {learningItems.map((item) => (
                <LearningItemRow key={item.id} item={item} />
              ))}
            </ul>
            <div ref={cardsSentinelRef} data-testid="cards-scroll-sentinel" className="h-1" />
            {learningItemsQuery.isFetchingNextPage ? (
              <p className="py-3 text-center text-sm text-gray-500">{t('cards.loadingMore')}</p>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
};

export default StudyCardsPage;
