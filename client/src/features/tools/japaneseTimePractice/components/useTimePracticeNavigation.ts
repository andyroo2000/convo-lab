import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from 'react';

import useToolArrowKeyNavigation from '../../hooks/useToolArrowKeyNavigation';
import trackTimePracticeEvent from '../logic/analytics';
import { createRandomTimeCard, type TimePracticeCard } from '../logic/types';

const HISTORY_LIMIT = 120;

interface TimeCardSnapshot {
  card: TimePracticeCard;
  isRevealed: boolean;
}

interface UseTimePracticeNavigationOptions {
  card: TimePracticeCard;
  isRevealed: boolean;
  autoPlayAudio: boolean;
  setCard: Dispatch<SetStateAction<TimePracticeCard>>;
  setIsRevealed: Dispatch<SetStateAction<boolean>>;
  setIsNextLedActive: Dispatch<SetStateAction<boolean>>;
  setCountdownSeconds: Dispatch<SetStateAction<number | null>>;
  clearAutoAdvanceTimer: () => void;
  clearRevealTimer: () => void;
  clearCountdownInterval: () => void;
  stopPlayback: () => void;
  triggerRevealAudioPlayback: () => void;
}

interface NavigationHandlersOptions {
  isRevealed: boolean;
  setIsNextLedActive: Dispatch<SetStateAction<boolean>>;
  clearAutoAdvanceTimer: () => void;
  clearCountdownInterval: () => void;
  clearNextLedTimer: () => void;
  clearRevealTimer: () => void;
  flashNextLed: () => void;
  setCountdownSeconds: Dispatch<SetStateAction<number | null>>;
  stopPlayback: () => void;
  pushCurrentCardToHistory: () => void;
  restorePreviousCard: () => void;
  revealCard: () => void;
  advanceToRandomCard: () => void;
}

const useNextLed = (setIsNextLedActive: Dispatch<SetStateAction<boolean>>) => {
  const nextLedTimerRef = useRef<number | null>(null);

  const clearNextLedTimer = useCallback(() => {
    if (nextLedTimerRef.current !== null) {
      window.clearTimeout(nextLedTimerRef.current);
      nextLedTimerRef.current = null;
    }
  }, []);

  const flashNextLed = useCallback(() => {
    clearNextLedTimer();
    setIsNextLedActive(true);
    nextLedTimerRef.current = window.setTimeout(() => {
      setIsNextLedActive(false);
      nextLedTimerRef.current = null;
    }, 1000);
  }, [clearNextLedTimer, setIsNextLedActive]);

  return { clearNextLedTimer, flashNextLed };
};

const useTimeCardHistory = ({
  card,
  isRevealed,
  setCard,
  setIsRevealed,
}: Pick<UseTimePracticeNavigationOptions, 'card' | 'isRevealed' | 'setCard' | 'setIsRevealed'>) => {
  const previousCardsRef = useRef<TimeCardSnapshot[]>([]);

  const pushCurrentCardToHistory = useCallback(() => {
    previousCardsRef.current.push({ card, isRevealed });
    if (previousCardsRef.current.length > HISTORY_LIMIT) {
      previousCardsRef.current.shift();
    }
  }, [card, isRevealed]);

  const restorePreviousCard = useCallback(() => {
    const previousCard = previousCardsRef.current.pop();
    if (!previousCard) return;
    setCard(previousCard.card);
    setIsRevealed(previousCard.isRevealed);
  }, [setCard, setIsRevealed]);

  return { pushCurrentCardToHistory, restorePreviousCard };
};

const useNavigationHandlers = ({
  advanceToRandomCard,
  clearAutoAdvanceTimer,
  clearCountdownInterval,
  clearNextLedTimer,
  clearRevealTimer,
  flashNextLed,
  isRevealed,
  pushCurrentCardToHistory,
  resetNavigationPlayback,
  restorePreviousCard,
  revealCard,
  setCountdownSeconds,
  setIsNextLedActive,
  stopPlayback,
}: NavigationHandlersOptions & { resetNavigationPlayback: () => void }) => {
  const handleNext = useCallback(() => {
    flashNextLed();
    resetNavigationPlayback();

    if (isRevealed) {
      pushCurrentCardToHistory();
      trackTimePracticeEvent('next_card_manual', 'random');
      advanceToRandomCard();
      return;
    }

    pushCurrentCardToHistory();
    revealCard();
  }, [
    advanceToRandomCard,
    flashNextLed,
    isRevealed,
    pushCurrentCardToHistory,
    resetNavigationPlayback,
    revealCard,
  ]);

  const handlePrevious = useCallback(() => {
    clearAutoAdvanceTimer();
    clearRevealTimer();
    clearCountdownInterval();
    clearNextLedTimer();
    setIsNextLedActive(false);
    setCountdownSeconds(null);
    stopPlayback();
    restorePreviousCard();
  }, [
    clearAutoAdvanceTimer,
    clearCountdownInterval,
    clearNextLedTimer,
    clearRevealTimer,
    restorePreviousCard,
    setCountdownSeconds,
    setIsNextLedActive,
    stopPlayback,
  ]);

  return { handleNext, handlePrevious };
};

const useTimePracticeNavigation = (options: UseTimePracticeNavigationOptions) => {
  const {
    autoPlayAudio,
    clearAutoAdvanceTimer,
    clearCountdownInterval,
    clearRevealTimer,
    isRevealed,
    setCard,
    setCountdownSeconds,
    setIsNextLedActive,
    setIsRevealed,
    stopPlayback,
    triggerRevealAudioPlayback,
  } = options;
  const { clearNextLedTimer, flashNextLed } = useNextLed(setIsNextLedActive);
  const { pushCurrentCardToHistory, restorePreviousCard } = useTimeCardHistory(options);

  const revealCard = useCallback(() => {
    trackTimePracticeEvent('reveal_answer', 'random');
    setIsRevealed(true);
    if (!autoPlayAudio) return;
    triggerRevealAudioPlayback();
  }, [autoPlayAudio, setIsRevealed, triggerRevealAudioPlayback]);

  const advanceToRandomCard = useCallback(() => {
    setIsRevealed(false);
    setCard(createRandomTimeCard());
  }, [setCard, setIsRevealed]);

  const resetNavigationPlayback = useCallback(() => {
    clearAutoAdvanceTimer();
    clearRevealTimer();
    clearCountdownInterval();
    setCountdownSeconds(null);
    stopPlayback();
  }, [
    clearAutoAdvanceTimer,
    clearCountdownInterval,
    clearRevealTimer,
    setCountdownSeconds,
    stopPlayback,
  ]);

  const { handleNext, handlePrevious } = useNavigationHandlers({
    advanceToRandomCard,
    clearAutoAdvanceTimer,
    clearCountdownInterval,
    clearNextLedTimer,
    clearRevealTimer,
    flashNextLed,
    isRevealed,
    pushCurrentCardToHistory,
    resetNavigationPlayback,
    restorePreviousCard,
    revealCard,
    setCountdownSeconds,
    setIsNextLedActive,
    stopPlayback,
  });

  useToolArrowKeyNavigation({
    onNext: handleNext,
    onPrevious: handlePrevious,
  });

  return {
    advanceToRandomCard,
    clearNextLedTimer,
    handleNext,
    revealCard,
  };
};

interface TimePracticeNavigationCleanupOptions {
  isPowerOn: boolean;
  clearAutoAdvanceTimer: () => void;
  clearCountdownInterval: () => void;
  clearNextLedTimer: () => void;
  clearRevealTimer: () => void;
  setCountdownSeconds: Dispatch<SetStateAction<number | null>>;
  stopPlayback: () => void;
}

export const useTimePracticeNavigationCleanup = ({
  isPowerOn,
  clearAutoAdvanceTimer,
  clearCountdownInterval,
  clearNextLedTimer,
  clearRevealTimer,
  setCountdownSeconds,
  stopPlayback,
}: TimePracticeNavigationCleanupOptions) => {
  useEffect(() => {
    if (isPowerOn) return undefined;

    clearAutoAdvanceTimer();
    clearCountdownInterval();
    clearRevealTimer();
    setCountdownSeconds(null);
    stopPlayback();

    return () => {
      clearAutoAdvanceTimer();
      clearCountdownInterval();
      clearRevealTimer();
      clearNextLedTimer();
    };
  }, [
    clearAutoAdvanceTimer,
    clearCountdownInterval,
    clearNextLedTimer,
    clearRevealTimer,
    isPowerOn,
    setCountdownSeconds,
    stopPlayback,
  ]);

  useEffect(
    () => () => {
      clearRevealTimer();
      clearAutoAdvanceTimer();
      clearCountdownInterval();
      clearNextLedTimer();
      stopPlayback();
    },
    [
      clearAutoAdvanceTimer,
      clearCountdownInterval,
      clearNextLedTimer,
      clearRevealTimer,
      stopPlayback,
    ]
  );
};

export default useTimePracticeNavigation;
