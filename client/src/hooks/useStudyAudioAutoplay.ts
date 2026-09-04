import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { StudyCardSummary } from '@languageflow/shared/src/types';

import type { AudioPlayerHandle } from '../components/study/StudyAudioPlayer';
import {
  getStudyCardAudioUrl,
  isAudioLedPromptCard,
  toAssetUrl,
} from '../components/study/studyCardUtils';
import { warmAudioCache } from '../lib/audioCache';

const PREWARM_CARD_COUNT = 3;

type RunBackgroundTask = (
  task?: Promise<unknown> | (() => Promise<unknown> | unknown),
  options?: { errorMessage?: string; label?: string; onError?: (message: string) => void }
) => void;

interface UseStudyAudioAutoplayOptions {
  autoplayBlocked: boolean;
  cards: StudyCardSummary[];
  currentCard: StudyCardSummary | null;
  ensureAnswerAudioPrepared: (cardId: string) => Promise<StudyCardSummary>;
  focusMode: boolean;
  runBackgroundTask: RunBackgroundTask;
  revealed: boolean;
}

interface PlayAudioOnceOptions {
  autoplayKeys: Set<string>;
  cardId: string;
  kind: 'answer' | 'prompt';
  player: AudioPlayerHandle | null;
  runBackgroundTask: RunBackgroundTask;
  url: string | null;
}

interface PrewarmOptions {
  cards: StudyCardSummary[];
  ensureAnswerAudioPrepared: (cardId: string) => Promise<StudyCardSummary>;
  focusMode: boolean;
  runBackgroundTask: RunBackgroundTask;
}

interface PromptAutoplayOptions {
  autoplayBlocked: boolean;
  autoplayKeys: Set<string>;
  currentCard: StudyCardSummary | null;
  focusMode: boolean;
  player: AudioPlayerHandle | null;
  revealed: boolean;
  runBackgroundTask: RunBackgroundTask;
}

interface AnswerAutoplayOptions {
  autoplayAnswerAudioForCard: (card: StudyCardSummary) => void;
  autoplayBlocked: boolean;
  currentCard: StudyCardSummary | null;
  focusMode: boolean;
  revealed: boolean;
}

const removeCardKeys = (autoplayKeys: Set<string>, cardId: string) => {
  const keyPrefix = `${cardId}:`;
  autoplayKeys.forEach((key) => {
    if (key.startsWith(keyPrefix)) autoplayKeys.delete(key);
  });
};

const playAudioOnce = ({
  autoplayKeys,
  cardId,
  kind,
  player,
  runBackgroundTask,
  url,
}: PlayAudioOnceOptions) => {
  if (!url) return;

  const autoplayKey = `${cardId}:${kind}:${url}`;
  if (autoplayKeys.has(autoplayKey)) return;
  if (!player) return;

  autoplayKeys.add(autoplayKey);
  runBackgroundTask(player.play(), {
    label: `Study ${kind}-audio autoplay`,
  });
};

const useAudioPrewarm = ({
  cards,
  ensureAnswerAudioPrepared,
  focusMode,
  runBackgroundTask,
}: PrewarmOptions) => {
  useEffect(() => {
    if (!focusMode) return;
    if (cards.length === 0) return;

    const upcomingCards = cards.slice(0, PREWARM_CARD_COUNT);
    const audioUrls = upcomingCards
      .map(getStudyCardAudioUrl)
      .filter((url): url is string => Boolean(url));

    warmAudioCache(audioUrls).catch((error) => {
      console.warn('Unable to warm study session audio:', error);
    });

    upcomingCards
      .filter((card) => !getStudyCardAudioUrl(card))
      .forEach((card) => {
        runBackgroundTask(() => ensureAnswerAudioPrepared(card.id), {
          label: 'Study answer-audio prewarm',
          errorMessage: 'Answer audio could not be prepared.',
        });
      });
  }, [cards, ensureAnswerAudioPrepared, focusMode, runBackgroundTask]);
};

const usePromptAudioAutoplay = ({
  autoplayBlocked,
  autoplayKeys,
  currentCard,
  focusMode,
  player,
  revealed,
  runBackgroundTask,
}: PromptAutoplayOptions) => {
  useEffect(() => {
    if (autoplayBlocked) return;
    if (!focusMode) return;
    if (!currentCard) return;
    if (revealed) return;
    if (!isAudioLedPromptCard(currentCard)) return;

    playAudioOnce({
      autoplayKeys,
      cardId: currentCard.id,
      kind: 'prompt',
      player,
      runBackgroundTask,
      url: toAssetUrl(currentCard.prompt.cueAudio?.url),
    });
  }, [autoplayBlocked, autoplayKeys, currentCard, focusMode, player, revealed, runBackgroundTask]);
};

const useAnswerAudioAutoplay = ({
  autoplayAnswerAudioForCard,
  autoplayBlocked,
  currentCard,
  focusMode,
  revealed,
}: AnswerAutoplayOptions) => {
  // The reveal commit mounts the answer player. Running this as a layout effect keeps
  // mobile playback inside the reveal tap instead of waiting for a post-paint effect.
  useLayoutEffect(() => {
    if (autoplayBlocked) return;
    if (!focusMode) return;
    if (!currentCard) return;
    if (!revealed) return;
    autoplayAnswerAudioForCard(currentCard);
  }, [autoplayAnswerAudioForCard, autoplayBlocked, currentCard, focusMode, revealed]);
};

export default function useStudyAudioAutoplay({
  autoplayBlocked,
  cards,
  currentCard,
  ensureAnswerAudioPrepared,
  focusMode,
  runBackgroundTask,
  revealed,
}: UseStudyAudioAutoplayOptions) {
  const promptAudioRef = useRef<AudioPlayerHandle | null>(null);
  const [promptAudioPlayer, setPromptAudioPlayer] = useState<AudioPlayerHandle | null>(null);
  const answerAudioRef = useRef<AudioPlayerHandle | null>(null);
  const promptAutoplayKeys = useRef(new Set<string>());
  const answerAutoplayKeys = useRef(new Set<string>());

  const stopAllAudio = useCallback(() => {
    promptAudioRef.current?.stop();
    answerAudioRef.current?.stop();
  }, []);

  const bindPromptAudioPlayer = useCallback((player: AudioPlayerHandle | null) => {
    promptAudioRef.current = player;
    setPromptAudioPlayer(player);
  }, []);

  const resetAutoplayForCard = useCallback((cardId: string) => {
    removeCardKeys(promptAutoplayKeys.current, cardId);
    removeCardKeys(answerAutoplayKeys.current, cardId);
  }, []);

  const resetAllAutoplay = useCallback(() => {
    promptAutoplayKeys.current.clear();
    answerAutoplayKeys.current.clear();
  }, []);

  const autoplayAnswerAudioForCard = useCallback(
    (card: StudyCardSummary) => {
      // Keep the media play call inside the reveal tap's call stack. Mobile browsers
      // can ignore or silently stall autoplay if play() is deferred to a microtask.
      playAudioOnce({
        autoplayKeys: answerAutoplayKeys.current,
        cardId: card.id,
        kind: 'answer',
        player: answerAudioRef.current,
        runBackgroundTask,
        url: getStudyCardAudioUrl(card),
      });
    },
    [runBackgroundTask]
  );

  useAudioPrewarm({ cards, ensureAnswerAudioPrepared, focusMode, runBackgroundTask });
  usePromptAudioAutoplay({
    autoplayBlocked,
    autoplayKeys: promptAutoplayKeys.current,
    currentCard,
    focusMode,
    player: promptAudioPlayer,
    revealed,
    runBackgroundTask,
  });
  useAnswerAudioAutoplay({
    autoplayAnswerAudioForCard,
    autoplayBlocked,
    currentCard,
    focusMode,
    revealed,
  });

  return {
    autoplayAnswerAudioForCard,
    promptAudioRef: bindPromptAudioPlayer,
    answerAudioRef,
    resetAllAutoplay,
    resetAutoplayForCard,
    stopAllAudio,
  };
}
