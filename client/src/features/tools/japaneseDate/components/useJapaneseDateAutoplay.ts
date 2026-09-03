import { useEffect } from 'react';

import type { JapaneseDateNavigation } from './useJapaneseDateNavigation';
import type { JapaneseDatePlayback } from './useJapaneseDatePlayback';
import type { JapaneseDatePracticeState } from './useJapaneseDatePracticeState';
import type { JapaneseDateTimers } from './useJapaneseDateTimers';

const clearAutoplayTimers = (timers: JapaneseDateTimers) => {
  timers.clearAutoAdvanceTimer();
  timers.clearRevealTimer();
  timers.clearCountdownInterval();
};

const startCountdown = (state: JapaneseDatePracticeState) => {
  const { countdownIntervalRef } = state;
  state.setCountdownSeconds(state.pauseSeconds);
  countdownIntervalRef.current = window.setInterval(() => {
    state.setCountdownSeconds((current) => (current === null ? null : Math.max(0, current - 1)));
  }, 1000);
};

const scheduleAnswerReveal = (
  state: JapaneseDatePracticeState,
  playback: JapaneseDatePlayback,
  isCancelled: () => boolean
) => {
  const { revealTimerRef } = state;
  revealTimerRef.current = window.setTimeout(() => {
    if (isCancelled()) return;
    state.setCountdownSeconds(null);
    playback.revealCard();
  }, state.pauseSeconds * 1000);
};

const scheduleReplayAndAdvance = (
  state: JapaneseDatePracticeState,
  playback: JapaneseDatePlayback,
  navigation: JapaneseDateNavigation,
  isCancelled: () => boolean
) => {
  const { autoAdvanceTimerRef } = state;
  autoAdvanceTimerRef.current = window.setTimeout(() => {
    state.setCountdownSeconds(null);
    const finishAdvance = () => {
      if (!isCancelled()) navigation.advanceToNextCard();
    };
    playback.playCurrentCardAudio().then(finishAdvance).catch(finishAdvance);
  }, state.pauseSeconds * 1000);
};

const useAutoplayCycle = (
  state: JapaneseDatePracticeState,
  timers: JapaneseDateTimers,
  playback: JapaneseDatePlayback,
  navigation: JapaneseDateNavigation
) => {
  useEffect(() => {
    clearAutoplayTimers(timers);
    if (!state.isPowerOn) {
      state.setCountdownSeconds(null);
      return undefined;
    }
    let cancelled = false;
    if (!state.isRevealed && state.isFirstPowerOnRef.current) {
      const { isFirstPowerOnRef } = state;
      isFirstPowerOnRef.current = false;
      state.setCountdownSeconds(null);
      playback.revealCard();
      return undefined;
    }
    startCountdown(state);
    const isCancelled = () => cancelled;
    if (state.isRevealed) scheduleReplayAndAdvance(state, playback, navigation, isCancelled);
    else scheduleAnswerReveal(state, playback, isCancelled);
    return () => {
      cancelled = true;
      clearAutoplayTimers(timers);
    };
    // Aggregate objects are recreated on render; individual lifecycle fields are listed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    navigation.advanceToNextCard,
    playback.playCurrentCardAudio,
    playback.revealCard,
    state.card.id,
    state.isPowerOn,
    state.isRevealed,
    state.pauseSeconds,
    timers.clearAutoAdvanceTimer,
    timers.clearCountdownInterval,
    timers.clearRevealTimer,
  ]);
};

const usePowerOffCleanup = (
  state: JapaneseDatePracticeState,
  timers: JapaneseDateTimers,
  playback: JapaneseDatePlayback
) => {
  useEffect(() => {
    if (state.isPowerOn) return undefined;
    clearAutoplayTimers(timers);
    state.setCountdownSeconds(null);
    playback.stopPlayback();
    return () => {
      clearAutoplayTimers(timers);
      timers.clearNextLedTimer();
    };
    // Aggregate objects are recreated on render; individual lifecycle fields are listed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    playback.stopPlayback,
    state.isPowerOn,
    timers.clearAutoAdvanceTimer,
    timers.clearCountdownInterval,
    timers.clearNextLedTimer,
    timers.clearRevealTimer,
  ]);
};

const useUnmountCleanup = (timers: JapaneseDateTimers, playback: JapaneseDatePlayback) => {
  useEffect(
    () => () => {
      clearAutoplayTimers(timers);
      timers.clearNextLedTimer();
      playback.stopPlayback();
    },
    // Aggregate objects are recreated on render; individual lifecycle fields are listed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      playback.stopPlayback,
      timers.clearAutoAdvanceTimer,
      timers.clearCountdownInterval,
      timers.clearNextLedTimer,
      timers.clearRevealTimer,
    ]
  );
};

const useJapaneseDateAutoplay = (
  state: JapaneseDatePracticeState,
  timers: JapaneseDateTimers,
  playback: JapaneseDatePlayback,
  navigation: JapaneseDateNavigation
) => {
  useAutoplayCycle(state, timers, playback, navigation);
  usePowerOffCleanup(state, timers, playback);
  useUnmountCleanup(timers, playback);
};

export default useJapaneseDateAutoplay;
