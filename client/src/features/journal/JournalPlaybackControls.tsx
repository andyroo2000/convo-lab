import { LoaderCircle, Pause, Play, RotateCcw, Volume2 } from 'lucide-react';
import useJournalProgress from './useJournalProgress';
import { sentenceKeyDown } from './useJournalPlayback';
import type useJournalPlayer from './useJournalPlayer';

type Player = ReturnType<typeof useJournalPlayer>;
function playbackAction(player: Player) {
  if (player.busy) return 'Loading…';
  if (player.playing) return 'Pause';
  if (player.duration > 0 && player.playback.position >= player.duration) return 'Replay';
  return player.playback.position > 0 ? 'Resume' : 'Listen';
}
export const ListenButton = ({
  player,
  label,
  disabled = false,
}: {
  player: Player;
  label: string;
  disabled?: boolean;
}) => {
  const action = playbackAction(player);
  const icons = {
    'Loading…': LoaderCircle,
    Pause,
    Replay: RotateCcw,
    Resume: Play,
    Listen: Volume2,
  };
  const Icon = icons[action];
  return (
    <button
      type="button"
      disabled={player.busy || disabled}
      data-journal-playback-control
      onKeyDown={(event) => sentenceKeyDown(event, player.playback)}
      aria-label={`${action} ${label}`}
      onClick={player.toggle}
      className="flex min-h-11 min-w-24 shrink-0 items-center justify-center gap-2 rounded-full border border-[#bdcfe4] bg-white px-3 text-sm text-indigo focus-visible:outline-indigo disabled:opacity-60 sm:min-h-9"
    >
      <Icon
        size={16}
        aria-hidden="true"
        className={player.busy ? 'motion-safe:animate-spin' : undefined}
      />
      {action}
    </button>
  );
};
export const RibbonProgress = ({ player, label }: { player: Player; label: string }) => {
  const progressBar = useJournalProgress(player);
  if (!player.recording) return null;
  return (
    <div
      role="progressbar"
      aria-label={`${label} playback progress`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(
        player.duration ? Math.min(1, player.playback.position / player.duration) * 100 : 0
      )}
      className="pointer-events-none absolute inset-x-0 bottom-0 h-[3px] overflow-hidden bg-[#cfdeed]"
    >
      <div ref={progressBar} className="h-full origin-left bg-indigo" />
    </div>
  );
};
