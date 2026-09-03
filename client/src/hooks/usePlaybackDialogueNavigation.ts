import { useCallback, useEffect, useRef, type KeyboardEvent } from 'react';

import {
  handlePlaybackSentenceKeyDown,
  scrollActiveSentenceIntoView,
  seekToPlaybackSentence,
} from '../lib/playbackDialogueNavigation';
import type { AudioSpeed, Episode, Sentence } from '../types';

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
