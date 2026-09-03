import { useCallback } from 'react';

import type { AudioSequencePlayback } from '../../logic/audioClipPlayback';
import { buildDateAudioClipUrls, playDateAudioClipSequence } from '../logic/preRenderedDateAudio';
import type { JapaneseDatePracticeState } from './useJapaneseDatePracticeState';

const AUTOPLAY_HINT = 'Autoplay was blocked. Tap Auto-Play or Show Answer to hear audio.';

const useJapaneseDatePlayback = (state: JapaneseDatePracticeState) => {
  const { card, playbackRef, setIsPlaying, setIsRevealed, setPlaybackHint, showYear, volumeLevel } =
    state;
  const stopPlayback = useCallback(() => {
    playbackRef.current?.stop();
    playbackRef.current = null;
    setIsPlaying(false);
  }, [playbackRef, setIsPlaying]);

  const playCurrentCardAudio = useCallback(async () => {
    stopPlayback();
    let currentPlayback: AudioSequencePlayback | null = null;
    try {
      const year = card.date.getFullYear();
      const month = card.date.getMonth() + 1;
      const day = card.date.getDate();
      const urls = buildDateAudioClipUrls({ year, month, day, includeYear: showYear });
      const playback = playDateAudioClipSequence(urls, { volume: volumeLevel });
      currentPlayback = playback;
      playbackRef.current = playback;
      setIsPlaying(true);
      setPlaybackHint(null);
      await playback.finished;
    } catch (error) {
      const isAbort = error instanceof DOMException && error.name === 'AbortError';
      if (!isAbort) setPlaybackHint(AUTOPLAY_HINT);
    } finally {
      if (currentPlayback && playbackRef.current === currentPlayback) {
        playbackRef.current = null;
      }
      setIsPlaying(false);
    }
  }, [card.date, playbackRef, setIsPlaying, setPlaybackHint, showYear, stopPlayback, volumeLevel]);

  const triggerRevealAudioPlayback = useCallback(() => {
    playCurrentCardAudio().catch((error) => {
      console.warn('[Date Tool] Unexpected reveal audio rejection:', error);
      setPlaybackHint(AUTOPLAY_HINT);
    });
  }, [playCurrentCardAudio, setPlaybackHint]);

  const revealCard = useCallback(() => {
    setIsRevealed(true);
    triggerRevealAudioPlayback();
  }, [setIsRevealed, triggerRevealAudioPlayback]);

  return { playCurrentCardAudio, revealCard, stopPlayback };
};

export type JapaneseDatePlayback = ReturnType<typeof useJapaneseDatePlayback>;

export default useJapaneseDatePlayback;
