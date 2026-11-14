import { LoaderCircle, Pause, Play } from 'lucide-react';
import { sentenceKeyDown } from './useJournalPlayback';
import useJournalPlayer from './useJournalPlayer';
import type { RecordingLoader } from './useTimedRecording';

const clock = (time: number) =>
  `${Math.floor(time / 60)}:${String(Math.floor(time % 60)).padStart(2, '0')}`;
interface Props {
  load: RecordingLoader;
  label: string;
  disabled?: boolean;
}
const PlayerIcon = ({ busy, playing }: { busy: boolean; playing: boolean }) => {
  if (busy) return <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />;
  return playing ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />;
};
const PlayerStatus = ({ player }: { player: ReturnType<typeof useJournalPlayer> }) => (
  <>
    {player.busy && (
      <p role="status" className="text-xs text-gray-500">
        Preparing audio…
      </p>
    )}
    {player.error && (
      <p role="alert" className="text-sm text-rose-700">
        {player.error}
      </p>
    )}
    {player.recording?.data.sentences.length === 0 && (
      <p className="text-xs text-gray-500">Sentence timing is unavailable for this recording.</p>
    )}
  </>
);
const JournalMinimalPlayer = ({ load, label, disabled = false }: Props) => {
  const player = useJournalPlayer(load);
  const { playback, recording, playing, busy, duration, toggle, media } = player;
  return (
    <div className="space-y-2">
      <div
        className="flex min-w-0 items-center gap-2.5"
        role="group"
        aria-label={`${label} player`}
      >
        <button
          type="button"
          disabled={busy || disabled}
          data-journal-playback-control
          onKeyDown={(event) => sentenceKeyDown(event, playback)}
          aria-label={`${playing ? 'Pause' : 'Play'} ${label}`}
          onClick={toggle}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-indigo text-white disabled:opacity-50 sm:h-9 sm:w-9"
        >
          <PlayerIcon busy={busy} playing={playing} />
        </button>
        <input
          type="range"
          data-journal-playback-control
          onKeyDown={(event) => sentenceKeyDown(event, playback)}
          aria-label={`${label} audio position`}
          min={0}
          max={duration || 1}
          step={0.01}
          value={playback.position}
          disabled={!duration}
          onChange={(event) => playback.seek(Number(event.target.value))}
          className="h-11 min-w-0 flex-1 accent-indigo"
        />
        <span className="min-w-8 text-right text-xs tabular-nums text-gray-500">
          {clock(playback.position)}
        </span>
        {recording && (
          <audio
            ref={playback.player}
            data-journal-audio
            src={recording.url}
            aria-label={`${label} audio`}
            preload="auto"
            {...media}
          />
        )}
      </div>
      <PlayerStatus player={player} />
    </div>
  );
};
export default JournalMinimalPlayer;
