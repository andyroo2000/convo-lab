import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
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
import type { StudyCardSummary, StudyNewCardQueueItem } from '@languageflow/shared/src/types';
import { GripVertical, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { useFeatureFlags } from '../hooks/useFeatureFlags';
import {
  useReorderStudyNewCardQueue,
  useStudyCardsInfinite,
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

const cardDisplayText = (card: StudyCardSummary) =>
  card.prompt.clozeDisplayText ??
  card.prompt.cueText ??
  card.answer.expressionReading ??
  card.answer.expression ??
  card.prompt.clozeText ??
  '';

const cardMeaning = (card: StudyCardSummary) =>
  card.answer.meaning ?? card.prompt.cueMeaning ?? card.answer.sentenceEn ?? '';

const cardHref = (card: StudyCardSummary) => {
  const params = new URLSearchParams({ cardId: card.id });
  // Native/manual cards are their own browser group and do not expose a note id.
  params.set('noteId', card.noteId ?? card.id);
  return `/app/study/browse?${params.toString()}`;
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
}

const QueueRow = ({ item, ordinal, reorderDisabled }: QueueRowProps) => {
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
      <span className="mt-1 w-8 shrink-0 text-right font-mono text-xs font-bold text-gray-500">
        {ordinal}
      </span>
      <Link
        to={`/app/study/browse?noteId=${encodeURIComponent(item.noteId)}&cardId=${encodeURIComponent(item.id)}`}
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
  const { isFeatureEnabled } = useFeatureFlags();
  const enabled = isFeatureEnabled('flashcardsEnabled');
  const [mode, setMode] = useState<CollectionMode>('queue');
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [queueItems, setQueueItems] = useState<StudyNewCardQueueItem[]>([]);
  const [queueError, setQueueError] = useState<string | null>(null);
  const queueQuery = useStudyNewCardQueueInfinite(enabled && mode === 'queue');
  const cardsQuery = useStudyCardsInfinite(enabled && mode === 'all', searchQuery);
  const reorderMutation = useReorderStudyNewCardQueue();
  const runBackgroundTask = useStudyBackgroundTask();
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const cards = useMemo(
    () => uniqueById(cardsQuery.data?.pages.flatMap((page) => page.items) ?? []),
    [cardsQuery.data]
  );
  const queueTotal = queueQuery.data?.pages[0]?.total ?? queueItems.length;
  const reorderDisabled = queueItems.length > 100;
  const queueDataRef = useRef(queueQuery.data);
  queueDataRef.current = queueQuery.data;
  const queuePageSignature =
    queueQuery.data?.pages
      .map((page) => `${page.nextCursor ?? 'end'}:${page.items.map((item) => item.id).join(',')}`)
      .join('|') ?? '';

  useEffect(() => {
    const loadedQueueItems = uniqueById(
      queueDataRef.current?.pages.flatMap((page) => page.items) ?? []
    );
    setQueueItems((current) => {
      const matches =
        current.length === loadedQueueItems.length &&
        current.every((item, index) => item.id === loadedQueueItems[index]?.id);
      return matches ? current : loadedQueueItems;
    });
  }, [queuePageSignature]);

  const queueSentinelRef = useInfiniteScroll(
    mode === 'queue' && Boolean(queueQuery.hasNextPage) && !queueQuery.isFetchingNextPage,
    () => queueQuery.fetchNextPage()
  );
  const cardsSentinelRef = useInfiniteScroll(
    mode === 'all' && Boolean(cardsQuery.hasNextPage) && !cardsQuery.isFetchingNextPage,
    () => cardsQuery.fetchNextPage()
  );

  const handleDragEnd = (event: DragEndEvent) => {
    if (reorderDisabled) return;
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

  if (!enabled) {
    return (
      <section className="card retro-paper-panel max-w-3xl">
        <h1 className="mb-4 text-3xl font-bold text-navy">{t('cards.title')}</h1>
        <p className="text-gray-600">{t('disabled')}</p>
      </section>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <section className="card retro-paper-panel">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-navy">{t('cards.title')}</h1>
            <p className="text-gray-600">{t('cards.description')}</p>
          </div>
          <div className="flex gap-2">
            <Link
              to="/app/study/create"
              className="inline-flex items-center gap-2 rounded-full bg-navy px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              {t('overview.create')}
            </Link>
            <Link
              to="/app/study"
              className="rounded-full border border-gray-300 px-4 py-2 text-sm font-semibold text-navy hover:bg-white/50"
            >
              {t('cards.back')}
            </Link>
          </div>
        </div>
      </section>

      <section className="card retro-paper-panel space-y-4">
        <div
          className="grid grid-cols-2 rounded-xl bg-navy/10 p-1"
          role="tablist"
          aria-label={t('cards.collections')}
        >
          {(['queue', 'all'] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
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
          <div>
            <div className="flex items-center justify-between border-b border-navy/15 px-1 pb-2">
              <h2 className="font-bold uppercase tracking-[0.12em] text-navy">{t('cards.upNext')}</h2>
              <span className="text-sm text-gray-500">{t('cards.queuedCount', { count: queueTotal })}</span>
            </div>
            {queueQuery.isLoading ? <p className="py-8 text-center text-gray-500">{t('cards.loadingQueue')}</p> : null}
            {queueQuery.error || queueError ? (
              <p role="alert" className="my-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {queueError ?? t('cards.failedQueue')}
              </p>
            ) : null}
            {!queueQuery.isLoading && queueItems.length === 0 ? (
              <p className="py-10 text-center text-gray-500">{t('cards.emptyQueue')}</p>
            ) : null}
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={queueItems.map((item) => item.id)} strategy={verticalListSortingStrategy}>
                <ol className="overflow-hidden rounded-xl border border-navy/10">
                  {queueItems.map((item, index) => (
                    <QueueRow
                      key={item.id}
                      item={item}
                      ordinal={index + 1}
                      reorderDisabled={reorderDisabled}
                    />
                  ))}
                </ol>
              </SortableContext>
            </DndContext>
            <div ref={queueSentinelRef} data-testid="queue-scroll-sentinel" className="h-1" />
            {queueQuery.isFetchingNextPage ? <p className="py-3 text-center text-sm text-gray-500">{t('cards.loadingMore')}</p> : null}
            {reorderDisabled ? (
              <p className="py-3 text-center text-sm text-gray-500">{t('cards.reorderLimit')}</p>
            ) : null}
          </div>
        ) : (
          <div>
            {cardsQuery.isLoading ? <p className="py-8 text-center text-gray-500">{t('cards.loadingCards')}</p> : null}
            {cardsQuery.error ? (
              <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{t('cards.failedCards')}</p>
            ) : null}
            {!cardsQuery.isLoading && cards.length === 0 ? (
              <p className="py-10 text-center text-gray-500">
                {searchQuery ? t('cards.noSearchResults') : t('cards.emptyCards')}
              </p>
            ) : null}
            <ul className="overflow-hidden rounded-xl border border-navy/10">
              {cards.map((card) => (
                <li key={card.id} className="border-b border-navy/10 bg-white/70 last:border-b-0">
                  <Link to={cardHref(card)} className="block px-4 py-4 hover:bg-cream/60 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-navy">
                    <p className="break-words font-bold text-navy">{cardDisplayText(card)}</p>
                    {cardMeaning(card) ? <p className="mt-1 line-clamp-2 break-words text-sm text-gray-600">{cardMeaning(card)}</p> : null}
                    <p className="mt-2 text-xs font-semibold uppercase tracking-[0.12em] text-gray-400">{card.cardType}</p>
                  </Link>
                </li>
              ))}
            </ul>
            <div ref={cardsSentinelRef} data-testid="cards-scroll-sentinel" className="h-1" />
            {cardsQuery.isFetchingNextPage ? <p className="py-3 text-center text-sm text-gray-500">{t('cards.loadingMore')}</p> : null}
          </div>
        )}
      </section>
    </div>
  );
};

export default StudyCardsPage;
