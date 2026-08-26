import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  STUDY_LESSON_BATCH_SIZE_DEFAULT,
  STUDY_LESSON_BATCH_SIZE_MAX,
  STUDY_LESSON_BATCH_SIZE_MIN,
  STUDY_NEW_CARDS_PER_DAY_DEFAULT,
} from '@languageflow/shared/src/studyConstants';
import { useTranslation } from 'react-i18next';
import type { StudyNewCardLaneWeights } from '@languageflow/shared/src/types';

import { useFeatureFlags } from '../hooks/useFeatureFlags';
import {
  useConnectWaniKani,
  useDisconnectWaniKani,
  useKnownKanji,
  useSetManualKnownKanji,
  useSyncWaniKani,
} from '../hooks/useKnownKanji';
import { useStudySettings, useUpdateStudySettings } from '../hooks/useStudy';
import useStudyBackgroundTask from '../hooks/useStudyBackgroundTask';

const StudySettingsPage = () => {
  const { t } = useTranslation('study');
  const { isFeatureEnabled } = useFeatureFlags();
  const enabled = isFeatureEnabled('flashcardsEnabled');
  const runBackgroundTask = useStudyBackgroundTask();
  const [newCardsPerDay, setNewCardsPerDay] = useState(STUDY_NEW_CARDS_PER_DAY_DEFAULT);
  const [lessonBatchSize, setLessonBatchSize] = useState(STUDY_LESSON_BATCH_SIZE_DEFAULT);
  const [laneWeights, setLaneWeights] = useState<StudyNewCardLaneWeights | null>(null);
  const [settingsSavedVisible, setSettingsSavedVisible] = useState(false);
  const [settingsSaveFailedVisible, setSettingsSaveFailedVisible] = useState(false);
  const [wanikaniToken, setWanikaniToken] = useState('');
  const [manualKanji, setManualKanji] = useState('');
  const [knowledgeError, setKnowledgeError] = useState<string | null>(null);

  const settingsQuery = useStudySettings(enabled);
  const updateSettingsMutation = useUpdateStudySettings();
  const knownKanjiQuery = useKnownKanji();
  const connectWaniKaniMutation = useConnectWaniKani();
  const disconnectWaniKaniMutation = useDisconnectWaniKani();
  const syncWaniKaniMutation = useSyncWaniKani();
  const setManualKnownKanjiMutation = useSetManualKnownKanji();

  useEffect(() => {
    if (settingsQuery.data) {
      setNewCardsPerDay(settingsQuery.data.newCardsPerDay);
      setLessonBatchSize(settingsQuery.data.lessonBatchSize ?? STUDY_LESSON_BATCH_SIZE_DEFAULT);
      setLaneWeights(settingsQuery.data.newCardLaneWeights);
    }
  }, [settingsQuery.data]);

  useEffect(() => {
    if (!settingsSavedVisible) return undefined;

    const timer = window.setTimeout(() => {
      setSettingsSavedVisible(false);
    }, 2000);

    return () => window.clearTimeout(timer);
  }, [settingsSavedVisible]);

  const laneWeightTotal = laneWeights
    ? laneWeights.standard + laneWeights.lessonFollowup + laneWeights.wanikani
    : 0;
  const lanePercentage = (weight: number) =>
    laneWeightTotal === 0 ? 0 : Math.round((weight / laneWeightTotal) * 100);
  const updateLaneWeight = (lane: keyof StudyNewCardLaneWeights, value: number) => {
    setSettingsSavedVisible(false);
    setSettingsSaveFailedVisible(false);
    setLaneWeights((current) => (current ? { ...current, [lane]: value } : current));
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

      <section className="card retro-paper-panel space-y-5">
        <div>
          <h2 className="text-2xl font-semibold text-navy">{t('settings.kanjiKnowledgeTitle')}</h2>
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
                    setWanikaniToken('');
                    await syncWaniKaniMutation.mutateAsync();
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
              <span className="text-sm font-semibold text-navy">{t('settings.wanikaniToken')}</span>
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
            if (!laneWeights) return;
            runBackgroundTask(
              async () => {
                try {
                  await updateSettingsMutation.mutateAsync({
                    newCardsPerDay,
                    lessonBatchSize,
                    newCardLaneWeights: laneWeights,
                  });
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
          <label className="block" htmlFor="study-lesson-batch-size">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
              {t('settings.lessonBatchSize')}
            </span>
            <input
              id="study-lesson-batch-size"
              type="number"
              min={STUDY_LESSON_BATCH_SIZE_MIN}
              max={STUDY_LESSON_BATCH_SIZE_MAX}
              step={1}
              value={lessonBatchSize}
              onChange={(event) => {
                setSettingsSavedVisible(false);
                setSettingsSaveFailedVisible(false);
                setLessonBatchSize(Number(event.target.value));
              }}
              className="mt-2 w-36 rounded-xl border border-gray-300 px-3 py-2 text-navy focus:border-navy focus:outline-none focus:ring-2 focus:ring-navy/20"
            />
          </label>
          {laneWeights ? (
            <fieldset className="w-full basis-full rounded-2xl border border-gray-200 bg-white/50 p-4">
              <legend className="px-2 text-sm font-semibold text-navy">
                {t('settings.laneBalanceTitle')}
              </legend>
              <p className="mb-4 text-sm text-gray-500">{t('settings.laneBalanceDescription')}</p>
              <div className="grid gap-3 sm:grid-cols-3">
                {(
                  [
                    ['standard', 'settings.standardLane'],
                    ['lessonFollowup', 'settings.lessonFollowupLane'],
                    ['wanikani', 'settings.wanikaniLane'],
                  ] as const
                ).map(([lane, label]) => (
                  <label
                    key={lane}
                    htmlFor={`study-lane-weight-${lane}`}
                    className="rounded-xl border border-gray-200 bg-white p-3"
                  >
                    <span className="flex items-center justify-between gap-2 text-sm font-semibold text-navy">
                      {t(label)}
                      <span className="font-normal text-gray-500">
                        {t('settings.laneShare', { percent: lanePercentage(laneWeights[lane]) })}
                      </span>
                    </span>
                    <input
                      id={`study-lane-weight-${lane}`}
                      aria-label={t(label)}
                      type="number"
                      min={lane === 'standard' ? 1 : 0}
                      max={20}
                      step={1}
                      value={laneWeights[lane]}
                      onChange={(event) => updateLaneWeight(lane, Number(event.target.value))}
                      className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-navy focus:border-navy focus:outline-none focus:ring-2 focus:ring-navy/20"
                    />
                  </label>
                ))}
              </div>
              <p className="mt-3 text-xs text-gray-500">{t('settings.laneBalanceHelp')}</p>
            </fieldset>
          ) : null}
          <button
            type="submit"
            disabled={updateSettingsMutation.isPending || !laneWeights}
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
    </div>
  );
};

export default StudySettingsPage;
