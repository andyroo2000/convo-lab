import { useCallback } from 'react';

import useToolArrowKeyNavigation from '../../hooks/useToolArrowKeyNavigation';
import type { JapaneseDatePlayback } from './useJapaneseDatePlayback';
import type { JapaneseDatePracticeState } from './useJapaneseDatePracticeState';
import { createDateCard } from './useJapaneseDatePracticeState';
import type { JapaneseDateTimers } from './useJapaneseDateTimers';

const HISTORY_LIMIT = 120;

const createRandomDateCard = (minYear: number, maxYear: number) => {
  const year = minYear + Math.floor(Math.random() * (maxYear - minYear + 1));
  const month = Math.floor(Math.random() * 12);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const day = 1 + Math.floor(Math.random() * daysInMonth);
  return createDateCard(new Date(year, month, day));
};

const useDateCardHistory = (state: JapaneseDatePracticeState) => {
  const { card, isRevealed, maxYear, minYear, previousCardsRef, setCard, setIsRevealed } = state;
  const pushCurrentCardToHistory = useCallback(() => {
    previousCardsRef.current.push({ card, isRevealed });
    if (previousCardsRef.current.length > HISTORY_LIMIT) previousCardsRef.current.shift();
  }, [card, isRevealed, previousCardsRef]);
  const advanceToNextCard = useCallback(() => {
    setIsRevealed(false);
    setCard(createRandomDateCard(minYear, maxYear));
  }, [maxYear, minYear, setCard, setIsRevealed]);
  return { advanceToNextCard, pushCurrentCardToHistory };
};

type DateCardHistory = ReturnType<typeof useDateCardHistory>;

const useNextDateNavigation = (
  state: JapaneseDatePracticeState,
  timers: JapaneseDateTimers,
  playback: JapaneseDatePlayback,
  history: DateCardHistory
) => {
  const { isRevealed, nextLedTimerRef, setCountdownSeconds, setIsNextLedActive } = state;
  const { clearAutoAdvanceTimer, clearCountdownInterval, clearNextLedTimer, clearRevealTimer } =
    timers;
  const { revealCard, stopPlayback } = playback;
  const { advanceToNextCard, pushCurrentCardToHistory } = history;
  return useCallback(() => {
    clearNextLedTimer();
    setIsNextLedActive(true);
    nextLedTimerRef.current = window.setTimeout(() => {
      setIsNextLedActive(false);
      nextLedTimerRef.current = null;
    }, 1000);
    clearAutoAdvanceTimer();
    clearRevealTimer();
    clearCountdownInterval();
    setCountdownSeconds(null);
    stopPlayback();
    pushCurrentCardToHistory();
    if (isRevealed) advanceToNextCard();
    else revealCard();
  }, [
    advanceToNextCard,
    clearAutoAdvanceTimer,
    clearCountdownInterval,
    clearNextLedTimer,
    clearRevealTimer,
    isRevealed,
    nextLedTimerRef,
    pushCurrentCardToHistory,
    revealCard,
    setCountdownSeconds,
    setIsNextLedActive,
    stopPlayback,
  ]);
};

const usePreviousDateNavigation = (
  state: JapaneseDatePracticeState,
  timers: JapaneseDateTimers,
  stopPlayback: JapaneseDatePlayback['stopPlayback']
) => {
  const { previousCardsRef, setCard, setCountdownSeconds, setIsNextLedActive, setIsRevealed } =
    state;
  const { clearAutoAdvanceTimer, clearCountdownInterval, clearNextLedTimer, clearRevealTimer } =
    timers;
  return useCallback(() => {
    clearAutoAdvanceTimer();
    clearRevealTimer();
    clearCountdownInterval();
    clearNextLedTimer();
    setIsNextLedActive(false);
    setCountdownSeconds(null);
    stopPlayback();
    const previousCard = previousCardsRef.current.pop();
    if (!previousCard) return;
    setCard(previousCard.card);
    setIsRevealed(previousCard.isRevealed);
  }, [
    clearAutoAdvanceTimer,
    clearCountdownInterval,
    clearNextLedTimer,
    clearRevealTimer,
    previousCardsRef,
    setCard,
    setCountdownSeconds,
    setIsNextLedActive,
    setIsRevealed,
    stopPlayback,
  ]);
};

const useJapaneseDateNavigation = (
  state: JapaneseDatePracticeState,
  timers: JapaneseDateTimers,
  playback: JapaneseDatePlayback
) => {
  const history = useDateCardHistory(state);
  const handleNext = useNextDateNavigation(state, timers, playback, history);
  const handlePrevious = usePreviousDateNavigation(state, timers, playback.stopPlayback);
  useToolArrowKeyNavigation({ onNext: handleNext, onPrevious: handlePrevious });
  return { advanceToNextCard: history.advanceToNextCard, handleNext };
};

export type JapaneseDateNavigation = ReturnType<typeof useJapaneseDateNavigation>;

export default useJapaneseDateNavigation;
