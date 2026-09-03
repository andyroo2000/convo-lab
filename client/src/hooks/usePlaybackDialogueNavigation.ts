import { useCallback, useEffect, useRef, type KeyboardEvent } from 'react';

import { hasBlockingShortcutState } from '../lib/keyboardShortcuts';
import { getSentenceTiming, isSentenceActive } from '../lib/playbackTiming';
import type { AudioSpeed, Episode, Sentence } from '../types';

interface ScrollActiveSentenceOptions {
  currentTime: number;
  episode: Episode | null;
  selectedSpeed: AudioSpeed;
  sentenceRefs: Map<string, HTMLDivElement>;
}

function scrollActiveSentenceIntoView(options: ScrollActiveSentenceOptions) {
  if (!options.episode?.dialogue?.sentences) return;

  const currentSentence = options.episode.dialogue.sentences.find((sentence) =>
    isSentenceActive(sentence, options.selectedSpeed, options.currentTime * 1000)
  );
  if (!currentSentence) return;

  const element = options.sentenceRefs.get(currentSentence.id);
  if (!element) return;

  const stickyHeader = document.querySelector('[data-playback-sticky-header]');
  const headerHeight = stickyHeader ? stickyHeader.getBoundingClientRect().height : 0;
  const nav = document.querySelector('.retro-topbar');
  const navHeight = nav ? nav.getBoundingClientRect().height : 72;
  const yOffset = -(navHeight + headerHeight + 20);
  const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
  window.scrollTo({ top: y, behavior: 'smooth' });
}

interface SeekToPlaybackSentenceOptions {
  isPlaying: boolean;
  play: () => void;
  seek: (time: number) => void;
  selectedSpeed: AudioSpeed;
  sentence: Sentence;
}

function seekToPlaybackSentence(options: SeekToPlaybackSentenceOptions) {
  const { startTime } = getSentenceTiming(options.sentence, options.selectedSpeed);
  if (startTime === undefined) return;

  options.seek(startTime / 1000);
  if (!options.isPlaying) options.play();
}

function handlePlaybackSentenceKeyDown(
  event: KeyboardEvent,
  sentence: Sentence,
  navigateSentence: (direction: 'previous' | 'next') => void,
  seekToSentence: (sentence: Sentence) => void
) {
  if (hasBlockingShortcutState(event)) return;

  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault();
    navigateSentence(event.key === 'ArrowLeft' ? 'previous' : 'next');
    return;
  }

  if (event.key !== 'Enter' && event.key !== ' ') return;

  event.preventDefault();
  seekToSentence(sentence);
}

interface PlaybackDialogueNavigationOptions {
  currentTime: number;
  episode: Episode | null;
  isPlaying: boolean;
  navigateSentence: (direction: 'previous' | 'next') => void;
  play: () => void;
  seek: (time: number) => void;
  selectedSpeed: AudioSpeed;
}

export default function usePlaybackDialogueNavigation({
  currentTime,
  episode,
  isPlaying,
  navigateSentence,
  play,
  seek,
  selectedSpeed,
}: PlaybackDialogueNavigationOptions) {
  const sentenceRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => {
    scrollActiveSentenceIntoView({
      currentTime,
      episode,
      selectedSpeed,
      sentenceRefs: sentenceRefs.current,
    });
  }, [currentTime, episode, selectedSpeed]);

  const seekToSentence = useCallback(
    (sentence: Sentence) => {
      seekToPlaybackSentence({ isPlaying, play, seek, selectedSpeed, sentence });
    },
    [isPlaying, play, seek, selectedSpeed]
  );

  const handleSentenceKeyDown = useCallback(
    (event: KeyboardEvent, sentence: Sentence) => {
      handlePlaybackSentenceKeyDown(event, sentence, navigateSentence, seekToSentence);
    },
    [navigateSentence, seekToSentence]
  );

  return { handleSentenceKeyDown, seekToSentence, sentenceRefs };
}
