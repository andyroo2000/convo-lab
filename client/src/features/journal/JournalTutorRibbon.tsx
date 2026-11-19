import type { ReactNode } from 'react';
import { ListenButton, RibbonProgress } from './JournalPlaybackControls';
import type useJournalPlayer from './useJournalPlayer';

type Player = ReturnType<typeof useJournalPlayer>;
export interface TutorRibbonSlots {
  portrait?: ReactNode;
  controls?: ReactNode;
  children?: ReactNode;
}
const JournalTutorRibbon = ({
  portrait,
  controls,
  children,
  player,
  label = 'tutor question',
}: TutorRibbonSlots & { player?: Player; label?: string }) => (
  <div className="min-w-0 rounded-xl border border-[#dae5f2] bg-white">
    <div className="journal-tutor-audio-header">
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
