import { useEffect, useRef } from 'react';

import { shouldIgnoreGlobalShortcut } from '../lib/keyboardShortcuts';
import { getSentenceNavigationTargetMs } from '../lib/playbackTiming';
import type { AudioSpeed, Sentence } from '../types';

interface UsePlaybackKeyboardControlsOptions {
  currentTimeSeconds: number;
  enabled: boolean;
  isPlaying: boolean;
  pause: () => void;
  play: () => void;
  seek: (timeSeconds: number) => void;
  selectedSpeed: AudioSpeed;
  sentences: Sentence[];
}

type SentenceNavigationDirection = 'previous' | 'next';

interface PlaybackKeyboardControls {
  navigateSentence: (direction: SentenceNavigationDirection) => void;
}

const seekToAdjacentSentence = (
  controls: Omit<UsePlaybackKeyboardControlsOptions, 'enabled' | 'isPlaying' | 'pause' | 'play'>,
  direction: SentenceNavigationDirection
): void => {
  if (controls.sentences.length === 0) return;

  const targetTimeMs = getSentenceNavigationTargetMs(
    controls.sentences,
    controls.selectedSpeed,
    controls.currentTimeSeconds * 1000,
    direction
  );

  if (targetTimeMs !== undefined) controls.seek(targetTimeMs / 1000);
};

export default function usePlaybackKeyboardControls({
  currentTimeSeconds,
  enabled,
  isPlaying,
  pause,
  play,
  seek,
  selectedSpeed,
  sentences,
}: UsePlaybackKeyboardControlsOptions): PlaybackKeyboardControls {
  const controlsRef = useRef({
    currentTimeSeconds,
    enabled,
    isPlaying,
    pause,
    play,
    seek,
    selectedSpeed,
    sentences,
  });

  useEffect(() => {
    controlsRef.current = {
      currentTimeSeconds,
      enabled,
      isPlaying,
      pause,
      play,
      seek,
      selectedSpeed,
      sentences,
    };
  }, [currentTimeSeconds, enabled, isPlaying, pause, play, seek, selectedSpeed, sentences]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (shouldIgnoreGlobalShortcut(event)) return;

      const controls = controlsRef.current;
      if (!controls.enabled) return;

      if (event.code === 'Space') {
        event.preventDefault();
        if (controls.isPlaying) {
          controls.pause();
        } else {
          controls.play();
        }
        return;
      }

      if (event.code !== 'ArrowLeft' && event.code !== 'ArrowRight') return;
      event.preventDefault();
      seekToAdjacentSentence(controls, event.code === 'ArrowLeft' ? 'previous' : 'next');
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return {
    navigateSentence: (direction) =>
      seekToAdjacentSentence({ currentTimeSeconds, seek, selectedSpeed, sentences }, direction),
  };
}
