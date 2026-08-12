import { useEffect, useRef } from 'react';

import { getSentenceNavigationTargetMs } from '../lib/playbackTiming';
import type { AudioSpeed, Sentence } from '../types';

interface UsePlaybackKeyboardControlsOptions {
  currentTimeSeconds: number;
  isPlaying: boolean;
  pause: () => void;
  play: () => void;
  seek: (timeSeconds: number) => void;
  selectedSpeed: AudioSpeed;
  sentences: Sentence[];
}

const interactiveTargetSelector = [
  'a[href]',
  'audio',
  'button',
  'input',
  'select',
  'summary',
  'textarea',
  'video',
  '[contenteditable]:not([contenteditable="false"])',
  '[role="button"]',
  '[role="checkbox"]',
  '[role="combobox"]',
  '[role="link"]',
  '[role="menuitem"]',
  '[role="option"]',
  '[role="slider"]',
  '[role="switch"]',
  '[role="tab"]',
  '[role="textbox"]',
].join(',');

const isInteractiveTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;

  return target.isContentEditable || target.closest(interactiveTargetSelector) !== null;
};

const hasShortcutModifier = (event: KeyboardEvent): boolean =>
  event.altKey || event.ctrlKey || event.metaKey || event.shiftKey;

export default function usePlaybackKeyboardControls({
  currentTimeSeconds,
  isPlaying,
  pause,
  play,
  seek,
  selectedSpeed,
  sentences,
}: UsePlaybackKeyboardControlsOptions): void {
  const controlsRef = useRef({
    currentTimeSeconds,
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
      isPlaying,
      pause,
      play,
      seek,
      selectedSpeed,
      sentences,
    };
  }, [currentTimeSeconds, isPlaying, pause, play, seek, selectedSpeed, sentences]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.repeat ||
        hasShortcutModifier(event) ||
        isInteractiveTarget(event.target)
      ) {
        return;
      }

      const controls = controlsRef.current;

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
      if (controls.sentences.length === 0) return;

      event.preventDefault();
      const targetTimeMs = getSentenceNavigationTargetMs(
        controls.sentences,
        controls.selectedSpeed,
        controls.currentTimeSeconds * 1000,
        event.code === 'ArrowLeft' ? 'previous' : 'next'
      );

      if (targetTimeMs !== undefined) controls.seek(targetTimeMs / 1000);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
}
