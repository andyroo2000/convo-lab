import { createPortal } from 'react-dom';
import { ListenButton, RibbonProgress } from './JournalPlaybackControls';
import useJournalPlayer from './useJournalPlayer';
import type { RecordingLoader } from './useTimedRecording';

interface Props {
  load: RecordingLoader;
  label: string;
  disabled?: boolean;
  target?: HTMLElement | null;
}
const JournalInlinePlayer = ({ load, label, disabled, target }: Props) => {
  const player = useJournalPlayer(load);
  const controls = (
    <>
      <ListenButton player={player} label={label} disabled={disabled} />
      <RibbonProgress player={player} label={label} />
    </>
  );
  return (
    <>
      {target ? (
        createPortal(controls, target)
      ) : (
        <div className="relative flex items-center pb-3">{controls}</div>
      )}
      {player.busy && (
        <p role="status" className="sr-only">
          Preparing audio…
        </p>
      )}
      {player.error && (
        <p role="alert" className="text-sm text-rose-700">
          {player.error}
        </p>
      )}
      {player.recording && (
        <audio
          ref={player.playback.player}
          data-journal-audio
          src={player.recording.url}
          aria-label={`${label} audio`}
          preload="auto"
          {...player.media}
        />
      )}
    </>
  );
};
export default JournalInlinePlayer;
