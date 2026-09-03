import { useCallback, useEffect, useRef, useState } from 'react';

import trackTimePracticeEvent from '../logic/analytics';
import { saveTimePracticeLocalState } from '../logic/localStorageState';
import useTimePracticeAutoPlay, {
  clearTimePracticeInterval,
  clearTimePracticeTimeout,
} from './useTimePracticeAutoPlay';
import useTimePracticeAudio from './useTimePracticeAudio';
import TimePracticePanel from './TimePracticePanel';
import useTimePracticeNavigation, {
  useTimePracticeNavigationCleanup,
} from './useTimePracticeNavigation';
import useTimePracticeState from './useTimePracticeState';

const JapaneseTimePracticeToolPage = () => {
  const {
    card,
    fsrsState,
    handlePauseChange,
    handlePowerToggle,
    initialState,
    isPowerOn,
    settings,
    setCard,
  } = useTimePracticeState();
  const [isRevealed, setIsRevealed] = useState(false);
  const [isNextLedActive, setIsNextLedActive] = useState(false);
  const [countdownSeconds, setCountdownSeconds] = useState<number | null>(null);

  const revealTimerRef = useRef<number | null>(null);
  const autoAdvanceTimerRef = useRef<number | null>(null);
  const countdownIntervalRef = useRef<number | null>(null);
  const isFirstPowerOnRef = useRef(true);

  const {
    handleVolumeChange,
    isPlaying,
    playbackHint,
    playCurrentCardAudio,
    stopPlayback,
    triggerRevealAudioPlayback,
    volumeLevel,
  } = useTimePracticeAudio(card, initialState?.ui.volumeLevel ?? 1);

  const pauseSeconds = settings.revealDelaySeconds;
  const clearRevealTimer = useCallback(() => {
    revealTimerRef.current = clearTimePracticeTimeout(revealTimerRef.current);
  }, []);

  const clearAutoAdvanceTimer = useCallback(() => {
    autoAdvanceTimerRef.current = clearTimePracticeTimeout(autoAdvanceTimerRef.current);
  }, []);

  const clearCountdownInterval = useCallback(() => {
    countdownIntervalRef.current = clearTimePracticeInterval(countdownIntervalRef.current);
  }, []);

  const { advanceToRandomCard, clearNextLedTimer, handleNext, revealCard } =
    useTimePracticeNavigation({
      card,
      isRevealed,
      autoPlayAudio: settings.autoPlayAudio,
      setCard,
      setIsRevealed,
      setIsNextLedActive,
      setCountdownSeconds,
      clearAutoAdvanceTimer,
      clearRevealTimer,
      clearCountdownInterval,
      stopPlayback,
      triggerRevealAudioPlayback,
    });

  useTimePracticeAutoPlay({
    cardId: card.id,
    isPowerOn,
    isRevealed,
    pauseSeconds,
    autoPlayAudio: settings.autoPlayAudio,
    isFirstPowerOnRef,
    revealTimerRef,
    autoAdvanceTimerRef,
    countdownIntervalRef,
    clearRevealTimer,
    clearAutoAdvanceTimer,
    clearCountdownInterval,
    setCountdownSeconds,
    revealCard,
    advanceToRandomCard,
    playCurrentCardAudio,
  });

  useTimePracticeNavigationCleanup({
    isPowerOn,
    clearAutoAdvanceTimer,
    clearCountdownInterval,
    clearNextLedTimer,
    clearRevealTimer,
    setCountdownSeconds,
    stopPlayback,
  });

  useEffect(() => {
    trackTimePracticeEvent('view_loaded', 'random');
  }, []);

  useEffect(() => {
    saveTimePracticeLocalState({
      mode: 'random',
      currentCard: card,
      fsrsState,
      settings,
      ui: {
        pauseSeconds,
        volumeLevel,
        isPowerOn,
      },
    });
  }, [card, fsrsState, isPowerOn, pauseSeconds, settings, volumeLevel]);

  return (
    <TimePracticePanel
      card={card}
      countdownSeconds={countdownSeconds}
      isNextLedActive={isNextLedActive}
      isPlaying={isPlaying}
      isPowerOn={isPowerOn}
      isRevealed={isRevealed}
      pauseSeconds={pauseSeconds}
      playbackHint={playbackHint}
      volumeLevel={volumeLevel}
      onNext={handleNext}
      onPauseChange={handlePauseChange}
      onPowerToggle={handlePowerToggle}
      onVolumeChange={handleVolumeChange}
    />
  );
};

export default JapaneseTimePracticeToolPage;
