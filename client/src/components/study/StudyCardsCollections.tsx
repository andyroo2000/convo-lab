import type { Dispatch, FormEvent, RefObject, SetStateAction } from 'react';
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
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import type { StudyLearningItem, StudyNewCardQueueItem } from '@languageflow/shared/src/types';
import { BookOpenCheck, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { LearningItemRow, QueueRow } from './StudyCardsRows';

export type StudyCardCollectionMode = 'queue' | 'all';

export const StudyCardsHeader = () => {
  const { t } = useTranslation('study');

  return (
    <section className="card app-surface ios-cards-header">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold text-navy">{t('cards.title')}</h1>
          <p className="text-gray-600">{t('cards.description')}</p>
        </div>
        <Link
          to="/app/study/create"
          aria-label={t('overview.create')}
          title={t('overview.create')}
          className="app-icon-button grid size-11 shrink-0 place-items-center bg-navy text-white transition hover:bg-cyan hover:text-navy focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan"
        >
          <Plus className="size-6" strokeWidth={2.5} aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
};

interface CollectionTabsProps {
  mode: StudyCardCollectionMode;
  setMode: Dispatch<SetStateAction<StudyCardCollectionMode>>;
}

export const CollectionTabs = ({ mode, setMode }: CollectionTabsProps) => {
  const { t } = useTranslation('study');

  return (
    <div
      className="app-segmented-control grid grid-cols-2 rounded-xl bg-navy/10 p-1"
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
  );
};

interface CardsSearchProps {
  searchInput: string;
  setSearchInput: Dispatch<SetStateAction<string>>;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

export const CardsSearch = ({ searchInput, setSearchInput, onSubmit }: CardsSearchProps) => {
  const { t } = useTranslation('study');

  return (
    <form className="flex gap-2" onSubmit={onSubmit}>
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
  );
};

interface LessonFollowupControlsProps {
  selecting: boolean;
  setSelecting: Dispatch<SetStateAction<boolean>>;
  queueIsEmpty: boolean;
  selectedCount: number;
  lessonLabel: string;
  setLessonLabel: Dispatch<SetStateAction<string>>;
  isCreating: boolean;
  onStart: () => void;
  onCancel: () => void;
}

const LessonFollowupControls = ({
  selecting,
  setSelecting,
  queueIsEmpty,
  selectedCount,
  lessonLabel,
  setLessonLabel,
  isCreating,
  onStart,
  onCancel,
}: LessonFollowupControlsProps) => {
  const { t } = useTranslation('study');

  if (!selecting) {
    return (
      <button
        type="button"
        onClick={() => setSelecting(true)}
        disabled={queueIsEmpty}
        className="my-3 inline-flex items-center gap-2 rounded-full border border-navy/20 bg-white px-4 py-2 text-sm font-semibold text-navy disabled:opacity-50"
      >
        <BookOpenCheck className="h-4 w-4" aria-hidden="true" />
        {t('cards.makeLessonFollowup')}
      </button>
    );
  }

  return (
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
          onClick={onStart}
          disabled={selectedCount === 0 || isCreating}
          className="rounded-full bg-navy px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isCreating
            ? t('cards.lessonFollowupStarting')
            : t('cards.studySelectedNow', { count: selectedCount })}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isCreating}
          className="rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-navy"
        >
          {t('cards.cancelLessonFollowup')}
        </button>
      </div>
    </div>
  );
};

interface QueueFeedbackProps {
  isLoading: boolean;
  queryError: unknown;
  queueError: string | null;
  isEmpty: boolean;
  isFetchingNextPage: boolean;
  reorderDisabled: boolean;
}

const QueueFeedback = ({
  isLoading,
  queryError,
  queueError,
  isEmpty,
  isFetchingNextPage,
  reorderDisabled,
}: QueueFeedbackProps) => {
  const { t } = useTranslation('study');

  return (
    <>
      {isLoading ? (
        <p className="py-8 text-center text-gray-500">{t('cards.loadingQueue')}</p>
      ) : null}
      {queryError || queueError ? (
        <p
          role="alert"
          className="my-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {queueError ?? t('cards.failedQueue')}
        </p>
      ) : null}
      {!isLoading && isEmpty ? (
        <p className="py-10 text-center text-gray-500">{t('cards.emptyQueue')}</p>
      ) : null}
      {isFetchingNextPage ? (
        <p className="py-3 text-center text-sm text-gray-500">{t('cards.loadingMore')}</p>
      ) : null}
      {reorderDisabled ? (
        <p className="py-3 text-center text-sm text-gray-500">{t('cards.reorderLimit')}</p>
      ) : null}
    </>
  );
};

interface QueueListProps {
  items: StudyNewCardQueueItem[];
  reorderDisabled: boolean;
  selecting: boolean;
  selectedIds: Set<string>;
  setSelectedIds: Dispatch<SetStateAction<Set<string>>>;
  onDragEnd: (event: DragEndEvent) => void;
}

const QueueList = ({
  items,
  reorderDisabled,
  selecting,
  selectedIds,
  setSelectedIds,
  onDragEnd,
}: QueueListProps) => {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
        <ol className="overflow-hidden rounded-xl border border-navy/10">
          {items.map((item, index) => (
            <QueueRow
              key={item.id}
              item={item}
              ordinal={index + 1}
              reorderDisabled={reorderDisabled || selecting}
              selectionMode={selecting}
              selected={selectedIds.has(item.id)}
              onToggleSelected={() => {
                setSelectedIds((current) => {
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
  );
};

export interface QueuePanelProps {
  queueTotal: number;
  items: StudyNewCardQueueItem[];
  reorderDisabled: boolean;
  selecting: boolean;
  setSelecting: Dispatch<SetStateAction<boolean>>;
  selectedIds: Set<string>;
  setSelectedIds: Dispatch<SetStateAction<Set<string>>>;
  lessonLabel: string;
  setLessonLabel: Dispatch<SetStateAction<string>>;
  isCreatingLesson: boolean;
  onStartLesson: () => void;
  onCancelLesson: () => void;
  onDragEnd: (event: DragEndEvent) => void;
  isLoading: boolean;
  queryError: unknown;
  queueError: string | null;
  isFetchingNextPage: boolean;
  sentinelRef: RefObject<HTMLDivElement>;
}

export const QueuePanel = ({
  queueTotal,
  items,
  reorderDisabled,
  selecting,
  setSelecting,
  selectedIds,
  setSelectedIds,
  lessonLabel,
  setLessonLabel,
  isCreatingLesson,
  onStartLesson,
  onCancelLesson,
  onDragEnd,
  isLoading,
  queryError,
  queueError,
  isFetchingNextPage,
  sentinelRef,
}: QueuePanelProps) => {
  const { t } = useTranslation('study');

  return (
    <div id="study-cards-queue-panel" role="tabpanel" aria-labelledby="study-cards-queue-tab">
      <div className="flex items-center justify-between border-b border-navy/15 px-1 pb-2">
        <h2 className="font-bold uppercase tracking-[0.12em] text-navy">{t('cards.upNext')}</h2>
        <span className="text-sm text-gray-500">
          {t('cards.queuedCount', { count: queueTotal })}
        </span>
      </div>
      <LessonFollowupControls
        selecting={selecting}
        setSelecting={setSelecting}
        queueIsEmpty={items.length === 0}
        selectedCount={selectedIds.size}
        lessonLabel={lessonLabel}
        setLessonLabel={setLessonLabel}
        isCreating={isCreatingLesson}
        onStart={onStartLesson}
        onCancel={onCancelLesson}
      />
      <QueueFeedback
        isLoading={isLoading}
        queryError={queryError}
        queueError={queueError}
        isEmpty={items.length === 0}
        isFetchingNextPage={isFetchingNextPage}
        reorderDisabled={reorderDisabled}
      />
      <QueueList
        items={items}
        reorderDisabled={reorderDisabled}
        selecting={selecting}
        selectedIds={selectedIds}
        setSelectedIds={setSelectedIds}
        onDragEnd={onDragEnd}
      />
      <div ref={sentinelRef} data-testid="queue-scroll-sentinel" className="h-1" />
    </div>
  );
};

interface AllCardsFeedbackProps {
  isLoading: boolean;
  error: unknown;
  isEmpty: boolean;
  searchQuery: string;
  isFetchingNextPage: boolean;
}

const AllCardsFeedback = ({
  isLoading,
  error,
  isEmpty,
  searchQuery,
  isFetchingNextPage,
}: AllCardsFeedbackProps) => {
  const { t } = useTranslation('study');

  return (
    <>
      {isLoading ? (
        <p className="py-8 text-center text-gray-500">{t('cards.loadingCards')}</p>
      ) : null}
      {error ? (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {t('cards.failedCards')}
        </p>
      ) : null}
      {!isLoading && isEmpty ? (
        <p className="py-10 text-center text-gray-500">
          {searchQuery ? t('cards.noSearchResults') : t('cards.emptyCards')}
        </p>
      ) : null}
      {isFetchingNextPage ? (
        <p className="py-3 text-center text-sm text-gray-500">{t('cards.loadingMore')}</p>
      ) : null}
    </>
  );
};

interface AllCardsPanelProps {
  items: StudyLearningItem[];
  isLoading: boolean;
  error: unknown;
  searchQuery: string;
  isFetchingNextPage: boolean;
  sentinelRef: RefObject<HTMLDivElement>;
}

export const AllCardsPanel = ({
  items,
  isLoading,
  error,
  searchQuery,
  isFetchingNextPage,
  sentinelRef,
}: AllCardsPanelProps) => (
  <div id="study-cards-all-panel" role="tabpanel" aria-labelledby="study-cards-all-tab">
    <AllCardsFeedback
      isLoading={isLoading}
      error={error}
      isEmpty={items.length === 0}
      searchQuery={searchQuery}
      isFetchingNextPage={isFetchingNextPage}
    />
    <ul className="overflow-hidden rounded-xl border border-navy/10">
      {items.map((item) => (
        <LearningItemRow key={item.id} item={item} />
      ))}
    </ul>
    <div ref={sentinelRef} data-testid="cards-scroll-sentinel" className="h-1" />
  </div>
);
