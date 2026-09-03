import { useCallback, type MutableRefObject } from 'react';

import type { JapaneseDatePracticeState } from './useJapaneseDatePracticeState';

const clearTimeoutRef = (timerRef: MutableRefObject<number | null>) => {
  const currentTimerRef = timerRef;
  if (currentTimerRef.current === null) return;
  window.clearTimeout(currentTimerRef.current);
  currentTimerRef.current = null;
};

const clearIntervalRef = (timerRef: MutableRefObject<number | null>) => {
  const currentTimerRef = timerRef;
  if (currentTimerRef.current === null) return;
  window.clearInterval(currentTimerRef.current);
  currentTimerRef.current = null;
};

const useJapaneseDateTimers = (state: JapaneseDatePracticeState) => ({
  clearAutoAdvanceTimer: useCallback(
    () => clearTimeoutRef(state.autoAdvanceTimerRef),
    [state.autoAdvanceTimerRef]
  ),
  clearCountdownInterval: useCallback(
    () => clearIntervalRef(state.countdownIntervalRef),
    [state.countdownIntervalRef]
  ),
  clearNextLedTimer: useCallback(
    () => clearTimeoutRef(state.nextLedTimerRef),
    [state.nextLedTimerRef]
  ),
  clearRevealTimer: useCallback(
    () => clearTimeoutRef(state.revealTimerRef),
    [state.revealTimerRef]
  ),
});

export type JapaneseDateTimers = ReturnType<typeof useJapaneseDateTimers>;

export default useJapaneseDateTimers;
