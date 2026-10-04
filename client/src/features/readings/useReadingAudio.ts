import { useCallback, useEffect, useRef, useState } from 'react';
import SentenceAudioPlayer, { type AudioStatus } from './SentenceAudioPlayer';

export default function useReadingAudio(readingId: string, sentence: number | null) {
  const audio = useRef<SentenceAudioPlayer | null>(null);
  const [status, setStatus] = useState<AudioStatus>('idle');

  useEffect(() => {
    setStatus('idle');
    if (sentence === null) return undefined;
    const player = new SentenceAudioPlayer(readingId, sentence, setStatus);
    audio.current = player;
    return () => {
      player.dispose();
      audio.current = null;
    };
  }, [readingId, sentence]);

  const toggle = useCallback(() => audio.current?.toggle(), []);
  return { status, toggle };
}
