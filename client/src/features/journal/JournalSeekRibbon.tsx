import { useEffect, useRef } from 'react';
import type useJournalPlayer from './useJournalPlayer';

const JournalSeekRibbon = ({
  player,
  label,
}: {
  player: ReturnType<typeof useJournalPlayer>;
  label: string;
}) => {
  const root = useRef<HTMLDivElement>(null);
  const { duration, playing, playback } = player;
  const { position, player: audio } = playback;
  useEffect(() => {
    let frame: number;
    const paint = () => {
      const time = playing ? (audio.current?.currentTime ?? position) : position;
      root.current?.style.setProperty(
        '--progress',
        `${duration ? Math.min(100, Math.max(0, (time / duration) * 100)) : 0}%`
      );
      if (playing) frame = requestAnimationFrame(paint);
    };
    paint();
    return () => cancelAnimationFrame(frame);
  }, [duration, playing, position, audio]);
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
        value={position}
        disabled={!duration}
        onChange={(event) => playback.seek(Number(event.target.value))}
      />
    </div>
  );
};
export default JournalSeekRibbon;
