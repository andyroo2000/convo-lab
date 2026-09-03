/* eslint-disable react-hooks/exhaustive-deps -- preserve the existing autoplay lifecycle triggers */
import { useEffect } from 'react';

interface MutableValue<T> {
  current: T;
}

interface TimePracticeAutoPlayOptions {
  cardId: string;
  isPowerOn: boolean;
  isRevealed: boolean;
  pauseSeconds: number;
  autoPlayAudio: boolean;
  isFirstPowerOnRef: MutableValue<boolean>;
  revealTimerRef: MutableValue<number | null>;
  autoAdvanceTimerRef: MutableValue<number | null>;
  countdownIntervalRef: MutableValue<number | null>;
  clearRevealTimer: () => void;
  clearAutoAdvanceTimer: () => void;
  clearCountdownInterval: () => void;
  setCountdownSeconds: (value: number | null | ((current: number | null) => number | null)) => void;
  revealCard: () => void;
  advanceToRandomCard: () => void;
  playCurrentCardAudio: () => Promise<void>;
}

export function clearTimePracticeTimeout(timerId: number | null): null {
  if (timerId !== null) window.clearTimeout(timerId);
  return null;
}

export function clearTimePracticeInterval(timerId: number | null): null {
  if (timerId !== null) window.clearInterval(timerId);
  return null;
}

function startCountdown(options: TimePracticeAutoPlayOptions) {
  const { countdownIntervalRef, pauseSeconds, setCountdownSeconds } = options;
  setCountdownSeconds(pauseSeconds);
  countdownIntervalRef.current = window.setInterval(() => {
    setCountdownSeconds((current) => {
      if (current === null) return null;
      return Math.max(0, current - 1);
    });
  }, 1000);
}

function scheduleCardAdvance(options: TimePracticeAutoPlayOptions, isCancelled: () => boolean) {
  const { autoAdvanceTimerRef } = options;
  autoAdvanceTimerRef.current = window.setTimeout(() => {
    options.setCountdownSeconds(null);
    const finishAdvance = () => {
      if (!isCancelled()) options.advanceToRandomCard();
    };

    if (!options.autoPlayAudio) {
      finishAdvance();
      return;
    }
    options.playCurrentCardAudio().then(finishAdvance).catch(finishAdvance);
  }, options.pauseSeconds * 1000);
}

function scheduleCardReveal(options: TimePracticeAutoPlayOptions, isCancelled: () => boolean) {
  const { revealTimerRef } = options;
  revealTimerRef.current = window.setTimeout(() => {
    if (isCancelled()) return;
    options.setCountdownSeconds(null);
    options.revealCard();
  }, options.pauseSeconds * 1000);
}

export default function useTimePracticeAutoPlay(options: TimePracticeAutoPlayOptions) {
  useEffect(() => {
    options.clearAutoAdvanceTimer();
    options.clearRevealTimer();
    options.clearCountdownInterval();

    if (!options.isPowerOn) {
      options.setCountdownSeconds(null);
      return undefined;
    }

    let cancelled = false;
    if (!options.isRevealed && options.isFirstPowerOnRef.current) {
      const { isFirstPowerOnRef } = options;
      isFirstPowerOnRef.current = false;
      options.setCountdownSeconds(null);
      options.revealCard();
      return undefined;
    }

    startCountdown(options);
    const isCancelled = () => cancelled;
    if (options.isRevealed) {
      scheduleCardAdvance(options, isCancelled);
    } else {
      scheduleCardReveal(options, isCancelled);
    }

    return () => {
      cancelled = true;
      options.clearAutoAdvanceTimer();
      options.clearRevealTimer();
      options.clearCountdownInterval();
    };
  }, [
    options.advanceToRandomCard,
    options.autoPlayAudio,
    options.cardId,
    options.clearAutoAdvanceTimer,
    options.clearCountdownInterval,
    options.clearRevealTimer,
    options.isPowerOn,
    options.isRevealed,
    options.pauseSeconds,
    options.playCurrentCardAudio,
    options.revealCard,
  ]);
}
