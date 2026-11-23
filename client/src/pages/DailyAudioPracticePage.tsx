import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { Plus } from 'lucide-react';
import playableDrill from '../utils/playableDrill';
import useStudyDrill from '../hooks/useStudyDrill';
import DrillGenerationProgress from '../components/audio/DrillGenerationProgress';
import ScriptTrackPlayer from '../components/audio/ScriptTrackPlayer';
import NewDrillDialog from '../components/audio/NewDrillDialog';
import StudyCapabilitiesError from '../components/study/StudyCapabilitiesError';
import '../components/study/studyNotebook.css';

type Shelf = ReturnType<typeof useStudyDrill>;
const ShelfHeader = ({ model, open }: { model: Shelf; open: () => void }) => {
  const { t } = useTranslation('study', { keyPrefix: 'drillPlayer' });
  const { recordings, recording, setPreferred, active, create, recent, capabilities } = model;
  const disabled =
    !capabilities.data || active || create.isPending || recent.isLoading || recent.isError;
  return (
    <header>
      <div>
        <h2>{t('title')}</h2>
        {recordings.length > 1 ? (
          <select
            aria-label={t('recordingDate')}
            value={recording?.id}
            onChange={(e) => setPreferred(e.target.value)}
          >
            {recordings.map((p) => (
              <option value={p.id} key={p.id}>
                {p.practiceDate} · {t('minutes', { minutes: p.targetDurationMinutes })}
              </option>
            ))}
          </select>
        ) : (
          recording && (
            <p>
              {new Date(`${recording.practiceDate}T12:00:00`).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}{' '}
              · {t('minutes', { minutes: recording.targetDurationMinutes })}
            </p>
          )
        )}
      </div>
      <button
        className="drill-add"
        type="button"
        aria-label={t('newDrill')}
        disabled={disabled}
        onClick={open}
      >
        <Plus aria-hidden="true" />
      </button>
    </header>
  );
};
const ShelfRecording = ({ model }: { model: Shelf }) => {
  const { recording } = model;
  const track = recording && playableDrill(recording);
  if (!track || !recording) return null;
  return (
    <ScriptTrackPlayer
      key={track.id + track.updatedAt}
      title={track.title}
      status={track.status}
      audioUrl={track.audioUrl}
      scriptUnits={track.scriptUnitsJson}
      timingData={track.timingData}
      approxDurationSeconds={track.approxDurationSeconds}
      updatedAt={track.updatedAt}
      targetLanguage={recording.targetLanguage}
    />
  );
};
const GenerationStatus = ({ model }: { model: Shelf }) => {
  const { t } = useTranslation('study', { keyPrefix: 'drillPlayer' });
  const { active, today, progress, create } = model;
  const pending = active || create.isPending;
  if (pending) {
    const percent = active ? progress : undefined;
    return <DrillGenerationProgress percent={percent} />;
  }
  if (today?.status === 'generating') return <p role="status">{t('stalled')}</p>;
  if (today?.status === 'error')
    return <p role="alert">{today.errorMessage || t('generationError')}</p>;
  return null;
};
const ShelfErrors = ({ model }: { model: Shelf }) => {
  const { t } = useTranslation('study', { keyPrefix: 'drillPlayer' });
  const { recent, detail, create, capabilities } = model;
  return (
    <>
      {create.isError && <p role="alert">{create.error.message}</p>}
      {recent.isError && (
        <button type="button" onClick={() => recent.refetch()}>
          {t('retryList')}
        </button>
      )}
      {detail.isError && (
        <button type="button" onClick={() => detail.refetch()}>
          {t('retryDetail')}
        </button>
      )}
      <StudyCapabilitiesError
        isError={capabilities.isError}
        isRetrying={capabilities.isFetching}
        onRetry={() => capabilities.refetch()}
      />
    </>
  );
};
const EmptyShelf = ({ model }: { model: Shelf }) => {
  const { t } = useTranslation('study', { keyPrefix: 'drillPlayer' });
  const { recent, recording, today } = model;
  if (recent.isLoading) return <p role="status">{t('loading')}</p>;
  if (!recent.isSuccess) return null;
  if (!recording && !today) return <p>{t('first')}</p>;
  return null;
};
const DailyAudioPracticePage = () => {
  const { t } = useTranslation('study', { keyPrefix: 'drillPlayer' });
  const model = useStudyDrill();
  const [open, setOpen] = useState(false);
  const { capabilities, generate, today } = model;
  const limits = capabilities.data?.dailyAudio.targetDurationMinutes;
  const begin = (minutes: number) => {
    setOpen(false);
    generate(minutes).catch(() => undefined);
  };
  return (
    <section className="drill-shelf" aria-label={t('title')}>
      <ShelfHeader model={model} open={() => setOpen(true)} />
      <ShelfRecording model={model} />
      <EmptyShelf model={model} />
      <GenerationStatus model={model} />
      <ShelfErrors model={model} />
      {open && limits && (
        <NewDrillDialog
          limits={limits}
          replacing={today?.status === 'ready'}
          onClose={() => setOpen(false)}
          onCreate={begin}
        />
      )}
    </section>
  );
};
export default DailyAudioPracticePage;
