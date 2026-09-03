import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { StudyNewCardLaneWeights } from '@languageflow/shared/src/types';

import { useFeatureFlags } from '../hooks/useFeatureFlags';
import StudyCapabilitiesError from '../components/study/StudyCapabilitiesError';
import { useStudyCapabilities } from '../hooks/useStudyCapabilities';
import {
  useConnectWaniKani,
  useDisconnectWaniKani,
  useKnownKanji,
  useSetManualKnownKanji,
  useSyncWaniKani,
} from '../hooks/useKnownKanji';
import { useStudySettings, useUpdateStudySettings } from '../hooks/useStudy';
import useStudyBackgroundTask from '../hooks/useStudyBackgroundTask';

const MANUAL_KANJI_PATTERN = /^[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]$/u;
const LANE_FIELDS = [
  ['standard', 'settings.standardLane'],
  ['lessonFollowup', 'settings.lessonFollowupLane'],
  ['wanikani', 'settings.wanikaniLane'],
] as const;

const useStudySettingsPageModel = () => {
  const { t } = useTranslation('study');
  const { isFeatureEnabled } = useFeatureFlags();
  const enabled = isFeatureEnabled('flashcardsEnabled');
  const runBackgroundTask = useStudyBackgroundTask();
  const [newCardsPerDay, setNewCardsPerDay] = useState(0);
  const [lessonBatchSize, setLessonBatchSize] = useState(0);
  const [laneWeights, setLaneWeights] = useState<StudyNewCardLaneWeights | null>(null);
  const [settingsSavedVisible, setSettingsSavedVisible] = useState(false);
  const [settingsSaveFailedVisible, setSettingsSaveFailedVisible] = useState(false);
  const [wanikaniToken, setWanikaniToken] = useState('');
  const [manualKanji, setManualKanji] = useState('');
  const [knowledgeError, setKnowledgeError] = useState<string | null>(null);
  const settingsQuery = useStudySettings({ enabled });
  const capabilitiesQuery = useStudyCapabilities(enabled);
  const settingsCapabilities = capabilitiesQuery.data?.settings;
  const updateSettingsMutation = useUpdateStudySettings();
  const knownKanjiQuery = useKnownKanji();
  const connectWaniKaniMutation = useConnectWaniKani();
  const disconnectWaniKaniMutation = useDisconnectWaniKani();
  const syncWaniKaniMutation = useSyncWaniKani();
  const setManualKnownKanjiMutation = useSetManualKnownKanji();

  useEffect(() => {
    if (!settingsQuery.data) return;
    setNewCardsPerDay(settingsQuery.data.newCardsPerDay);
    setLessonBatchSize(
      settingsQuery.data.lessonBatchSize ?? settingsCapabilities?.lessonBatchSize.default ?? 0
    );
    setLaneWeights(settingsQuery.data.newCardLaneWeights ?? null);
  }, [settingsCapabilities?.lessonBatchSize.default, settingsQuery.data]);

  useEffect(() => {
    if (!settingsCapabilities || settingsQuery.data) return;
    setNewCardsPerDay(settingsCapabilities.newCardsPerDay.default);
    setLessonBatchSize(settingsCapabilities.lessonBatchSize.default);
    setLaneWeights({
      standard: settingsCapabilities.newCardLaneWeights.standard.default,
      lessonFollowup: settingsCapabilities.newCardLaneWeights.lessonFollowup.default,
      wanikani: settingsCapabilities.newCardLaneWeights.wanikani.default,
    });
  }, [settingsCapabilities, settingsQuery.data]);

  useEffect(() => {
    if (!settingsSavedVisible) return undefined;
    const timer = window.setTimeout(() => setSettingsSavedVisible(false), 2000);
    return () => window.clearTimeout(timer);
  }, [settingsSavedVisible]);

  const clearSaveFeedback = () => {
    setSettingsSavedVisible(false);
    setSettingsSaveFailedVisible(false);
  };
  const updateLaneWeight = (lane: keyof StudyNewCardLaneWeights, value: number) => {
    clearSaveFeedback();
    setLaneWeights((current) => (current ? { ...current, [lane]: value } : current));
  };
  const laneWeightTotal = laneWeights
    ? laneWeights.standard + laneWeights.lessonFollowup + laneWeights.wanikani
    : 0;
  const lanePercentage = (weight: number) =>
    laneWeightTotal === 0 ? 0 : Math.round((weight / laneWeightTotal) * 100);

  const syncWaniKani = () => {
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
  };
  const disconnectWaniKani = () => {
    setKnowledgeError(null);
    runBackgroundTask(() => disconnectWaniKaniMutation.mutateAsync(), {
      label: 'WaniKani disconnect',
    });
  };
  const connectWaniKani = (event: FormEvent) => {
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
  };
  const addManualKanji = (event: FormEvent) => {
    event.preventDefault();
    const kanji = manualKanji.trim();
    if (!MANUAL_KANJI_PATTERN.test(kanji)) {
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
  };
  const removeManualKanji = (kanji: string) => {
    setKnowledgeError(null);
    runBackgroundTask(() => setManualKnownKanjiMutation.mutateAsync({ kanji, known: false }), {
      label: 'Manual known kanji remove',
    });
  };
  const saveSettings = (event: FormEvent) => {
    event.preventDefault();
    runBackgroundTask(
      async () => {
        try {
          await updateSettingsMutation.mutateAsync({
            newCardsPerDay,
            lessonBatchSize,
            ...(laneWeights ? { newCardLaneWeights: laneWeights } : {}),
          });
          setSettingsSaveFailedVisible(false);
          setSettingsSavedVisible(true);
        } catch (error) {
          setSettingsSavedVisible(false);
          setSettingsSaveFailedVisible(true);
          throw error;
        }
      },
      { label: 'Study settings save' }
    );
  };

  return {
    addManualKanji,
    capabilitiesQuery,
    clearSaveFeedback,
    connectWaniKani,
    connectWaniKaniMutation,
    disconnectWaniKani,
    disconnectWaniKaniMutation,
    enabled,
    knownKanjiQuery,
    knowledgeError,
    lanePercentage,
    laneWeights,
    lessonBatchSize,
    manualKanji,
    newCardsPerDay,
    removeManualKanji,
    saveSettings,
    setLessonBatchSize,
    setManualKanji,
    setNewCardsPerDay,
    setWanikaniToken,
    settingsCapabilities,
    settingsQuery,
    settingsSaveFailedVisible,
    settingsSavedVisible,
    setManualKnownKanjiMutation,
    syncWaniKani,
    syncWaniKaniMutation,
    t,
    updateLaneWeight,
    updateSettingsMutation,
    wanikaniToken,
  };
};

type SettingsModel = ReturnType<typeof useStudySettingsPageModel>;

const SettingsDisabled = ({ model }: { model: SettingsModel }) => (
  <section className="card app-surface max-w-3xl">
    <h1 className="mb-4 text-2xl font-bold text-navy sm:text-3xl">{model.t('settings.title')}</h1>
    <p className="text-gray-600">{model.t('disabled')}</p>
  </section>
);

const SettingsHeader = ({ model }: { model: SettingsModel }) => (
  <section className="card app-surface px-4 py-5 sm:px-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-navy sm:text-3xl">{model.t('settings.title')}</h1>
        <p className="mt-1 text-sm text-gray-600 sm:text-base">{model.t('settings.description')}</p>
      </div>
      <Link to="/app/study" className="app-button-secondary">
        {model.t('settings.back')}
      </Link>
    </div>
  </section>
);

const KnownKanjiStatus = ({ model }: { model: SettingsModel }) => (
  <>
    {model.knownKanjiQuery.isLoading ? (
      <p className="text-sm text-gray-500">{model.t('settings.kanjiKnowledgeLoading')}</p>
    ) : null}
    {model.knownKanjiQuery.error || model.knowledgeError ? (
      <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
        {model.knowledgeError ?? model.t('settings.kanjiKnowledgeFailed')}
      </p>
    ) : null}
    {model.knownKanjiQuery.data ? (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <p className="font-semibold text-navy">
          {model.t('settings.knownKanjiCount', {
            count: model.knownKanjiQuery.data.kanji.length,
          })}
        </p>
        <p className="mt-1 text-sm text-gray-500">
          {model.knownKanjiQuery.data.wanikani.lastSyncedAt
            ? model.t('settings.wanikaniLastSynced', {
                value: new Date(model.knownKanjiQuery.data.wanikani.lastSyncedAt).toLocaleString(),
              })
            : model.t('settings.wanikaniNeverSynced')}
        </p>
      </div>
    ) : null}
  </>
);

const WaniKaniConnectedControls = ({ model }: { model: SettingsModel }) => (
  <div className="flex flex-wrap items-center gap-3">
    <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-800">
      {model.t('settings.wanikaniConnected')}
    </span>
    <button
      type="button"
      disabled={model.syncWaniKaniMutation.isPending}
      onClick={model.syncWaniKani}
      className="app-button-primary"
    >
      {model.syncWaniKaniMutation.isPending
        ? model.t('settings.wanikaniSyncing')
        : model.t('settings.wanikaniSync')}
    </button>
    <button
      type="button"
      disabled={model.disconnectWaniKaniMutation.isPending}
      onClick={model.disconnectWaniKani}
      className="app-button-secondary"
    >
      {model.t('settings.wanikaniDisconnect')}
    </button>
  </div>
);

const WaniKaniConnectForm = ({ model }: { model: SettingsModel }) => (
  <form className="space-y-3" onSubmit={model.connectWaniKani}>
    <label className="block" htmlFor="wanikani-api-token">
      <span className="text-sm font-semibold text-navy">{model.t('settings.wanikaniToken')}</span>
      <input
        id="wanikani-api-token"
        type="password"
        autoComplete="off"
        value={model.wanikaniToken}
        onChange={(event) => model.setWanikaniToken(event.target.value)}
        placeholder={model.t('settings.wanikaniTokenPlaceholder')}
        className="app-form-control mt-2 block w-full max-w-xl"
      />
    </label>
    <p className="text-xs text-gray-500">{model.t('settings.wanikaniTokenHelp')}</p>
    <button
      type="submit"
      disabled={model.connectWaniKaniMutation.isPending || !model.wanikaniToken.trim()}
      className="app-button-primary"
    >
      {model.connectWaniKaniMutation.isPending
        ? model.t('settings.wanikaniConnecting')
        : model.t('settings.wanikaniConnect')}
    </button>
  </form>
);

const WaniKaniControls = ({ model }: { model: SettingsModel }) =>
  model.knownKanjiQuery.data?.wanikani.connected ? (
    <WaniKaniConnectedControls model={model} />
  ) : (
    <WaniKaniConnectForm model={model} />
  );

const ManualKanjiControls = ({ model }: { model: SettingsModel }) => (
  <div className="border-t border-gray-200 pt-5">
    <h3 className="font-semibold text-navy">{model.t('settings.manualKanjiTitle')}</h3>
    <p className="mt-1 text-sm text-gray-500">{model.t('settings.manualKanjiDescription')}</p>
    <form className="mt-3 flex items-end gap-3" onSubmit={model.addManualKanji}>
      <label htmlFor="manual-known-kanji">
        <span className="sr-only">{model.t('settings.manualKanjiInput')}</span>
        <input
          id="manual-known-kanji"
          value={model.manualKanji}
          onChange={(event) => model.setManualKanji(event.target.value)}
          placeholder={model.t('settings.manualKanjiPlaceholder')}
          className="app-form-control w-32"
        />
      </label>
      <button
        type="submit"
        disabled={model.setManualKnownKanjiMutation.isPending}
        className="app-button-secondary"
      >
        {model.t('settings.manualKanjiAdd')}
      </button>
    </form>
    {model.knownKanjiQuery.data?.manualKanji.length ? (
      <ul className="mt-4 flex flex-wrap gap-2" aria-label={model.t('settings.manualKanjiList')}>
        {model.knownKanjiQuery.data.manualKanji.map((kanji) => (
          <li
            key={kanji}
            className="flex items-center gap-2 rounded-full bg-cream px-3 py-1.5 text-navy"
          >
            <span className="text-lg">{kanji}</span>
            <button
              type="button"
              aria-label={model.t('settings.manualKanjiRemove', { kanji })}
              onClick={() => model.removeManualKanji(kanji)}
              className="text-sm text-gray-500 hover:text-red-700"
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    ) : null}
  </div>
);

const KanjiKnowledgeSettings = ({ model }: { model: SettingsModel }) => (
  <section className="card app-surface space-y-5 p-4 sm:p-6">
    <div>
      <h2 className="text-2xl font-semibold text-navy">
        {model.t('settings.kanjiKnowledgeTitle')}
      </h2>
      <p className="text-sm text-gray-500">{model.t('settings.kanjiKnowledgeDescription')}</p>
    </div>
    <KnownKanjiStatus model={model} />
    <WaniKaniControls model={model} />
    <ManualKanjiControls model={model} />
  </section>
);

const LaneWeightsFields = ({ model }: { model: SettingsModel }) => {
  if (!model.laneWeights) return null;
  const { laneWeights } = model;
  return (
    <fieldset className="w-full basis-full rounded-lg border border-gray-200 bg-gray-50/70 p-4">
      <legend className="px-2 text-sm font-semibold text-navy">
        {model.t('settings.laneBalanceTitle')}
      </legend>
      <p className="mb-4 text-sm text-gray-500">{model.t('settings.laneBalanceDescription')}</p>
      <div className="grid gap-3 sm:grid-cols-3">
        {LANE_FIELDS.map(([lane, label]) => (
          <label
            key={lane}
            htmlFor={`study-lane-weight-${lane}`}
            className="rounded-lg border border-gray-200 bg-white p-3"
          >
            <span className="flex items-center justify-between gap-2 text-sm font-semibold text-navy">
              {model.t(label)}
              <span className="font-normal text-gray-500">
                {model.t('settings.laneShare', {
                  percent: model.lanePercentage(laneWeights[lane]),
                })}
              </span>
            </span>
            <input
              id={`study-lane-weight-${lane}`}
              aria-label={model.t(label)}
              type="number"
              min={model.settingsCapabilities?.newCardLaneWeights[lane].min}
              max={model.settingsCapabilities?.newCardLaneWeights[lane].max}
              step={1}
              value={laneWeights[lane]}
              onChange={(event) => model.updateLaneWeight(lane, Number(event.target.value))}
              className="app-form-control mt-2 w-full"
            />
          </label>
        ))}
      </div>
      <p className="mt-3 text-xs text-gray-500">{model.t('settings.laneBalanceHelp')}</p>
    </fieldset>
  );
};

const DailySettingsFields = ({ model }: { model: SettingsModel }) => (
  <>
    <label className="block" htmlFor="study-new-cards-per-day">
      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
        {model.t('settings.newCardsPerDay')}
      </span>
      <input
        id="study-new-cards-per-day"
        type="number"
        min={model.settingsCapabilities?.newCardsPerDay.min}
        max={model.settingsCapabilities?.newCardsPerDay.max}
        step={1}
        value={model.newCardsPerDay}
        onChange={(event) => {
          model.clearSaveFeedback();
          model.setNewCardsPerDay(Number(event.target.value));
        }}
        className="app-form-control mt-2 w-36"
      />
    </label>
    <label className="block" htmlFor="study-lesson-batch-size">
      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
        {model.t('settings.lessonBatchSize')}
      </span>
      <input
        id="study-lesson-batch-size"
        type="number"
        min={model.settingsCapabilities?.lessonBatchSize.min}
        max={model.settingsCapabilities?.lessonBatchSize.max}
        step={1}
        value={model.lessonBatchSize}
        onChange={(event) => {
          model.clearSaveFeedback();
          model.setLessonBatchSize(Number(event.target.value));
        }}
        className="app-form-control mt-2 w-36"
      />
    </label>
  </>
);

const DailyStudySettings = ({ model }: { model: SettingsModel }) => (
  <section className="card app-surface space-y-4 p-4 sm:p-6">
    <div>
      <h2 className="text-2xl font-semibold text-navy">{model.t('settings.dailyLimitTitle')}</h2>
      <p className="text-sm text-gray-500">{model.t('settings.dailyLimitDescription')}</p>
    </div>
    {model.settingsQuery.error ? (
      <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
        {model.t('settings.failedSettings')}
      </p>
    ) : null}
    <form className="flex flex-wrap items-end gap-3" onSubmit={model.saveSettings}>
      <DailySettingsFields model={model} />
      <LaneWeightsFields model={model} />
      <button
        type="submit"
        disabled={model.updateSettingsMutation.isPending || !model.settingsCapabilities}
        className="app-button-primary"
      >
        {model.updateSettingsMutation.isPending
          ? model.t('settings.saving')
          : model.t('settings.save')}
      </button>
      {model.settingsSavedVisible ? (
        <span className="text-sm font-medium text-green-700">{model.t('settings.saved')}</span>
      ) : null}
    </form>
    {model.settingsSaveFailedVisible ? (
      <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
        {model.t('settings.failedSave')}
      </p>
    ) : null}
  </section>
);

const StudySettingsPage = () => {
  const model = useStudySettingsPageModel();
  if (!model.enabled) return <SettingsDisabled model={model} />;
  return (
    <div className="mx-auto max-w-5xl space-y-4 sm:space-y-6">
      <SettingsHeader model={model} />
      <StudyCapabilitiesError
        isError={model.capabilitiesQuery.isError}
        isRetrying={model.capabilitiesQuery.isFetching}
        onRetry={() => model.capabilitiesQuery.refetch().catch(() => undefined)}
      />
      <KanjiKnowledgeSettings model={model} />
      <DailyStudySettings model={model} />
    </div>
  );
};

export default StudySettingsPage;
