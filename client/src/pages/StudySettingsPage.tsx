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
import { STUDY_NEW_CARDS_PER_DAY_DEFAULT } from '@languageflow/shared/src/studyConstants';
import type { StudyCardSummary, StudyNewCardQueueItem } from '@languageflow/shared/src/types';
import { GripVertical } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import StudyCandidateCardPreviewModal from '../components/study/StudyCandidatePreview';
import { useFeatureFlags } from '../hooks/useFeatureFlags';
import {
  useConnectWaniKani,
  useDisconnectWaniKani,
  useKnownKanji,
  useSetManualKnownKanji,
  useSyncWaniKani,
} from '../hooks/useKnownKanji';
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
  onPreview: (item: StudyNewCardQueueItem) => void;
  ordinal: number;
}

const CLOZE_MARKER_PATTERN = /\{\{c\d+::([^}:]+)(?:::[^}]*)?}}/g;

const toClozePromptDisplay = (text: string) => text.replace(CLOZE_MARKER_PATTERN, '[...]');

const toRestoredClozeText = (text: string) =>
  text.replace(CLOZE_MARKER_PATTERN, (_match, clozeText: string) => clozeText);

const SortableQueueRow = ({ item, onPreview, ordinal }: SortableQueueRowProps) => {
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
          <button
            type="button"
            onClick={() => onPreview(item)}
            className="mt-3 rounded-full border border-gray-300 px-3 py-1.5 text-sm font-medium text-navy hover:bg-cream"
          >
            {t('create.previewCard')}
          </button>
        </div>
      </div>
    </li>
  );
};

const toQueuePreviewCard = (item: StudyNewCardQueueItem): StudyCardSummary => {
  if (item.cardType === 'cloze') {
    return {
      id: item.id,
      noteId: item.noteId,
      cardType: 'cloze',
      prompt: {
        clozeText: item.displayText,
        clozeDisplayText: toClozePromptDisplay(item.displayText),
      },
      answer: {
        restoredText: toRestoredClozeText(item.displayText),
        meaning: item.meaning,
      },
      state: {
        dueAt: null,
        introducedAt: null,
        queueState: 'new',
        scheduler: null,
        source: {},
      },
      answerAudioSource: 'missing',
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }

  const prompt = { cueText: item.displayText };
  const answer = {
    expression: item.displayText,
    meaning: item.meaning,
  };

  return {
    id: item.id,
    noteId: item.noteId,
    cardType: item.cardType,
    prompt:
      item.cardType === 'production' ? { cueMeaning: item.meaning ?? item.displayText } : prompt,
    answer,
    state: {
      dueAt: null,
      introducedAt: null,
      queueState: 'new',
      scheduler: null,
      source: {},
    },
    answerAudioSource: 'missing',
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
};

const StudySettingsPage = () => {
  const { t } = useTranslation('study');
  const { flags, isFeatureEnabled } = useFeatureFlags();
  const enabled = isFeatureEnabled('flashcardsEnabled');
  const runBackgroundTask = useStudyBackgroundTask();
  const [newCardsPerDay, setNewCardsPerDay] = useState(STUDY_NEW_CARDS_PER_DAY_DEFAULT);
  const [searchDraft, setSearchDraft] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [queueItems, setQueueItems] = useState<StudyNewCardQueueItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadMorePending, setLoadMorePending] = useState(false);
  const [settingsSavedVisible, setSettingsSavedVisible] = useState(false);
  const [settingsSaveFailedVisible, setSettingsSaveFailedVisible] = useState(false);
  const [previewCard, setPreviewCard] = useState<StudyCardSummary | null>(null);
  const [wanikaniToken, setWanikaniToken] = useState('');
  const [manualKanji, setManualKanji] = useState('');
  const [knowledgeError, setKnowledgeError] = useState<string | null>(null);

  const settingsQuery = useStudySettings(enabled);
  const updateSettingsMutation = useUpdateStudySettings();
  const reorderMutation = useReorderStudyNewCardQueue();
  const queueQuery = useStudyNewCardQueue(enabled, { q: searchQuery });
  const knownKanjiQuery = useKnownKanji();
  const connectWaniKaniMutation = useConnectWaniKani();
  const disconnectWaniKaniMutation = useDisconnectWaniKani();
  const syncWaniKaniMutation = useSyncWaniKani();
  const setManualKnownKanjiMutation = useSetManualKnownKanji();
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
      // Refetches reset loaded extra pages to the canonical first page for the current search.
      setQueueItems(queueQuery.data.items);
      setNextCursor(queueQuery.data.nextCursor);
    }
  }, [queueQuery.data]);

  useEffect(() => {
    if (!settingsSavedVisible) return undefined;

    const timer = window.setTimeout(() => {
      setSettingsSavedVisible(false);
    }, 2000);

    return () => window.clearTimeout(timer);
  }, [settingsSavedVisible]);

  const queueIds = useMemo(() => queueItems.map((item) => item.id), [queueItems]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = queueItems.findIndex((item) => item.id === active.id);
    const newIndex = queueItems.findIndex((item) => item.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const previousItems = queueItems;
    const previousCursor = nextCursor;
    const nextItems = arrayMove(queueItems, oldIndex, newIndex);
    setQueueItems(nextItems);
    runBackgroundTask(
      async () => {
        try {
          const reorderedQueue = await reorderMutation.mutateAsync(
            nextItems.map((item) => item.id)
          );
          setQueueItems(reorderedQueue.items);
          setNextCursor(reorderedQueue.nextCursor);
        } catch (error) {
          setQueueItems(previousItems);
          setNextCursor(previousCursor);
          throw error;
        }
      },
      {
        label: 'Study new-card reorder',
      }
    );
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

      {knownKanjiQuery.enabled ? (
        <section className="card retro-paper-panel space-y-5">
          <div>
            <h2 className="text-2xl font-semibold text-navy">
              {t('settings.kanjiKnowledgeTitle')}
            </h2>
            <p className="text-sm text-gray-500">{t('settings.kanjiKnowledgeDescription')}</p>
          </div>

          {knownKanjiQuery.isLoading ? (
            <p className="text-sm text-gray-500">{t('settings.kanjiKnowledgeLoading')}</p>
          ) : null}
          {knownKanjiQuery.error || knowledgeError ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {knowledgeError ?? t('settings.kanjiKnowledgeFailed')}
            </p>
          ) : null}

          {knownKanjiQuery.data ? (
            <div className="rounded-xl border border-gray-200 bg-white/60 p-4">
              <p className="font-semibold text-navy">
                {t('settings.knownKanjiCount', { count: knownKanjiQuery.data.kanji.length })}
              </p>
              <p className="mt-1 text-sm text-gray-500">
                {knownKanjiQuery.data.wanikani.lastSyncedAt
                  ? t('settings.wanikaniLastSynced', {
                      value: new Date(knownKanjiQuery.data.wanikani.lastSyncedAt).toLocaleString(),
                    })
                  : t('settings.wanikaniNeverSynced')}
              </p>
            </div>
          ) : null}

          {knownKanjiQuery.data?.wanikani.connected ? (
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-800">
                {t('settings.wanikaniConnected')}
              </span>
              <button
                type="button"
                disabled={syncWaniKaniMutation.isPending}
                onClick={() => {
                  setKnowledgeError(null);
                  runBackgroundTask(
                    async () => {
                      try {
                        await syncWaniKaniMutation.mutateAsync();
                      } catch (error) {
                        setKnowledgeError(
                          error instanceof Error ? error.message : t('settings.wanikaniSyncFailed')
                        );
                        throw error;
                      }
                    },
                    { label: 'WaniKani kanji sync' }
                  );
                }}
                className="rounded-full bg-navy px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
              >
                {syncWaniKaniMutation.isPending
                  ? t('settings.wanikaniSyncing')
                  : t('settings.wanikaniSync')}
              </button>
              <button
                type="button"
                disabled={disconnectWaniKaniMutation.isPending}
                onClick={() => {
                  setKnowledgeError(null);
                  runBackgroundTask(() => disconnectWaniKaniMutation.mutateAsync(), {
                    label: 'WaniKani disconnect',
                  });
                }}
                className="rounded-full border border-gray-300 px-4 py-2 text-sm font-medium text-navy hover:bg-white/50 disabled:opacity-60"
              >
                {t('settings.wanikaniDisconnect')}
              </button>
            </div>
          ) : (
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                const token = wanikaniToken.trim();
                if (!token) return;
                setKnowledgeError(null);
                runBackgroundTask(
                  async () => {
                    try {
                      await connectWaniKaniMutation.mutateAsync(token);
                      await syncWaniKaniMutation.mutateAsync();
                      setWanikaniToken('');
                    } catch (error) {
                      setKnowledgeError(
                        error instanceof Error ? error.message : t('settings.wanikaniConnectFailed')
                      );
                      throw error;
                    }
                  },
                  { label: 'WaniKani connect and sync' }
                );
              }}
            >
              <label className="block" htmlFor="wanikani-api-token">
                <span className="text-sm font-semibold text-navy">
                  {t('settings.wanikaniToken')}
                </span>
                <input
                  id="wanikani-api-token"
                  type="password"
                  autoComplete="off"
                  value={wanikaniToken}
                  onChange={(event) => setWanikaniToken(event.target.value)}
                  placeholder={t('settings.wanikaniTokenPlaceholder')}
                  className="mt-2 block w-full max-w-xl rounded-xl border border-gray-300 px-3 py-2 text-navy focus:border-navy focus:outline-none focus:ring-2 focus:ring-navy/20"
                />
              </label>
              <p className="text-xs text-gray-500">{t('settings.wanikaniTokenHelp')}</p>
              <button
                type="submit"
                disabled={connectWaniKaniMutation.isPending || !wanikaniToken.trim()}
                className="rounded-full bg-navy px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
              >
                {connectWaniKaniMutation.isPending
                  ? t('settings.wanikaniConnecting')
                  : t('settings.wanikaniConnect')}
              </button>
            </form>
          )}

          <div className="border-t border-gray-200 pt-5">
            <h3 className="font-semibold text-navy">{t('settings.manualKanjiTitle')}</h3>
            <p className="mt-1 text-sm text-gray-500">{t('settings.manualKanjiDescription')}</p>
            <form
              className="mt-3 flex items-end gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                const kanji = manualKanji.trim();
                if (!/^[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]$/u.test(kanji)) {
                  setKnowledgeError(t('settings.manualKanjiInvalid'));
                  return;
                }
                setKnowledgeError(null);
                runBackgroundTask(
                  async () => {
                    try {
                      await setManualKnownKanjiMutation.mutateAsync({ kanji, known: true });
                      setManualKanji('');
                    } catch (error) {
                      setKnowledgeError(
                        error instanceof Error ? error.message : t('settings.manualKanjiFailed')
                      );
                      throw error;
                    }
                  },
                  { label: 'Manual known kanji add' }
                );
              }}
            >
              <label htmlFor="manual-known-kanji">
                <span className="sr-only">{t('settings.manualKanjiInput')}</span>
                <input
                  id="manual-known-kanji"
                  value={manualKanji}
                  onChange={(event) => setManualKanji(event.target.value)}
                  placeholder={t('settings.manualKanjiPlaceholder')}
                  className="w-32 rounded-xl border border-gray-300 px-3 py-2 text-navy focus:border-navy focus:outline-none focus:ring-2 focus:ring-navy/20"
                />
              </label>
              <button
                type="submit"
                disabled={setManualKnownKanjiMutation.isPending}
                className="rounded-full border border-gray-300 px-4 py-2 text-sm font-medium text-navy hover:bg-white/50 disabled:opacity-60"
              >
                {t('settings.manualKanjiAdd')}
              </button>
            </form>
            {knownKanjiQuery.data?.manualKanji.length ? (
              <ul className="mt-4 flex flex-wrap gap-2" aria-label={t('settings.manualKanjiList')}>
                {knownKanjiQuery.data.manualKanji.map((kanji) => (
                  <li
                    key={kanji}
                    className="flex items-center gap-2 rounded-full bg-cream px-3 py-1.5 text-navy"
                  >
                    <span className="text-lg">{kanji}</span>
                    <button
                      type="button"
                      aria-label={t('settings.manualKanjiRemove', { kanji })}
                      onClick={() => {
                        setKnowledgeError(null);
                        runBackgroundTask(
                          () => setManualKnownKanjiMutation.mutateAsync({ kanji, known: false }),
                          { label: 'Manual known kanji remove' }
                        );
                      }}
                      className="text-sm text-gray-500 hover:text-red-700"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="card retro-paper-panel space-y-4">
        <div>
          <h2 className="text-2xl font-semibold text-navy">{t('settings.dailyLimitTitle')}</h2>
          <p className="text-sm text-gray-500">{t('settings.dailyLimitDescription')}</p>
        </div>
        {settingsQuery.error ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {t('settings.failedSettings')}
          </p>
        ) : null}
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            runBackgroundTask(
              async () => {
                try {
                  await updateSettingsMutation.mutateAsync({ newCardsPerDay });
                  setSettingsSaveFailedVisible(false);
                  setSettingsSavedVisible(true);
                } catch (error) {
                  setSettingsSavedVisible(false);
                  setSettingsSaveFailedVisible(true);
                  throw error;
                }
              },
              {
                label: 'Study settings save',
              }
            );
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
              onChange={(event) => {
                setSettingsSavedVisible(false);
                setSettingsSaveFailedVisible(false);
                setNewCardsPerDay(Number(event.target.value));
              }}
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
          {settingsSavedVisible ? (
            <span className="text-sm font-medium text-green-700">{t('settings.saved')}</span>
          ) : null}
        </form>
        {settingsSaveFailedVisible ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {t('settings.failedSave')}
          </p>
        ) : null}
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
        {queueQuery.error ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {t('settings.failedQueue')}
          </p>
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
                <SortableQueueRow
                  key={item.id}
                  item={item}
                  ordinal={index + 1}
                  onPreview={(nextItem) => setPreviewCard(toQueuePreviewCard(nextItem))}
                />
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
                    const nextPage = await getStudyNewCardQueue(
                      {
                        cursor: nextCursor,
                        q: searchQuery,
                      },
                      flags
                    );
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
        {previewCard ? (
          <StudyCandidateCardPreviewModal card={previewCard} onClose={() => setPreviewCard(null)} />
        ) : null}
      </section>
    </div>
  );
};

export default StudySettingsPage;
