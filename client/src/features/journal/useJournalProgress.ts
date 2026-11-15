import { useEffect, useRef } from 'react';
import type useJournalPlayer from './useJournalPlayer';

// Paint only the ribbon each frame; sentence highlights keep their normal update cadence.
export default function useJournalProgress({
  playback: { player, position },
  duration,
  playing,
  recording,
}: ReturnType<typeof useJournalPlayer>) {
  const bar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function paint(time: number) {
      const progress = duration > 0 ? Math.max(0, Math.min(1, time / duration)) : 0;
      if (bar.current) bar.current.style.transform = `scaleX(${progress})`;
    }
    paint(position);
    if (!playing || !recording) return undefined;
    let frame: number;
    function update() {
      paint(player.current?.currentTime ?? position);
      frame = requestAnimationFrame(update);
    }
    update();
    return () => cancelAnimationFrame(frame);
  }, [player, position, duration, playing, recording]);
  return bar;
}
