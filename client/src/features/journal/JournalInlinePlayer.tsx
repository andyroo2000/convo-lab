import { createPortal } from 'react-dom';
import JournalAvatar from './JournalAvatar';
import JournalSeekRibbon from './JournalSeekRibbon';
import { ListenButton, RibbonProgress } from './JournalPlaybackControls';
import useJournalPlayer from './useJournalPlayer';
import type { RecordingLoader } from './useTimedRecording';

interface Props {
  load: RecordingLoader;
  label: string;
  disabled?: boolean;
  target?: HTMLElement | null;
  compact?: boolean;
  avatar?: string;
}
const JournalInlinePlayer = ({ load, label, disabled, target, compact = false, avatar }: Props) => {
  const player = useJournalPlayer(load);
  const controls = (
    <>
      {compact && <JournalAvatar src={avatar} className="journal-narrator-avatar" />}
      <ListenButton player={player} label={label} disabled={disabled} />
      {compact ? (
        <JournalSeekRibbon player={player} label={label} />
      ) : (
        <RibbonProgress player={player} label={label} />
      )}
    </>
  );
  return (
    <>
      {target ? (
        createPortal(controls, target)
      ) : (
        <div className={compact ? 'journal-audio-header' : 'relative flex items-center pb-3'}>
          {controls}
        </div>
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
