import { createContext, useContext, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { adjacentSentence, type SentenceTiming } from './journalTimedAudio';

export function usePlaybackState() {
  const player = useRef<HTMLAudioElement>(null);
  const [sentences, setSentences] = useState<SentenceTiming[]>([]);
  const [position, setPosition] = useState(0);
  const [engaged, setEngaged] = useState(false);
  return useMemo(
    () => ({
      player,
      sentences,
      setSentences,
      position,
      setPosition,
      engaged,
      setEngaged,
      seek(value: number) {
        if (!player.current) return;
        player.current.currentTime = value;
        setPosition(value);
        setEngaged(true);
      },
    }),
    [sentences, position, engaged]
  );
}
export const PlaybackContext = createContext<ReturnType<typeof usePlaybackState> | null>(null);
export function useJournalPlayback() {
  const context = useContext(PlaybackContext);
  const fallback = usePlaybackState();
  return context ?? fallback;
}
export function sentenceKeyDown(
  event: KeyboardEvent,
  playback: ReturnType<typeof useJournalPlayback>
) {
  if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
  if ([event.altKey, event.metaKey, event.ctrlKey, event.shiftKey].some(Boolean)) return;
  const time = adjacentSentence(
    playback.sentences,
    playback.position,
    event.key === 'ArrowLeft' ? -1 : 1
  );
  if (time === undefined) return;
  event.preventDefault();
  playback.seek(time);
}
