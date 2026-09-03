import { useCallback, useRef, useState } from 'react';

import { buildTimeAudioClipUrls } from '../../japaneseDate/logic/preRenderedTimeAudio';
import { playAudioClipSequence, type AudioSequencePlayback } from '../../logic/audioClipPlayback';
import trackTimePracticeEvent from '../logic/analytics';
import type { TimePracticeCard } from '../logic/types';

const PLAYBACK_FAILURE_HINT = 'Autoplay was blocked. Tap Play or Next to hear audio.';

interface TimePracticeStatusInput {
  countdownSeconds: number | null;
  isPlaying: boolean;
  isPowerOn: boolean;
  isRevealed: boolean;
}

export const getTimePracticeStatusText = ({
  countdownSeconds,
  isPlaying,
  isPowerOn,
  isRevealed,
}: TimePracticeStatusInput): string => {
  if (!isPowerOn || countdownSeconds === null) return '';
  if (!isRevealed) return `answer in ${countdownSeconds}s`;
  if (!isPlaying) return `replaying in ${countdownSeconds}s`;
  return '';
};

const isCurrentPlayback = (
  activePlayback: AudioSequencePlayback | null,
  completedPlayback: AudioSequencePlayback | null
) => completedPlayback !== null && activePlayback === completedPlayback;

const useTimePracticeAudio = (card: TimePracticeCard, initialVolumeLevel: number) => {
  const [volumeLevel, setVolumeLevel] = useState(initialVolumeLevel);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackHint, setPlaybackHint] = useState<string | null>(null);
  const playbackRef = useRef<AudioSequencePlayback | null>(null);

  const stopPlayback = useCallback(() => {
    playbackRef.current?.stop();
    playbackRef.current = null;
    setIsPlaying(false);
  }, []);

  const playCurrentCardAudio = useCallback(async () => {
    stopPlayback();
    let currentPlayback: AudioSequencePlayback | null = null;

    try {
      const urls = buildTimeAudioClipUrls({
        hour24: card.hour24,
        minute: card.minute,
        hourFormat: '24h',
      });
      const playback = playAudioClipSequence(urls, { volume: volumeLevel });
      currentPlayback = playback;
      playbackRef.current = playback;
      setIsPlaying(true);
      setPlaybackHint(null);
      await playback.finished;
    } catch (error) {
      const isAbort = error instanceof DOMException && error.name === 'AbortError';
      if (!isAbort) {
        trackTimePracticeEvent('audio_play_error', 'random');
        setPlaybackHint(PLAYBACK_FAILURE_HINT);
      }
    } finally {
      if (isCurrentPlayback(playbackRef.current, currentPlayback)) {
        playbackRef.current = null;
      }
      setIsPlaying(false);
    }
  }, [card.hour24, card.minute, stopPlayback, volumeLevel]);

  const triggerRevealAudioPlayback = useCallback(() => {
    playCurrentCardAudio().catch((error) => {
      console.warn('[Time Tool] Unexpected reveal audio rejection:', error);
      setPlaybackHint(PLAYBACK_FAILURE_HINT);
    });
  }, [playCurrentCardAudio]);

  const handleVolumeChange = useCallback((nextVolume: number) => {
    setVolumeLevel(nextVolume);
    playbackRef.current?.setVolume(nextVolume);
  }, []);

  return {
    handleVolumeChange,
    isPlaying,
    playbackHint,
    playCurrentCardAudio,
    stopPlayback,
    triggerRevealAudioPlayback,
    volumeLevel,
  };
};

export default useTimePracticeAudio;
