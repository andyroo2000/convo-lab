import { useEffect, useMemo, useState } from 'react';
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
import type { StudyNewCardQueueItem } from '@languageflow/shared/src/types';
import { GripVertical } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { useFeatureFlags } from '../hooks/useFeatureFlags';
import {
  getStudyNewCardQueue,
  useReorderStudyNewCardQueue,
  useStudyNewCardQueue,
  useStudySettings,
  useUpdateStudySettings,
} from '../hooks/useStudy';
import useStudyBackgroundTask from '../hooks/useStudyBackgroundTask';

interface SortableQueueRowProps {
  item: StudyNewCardQueueItem;
  ordinal: number;
}

const SortableQueueRow = ({ item, ordinal }: SortableQueueRowProps) => {
  const { t } = useTranslation('study');
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`rounded-xl border border-gray-200 bg-white p-3 shadow-sm ${
        isDragging ? 'relative z-10 ring-2 ring-navy/30' : ''
      }`}
      data-testid="study-new-queue-row"
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          className="mt-1 rounded-md p-1 text-gray-400 hover:bg-cream hover:text-navy focus:outline-none focus:ring-2 focus:ring-navy"
          aria-label={t('settings.dragHandle', { text: item.displayText })}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-5 w-5" aria-hidden="true" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-cream px-2 py-0.5 text-xs font-semibold text-navy">
              #{ordinal}
            </span>
            <span className="rounded-full bg-navy/10 px-2 py-0.5 text-xs font-semibold capitalize text-navy">
              {item.cardType}
            </span>
          </div>
          <p className="mt-2 break-words text-base font-semibold text-navy">{item.displayText}</p>
          {item.meaning ? (
            <p className="mt-1 break-words text-sm text-gray-600">{item.meaning}</p>
          ) : null}
        </div>
      </div>
    </li>
  );
};

const StudySettingsPage = () => {
  const { t } = useTranslation('study');
  const { isFeatureEnabled } = useFeatureFlags();
  const enabled = isFeatureEnabled('flashcardsEnabled');
  const runBackgroundTask = useStudyBackgroundTask();
  const [newCardsPerDay, setNewCardsPerDay] = useState(20);
  const [searchDraft, setSearchDraft] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [queueItems, setQueueItems] = useState<StudyNewCardQueueItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadMorePending, setLoadMorePending] = useState(false);

  const settingsQuery = useStudySettings(enabled);
  const updateSettingsMutation = useUpdateStudySettings();
  const reorderMutation = useReorderStudyNewCardQueue();
  const queueQuery = useStudyNewCardQueue(enabled, { q: searchQuery });
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    if (settingsQuery.data) {
      setNewCardsPerDay(settingsQuery.data.newCardsPerDay);
    }
  }, [settingsQuery.data]);

  useEffect(() => {
    if (queueQuery.data) {
      setQueueItems(queueQuery.data.items);
      setNextCursor(queueQuery.data.nextCursor);
    }
  }, [queueQuery.data]);

  const queueIds = useMemo(() => queueItems.map((item) => item.id), [queueItems]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setQueueItems((currentItems) => {
      const oldIndex = currentItems.findIndex((item) => item.id === active.id);
      const newIndex = currentItems.findIndex((item) => item.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return currentItems;

      const nextItems = arrayMove(currentItems, oldIndex, newIndex);
      runBackgroundTask(() => reorderMutation.mutateAsync(nextItems.map((item) => item.id)), {
        label: 'Study new-card reorder',
      });
      return nextItems;
    });
  };

  if (!enabled) {
    return (
      <section className="card retro-paper-panel max-w-3xl">
        <h1 className="mb-4 text-3xl font-bold text-navy">{t('settings.title')}</h1>
        <p className="text-gray-600">{t('disabled')}</p>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className="card retro-paper-panel">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-navy">{t('settings.title')}</h1>
            <p className="text-gray-600">{t('settings.description')}</p>
          </div>
          <Link
            to="/app/study"
            className="rounded-full border border-gray-300 px-4 py-2 text-sm font-medium text-navy hover:bg-white/50"
          >
            {t('settings.back')}
          </Link>
        </div>
      </section>

      <section className="card retro-paper-panel space-y-4">
        <div>
          <h2 className="text-2xl font-semibold text-navy">{t('settings.dailyLimitTitle')}</h2>
          <p className="text-sm text-gray-500">{t('settings.dailyLimitDescription')}</p>
        </div>
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            runBackgroundTask(() => updateSettingsMutation.mutateAsync({ newCardsPerDay }), {
              label: 'Study settings save',
            });
          }}
        >
          <label className="block" htmlFor="study-new-cards-per-day">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
              {t('settings.newCardsPerDay')}
            </span>
            <input
              id="study-new-cards-per-day"
              type="number"
              min={0}
              max={1000}
              step={1}
              value={newCardsPerDay}
              onChange={(event) => setNewCardsPerDay(Number(event.target.value))}
              className="mt-2 w-36 rounded-xl border border-gray-300 px-3 py-2 text-navy focus:border-navy focus:outline-none focus:ring-2 focus:ring-navy/20"
            />
          </label>
          <button
            type="submit"
            disabled={updateSettingsMutation.isPending}
            className="rounded-full bg-navy px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {updateSettingsMutation.isPending ? t('settings.saving') : t('settings.save')}
          </button>
          {updateSettingsMutation.isSuccess ? (
            <span className="text-sm font-medium text-green-700">{t('settings.saved')}</span>
          ) : null}
        </form>
      </section>

      <section className="card retro-paper-panel space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold text-navy">{t('settings.queueTitle')}</h2>
            <p className="text-sm text-gray-500">{t('settings.queueDescription')}</p>
          </div>
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              setSearchQuery(searchDraft.trim());
            }}
          >
            <input
              type="search"
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              placeholder={t('settings.searchPlaceholder')}
              className="w-52 rounded-xl border border-gray-300 px-3 py-2 text-sm text-navy focus:border-navy focus:outline-none focus:ring-2 focus:ring-navy/20"
            />
            <button
              type="submit"
              className="rounded-full border border-gray-300 px-4 py-2 text-sm font-medium text-navy hover:bg-white/50"
            >
              {t('settings.search')}
            </button>
          </form>
        </div>

        {queueQuery.isLoading ? (
          <p className="text-gray-500">{t('settings.loadingQueue')}</p>
        ) : null}
        {queueQuery.error instanceof Error ? (
          <p className="text-red-600">{queueQuery.error.message}</p>
        ) : null}

        {!queueQuery.isLoading && queueItems.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 p-6 text-center text-gray-600">
            {t('settings.emptyQueue')}
          </div>
        ) : null}

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={queueIds} strategy={verticalListSortingStrategy}>
            <ol className="space-y-2">
              {queueItems.map((item, index) => (
                <SortableQueueRow key={item.id} item={item} ordinal={index + 1} />
              ))}
            </ol>
          </SortableContext>
        </DndContext>

        {nextCursor ? (
          <button
            type="button"
            disabled={loadMorePending}
            onClick={() => {
              setLoadMorePending(true);
              runBackgroundTask(
                async () => {
                  try {
                    const nextPage = await getStudyNewCardQueue({
                      cursor: nextCursor,
                      q: searchQuery,
                    });
                    setQueueItems((current) => [...current, ...nextPage.items]);
                    setNextCursor(nextPage.nextCursor);
                  } finally {
                    setLoadMorePending(false);
                  }
                },
                {
                  label: 'Study new-card queue load more',
                }
              );
            }}
            className="rounded-full border border-gray-300 px-4 py-2 text-sm font-medium text-navy hover:bg-white/50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loadMorePending ? t('settings.loadingMore') : t('settings.loadMore')}
          </button>
        ) : null}
      </section>
    </div>
  );
};

export default StudySettingsPage;
