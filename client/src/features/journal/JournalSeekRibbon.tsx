import { useEffect, useRef, useState } from 'react';
import type useJournalPlayer from './useJournalPlayer';

const JournalSeekRibbon = ({
  player,
  label,
}: {
  player: ReturnType<typeof useJournalPlayer>;
  label: string;
}) => {
  const root = useRef<HTMLDivElement>(null);
  const [scrubbing, setScrubbing] = useState<number | null>(null);
  const { duration, playing, playback } = player;
  const { position, player: audio } = playback;
  useEffect(() => {
    let frame: number;
    const paint = () => {
      const time = scrubbing ?? (playing ? (audio.current?.currentTime ?? position) : position);
      root.current?.style.setProperty(
        '--progress',
        `${duration ? Math.min(100, Math.max(0, (time / duration) * 100)) : 0}%`
      );
      if (playing && scrubbing === null) frame = requestAnimationFrame(paint);
    };
    paint();
    return () => cancelAnimationFrame(frame);
  }, [duration, playing, position, audio, scrubbing]);
  return (
    <div ref={root} className="journal-seek-ribbon">
      <div className="journal-seek-track">
        <span />
        <i />
      </div>
      <input
        type="range"
        aria-label={`${label} audio position`}
        min={0}
        max={duration || 1}
        step={0.1}
        value={scrubbing ?? position}
        aria-valuetext={`${Math.round(scrubbing ?? position)} of ${Math.round(duration)} seconds`}
        disabled={!duration}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          setScrubbing(position);
        }}
        onPointerUp={() => {
          if (scrubbing !== null) playback.seek(scrubbing);
          setScrubbing(null);
        }}
        onPointerCancel={() => setScrubbing(null)}
        onChange={(event) => {
          const value = Number(event.target.value);
          if (scrubbing === null) playback.seek(value);
          else setScrubbing(value);
        }}
      />
    </div>
  );
};
export default JournalSeekRibbon;
