import type { ReactNode } from 'react';
import { LoaderCircle, Pause, Play, RotateCcw, Volume2 } from 'lucide-react';
import { sentenceKeyDown } from './useJournalPlayback';
import type useJournalPlayer from './useJournalPlayer';

type Player = ReturnType<typeof useJournalPlayer>;
export interface TutorRibbonSlots {
  portrait?: ReactNode;
  controls?: ReactNode;
  children?: ReactNode;
}
function playbackAction(player: Player) {
  if (player.busy) return 'Loading…';
  if (player.playing) return 'Pause';
  if (player.duration > 0 && player.playback.position >= player.duration) return 'Replay';
  return player.playback.position > 0 ? 'Resume' : 'Listen';
}
const ListenButton = ({ player, label }: { player: Player; label: string }) => {
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
      disabled={player.busy}
      data-journal-playback-control
      onKeyDown={(event) => sentenceKeyDown(event, player.playback)}
      aria-label={`${action} ${label}`}
      onClick={player.toggle}
      className="flex min-h-11 min-w-24 shrink-0 items-center justify-center gap-2 rounded-full border border-[#bdcfe4] bg-white px-3 text-sm text-[#315b85] focus-visible:outline-indigo disabled:opacity-60 sm:min-h-9"
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
const RibbonProgress = ({ player, label }: { player: Player; label: string }) => {
  const progress = player.duration ? Math.min(1, player.playback.position / player.duration) : 0;
  if (!player.recording) return null;
  return (
    <div
      role="progressbar"
      aria-label={`${label} playback progress`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress * 100)}
      className="pointer-events-none absolute inset-x-0 bottom-0 h-[3px] overflow-hidden bg-[#cfdeed]"
    >
      <div
        className="h-full origin-left bg-[#20476a] transition-transform duration-200 ease-linear motion-reduce:transition-none"
        style={{ transform: `scaleX(${progress})` }}
      />
    </div>
  );
};
const JournalTutorRibbon = ({
  portrait,
  controls,
  children,
  player,
  label = 'tutor question',
}: TutorRibbonSlots & { player?: Player; label?: string }) => (
  <div className="min-w-0 rounded-xl border border-[#dae5f2] bg-white">
    <div className="relative flex flex-wrap items-center gap-2 rounded-t-xl bg-[#e4effc] px-3 py-2 sm:gap-3 sm:px-4">
      {portrait}
      {player && <ListenButton player={player} label={label} />}
      <div className="ml-auto flex items-center">{controls}</div>
      {player && <RibbonProgress player={player} label={label} />}
    </div>
    <div className="px-4 pb-5 pt-4 sm:px-5">{children}</div>
    {player?.busy && (
      <p role="status" className="sr-only">
        Preparing audio…
      </p>
    )}
    {player?.error && (
      <p role="alert" className="px-4 pb-4 text-sm text-rose-700">
        {player.error}
      </p>
    )}
    {player?.recording && (
      <audio
        ref={player.playback.player}
        data-journal-audio
        src={player.recording.url}
        aria-label={`${label} audio`}
        preload="auto"
        {...player.media}
      />
    )}
  </div>
);
export default JournalTutorRibbon;
