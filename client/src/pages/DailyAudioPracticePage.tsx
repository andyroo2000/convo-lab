import { useState } from 'react';
import { Plus } from 'lucide-react';
import playableDrill from '../utils/playableDrill';
import useStudyDrill from '../hooks/useStudyDrill';
import ScriptTrackPlayer from '../components/audio/ScriptTrackPlayer';
import NewDrillDialog from '../components/audio/NewDrillDialog';
import StudyCapabilitiesError from '../components/study/StudyCapabilitiesError';
import '../components/study/studyNotebook.css';

type Shelf = ReturnType<typeof useStudyDrill>;
const ShelfHeader = ({ model, open }: { model: Shelf; open: () => void }) => {
  const { recordings, recording, setPreferred, active, create, recent, capabilities } = model;
  const disabled =
    !capabilities.data || active || create.isPending || recent.isLoading || recent.isError;
  return (
    <header>
      <div>
        <h2>Daily Audio</h2>
        {recordings.length > 1 ? (
          <select
            aria-label="Recording date"
            value={recording?.id}
            onChange={(e) => setPreferred(e.target.value)}
          >
            {recordings.map((p) => (
              <option value={p.id} key={p.id}>
                {p.practiceDate} · {p.targetDurationMinutes} min
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
              · {recording.targetDurationMinutes} min
            </p>
          )
        )}
      </div>
      <button
        className="drill-add"
        type="button"
        aria-label="New audio drill"
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
  const { active, today, progress, create } = model;
  const pending = active || create.isPending;
  if (pending)
    return <p role="status">Preparing your audio drill… {progress != null && `${progress}%`}</p>;
  if (today?.status === 'generating')
    return <p role="status">Generation has stalled. Use New audio drill to retry.</p>;
  if (today?.status === 'error')
    return (
      <p role="alert">{today.errorMessage || 'Your drill could not be generated. Try again.'}</p>
    );
  return null;
};
const ShelfErrors = ({ model }: { model: Shelf }) => {
  const { recent, detail, create, capabilities } = model;
  return (
    <>
      {create.isError && <p role="alert">{create.error.message}</p>}
      {recent.isError && (
        <button type="button" onClick={() => recent.refetch()}>
          Retry loading drills
        </button>
      )}
      {detail.isError && (
        <button type="button" onClick={() => detail.refetch()}>
          Retry loading drill details
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
  const { recent, recording, today } = model;
  if (recent.isLoading) return <p role="status">Loading Daily Audio…</p>;
  if (!recent.isSuccess) return null;
  if (!recording && !today) return <p>Create your first audio drill to start listening.</p>;
  return null;
};
const DailyAudioPracticePage = () => {
  const model = useStudyDrill();
  const [open, setOpen] = useState(false);
  const { capabilities, generate, today } = model;
  const limits = capabilities.data?.dailyAudio.targetDurationMinutes;
  const begin = (minutes: number) => {
    setOpen(false);
    generate(minutes).catch(() => undefined);
  };
  return (
    <section className="drill-shelf" aria-label="Daily Audio">
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
