import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  generateJapaneseDateTimeReading,
  parseLocalDateTimeInput,
  toLocalDateInputValue,
} from '../../japaneseDate/logic/readingEngine';
import { createInitialFsrsSessionState, type FsrsSessionState } from '../logic/fsrsSession';
import trackTimePracticeEvent from '../logic/analytics';
import { loadTimePracticeLocalState, saveTimePracticeLocalState } from '../logic/localStorageState';
import {
  createRandomTimeCard,
  createTimeCard,
  DEFAULT_TIME_PRACTICE_SETTINGS,
  type TimePracticeCard,
  type TimePracticeSettings,
} from '../logic/types';
import useToolArrowKeyNavigation from '../../hooks/useToolArrowKeyNavigation';
import useTimePracticeAutoPlay, {
  clearTimePracticeInterval,
  clearTimePracticeTimeout,
} from './useTimePracticeAutoPlay';
import TimePracticeClockRadio from './TimePracticeClockRadio';
import useTimePracticeAudio, { getTimePracticeStatusText } from './useTimePracticeAudio';

const toTwoDigits = (value: number) => String(value).padStart(2, '0');
const HISTORY_LIMIT = 120;

interface TimeCardSnapshot {
  card: TimePracticeCard;
  isRevealed: boolean;
}

const createCurrentLocalTimeCard = (): TimePracticeCard => {
  const now = new Date();
  return createTimeCard(now.getHours(), now.getMinutes());
};

const JapaneseTimePracticeToolPage = () => {
  const initialState = useMemo(() => loadTimePracticeLocalState(), []);

  const [card, setCard] = useState<TimePracticeCard>(
    () => initialState?.currentCard ?? createCurrentLocalTimeCard()
  );
  const [settings, setSettings] = useState<TimePracticeSettings>(() => {
    if (!initialState) {
      return DEFAULT_TIME_PRACTICE_SETTINGS;
    }

    return {
      ...initialState.settings,
      revealDelaySeconds: initialState.ui.pauseSeconds,
      showFurigana: true,
      displayMode: 'script',
    };
  });
  const [fsrsState] = useState<FsrsSessionState>(
    () => initialState?.fsrsState ?? createInitialFsrsSessionState()
  );
  const [isPowerOn, setIsPowerOn] = useState(() => initialState?.ui.isPowerOn ?? false);
  const [isRevealed, setIsRevealed] = useState(false);
  const [isNextLedActive, setIsNextLedActive] = useState(false);
  const [countdownSeconds, setCountdownSeconds] = useState<number | null>(null);

  const revealTimerRef = useRef<number | null>(null);
  const autoAdvanceTimerRef = useRef<number | null>(null);
  const countdownIntervalRef = useRef<number | null>(null);
  const nextLedTimerRef = useRef<number | null>(null);
  const isFirstPowerOnRef = useRef(true);
  const previousCardsRef = useRef<TimeCardSnapshot[]>([]);

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
  const localDate = useMemo(() => toLocalDateInputValue(new Date()), []);
  const timeValue = useMemo(
    () => `${toTwoDigits(card.hour24)}:${toTwoDigits(card.minute)}`,
    [card.hour24, card.minute]
  );

  const reading = useMemo(
    () =>
      generateJapaneseDateTimeReading(parseLocalDateTimeInput(localDate, timeValue), {
        hourFormat: '24h',
      }),
    [localDate, timeValue]
  );

  const digitalDisplay = `${toTwoDigits(card.hour24)}:${toTwoDigits(card.minute)}`;
  const shouldShowScript = isRevealed;
  const statusText = getTimePracticeStatusText({
    countdownSeconds,
    isPlaying,
    isPowerOn,
    isRevealed,
  });

  const clearRevealTimer = useCallback(() => {
    revealTimerRef.current = clearTimePracticeTimeout(revealTimerRef.current);
  }, []);

  const clearAutoAdvanceTimer = useCallback(() => {
    autoAdvanceTimerRef.current = clearTimePracticeTimeout(autoAdvanceTimerRef.current);
  }, []);

  const clearCountdownInterval = useCallback(() => {
    countdownIntervalRef.current = clearTimePracticeInterval(countdownIntervalRef.current);
  }, []);

  const clearNextLedTimer = useCallback(() => {
    if (nextLedTimerRef.current !== null) {
      window.clearTimeout(nextLedTimerRef.current);
      nextLedTimerRef.current = null;
    }
  }, []);

  const pushCurrentCardToHistory = useCallback(() => {
    previousCardsRef.current.push({ card, isRevealed });
    if (previousCardsRef.current.length > HISTORY_LIMIT) {
      previousCardsRef.current.shift();
    }
  }, [card, isRevealed]);

  const revealCard = useCallback(() => {
    trackTimePracticeEvent('reveal_answer', 'random');
    setIsRevealed(true);
    if (!settings.autoPlayAudio) {
      return;
    }

    triggerRevealAudioPlayback();
  }, [settings.autoPlayAudio, triggerRevealAudioPlayback]);

  const advanceToRandomCard = useCallback(() => {
    setIsRevealed(false);
    setCard(createRandomTimeCard());
  }, []);

  const handleNext = useCallback(() => {
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
    clearAutoAdvanceTimer,
    clearCountdownInterval,
    clearNextLedTimer,
    clearRevealTimer,
    isRevealed,
    pushCurrentCardToHistory,
    revealCard,
    stopPlayback,
  ]);

  const handlePrevious = useCallback(() => {
    clearAutoAdvanceTimer();
    clearRevealTimer();
    clearCountdownInterval();
    clearNextLedTimer();
    setIsNextLedActive(false);
    setCountdownSeconds(null);
    stopPlayback();

    const previousCard = previousCardsRef.current.pop();
    if (!previousCard) {
      return;
    }

    setCard(previousCard.card);
    setIsRevealed(previousCard.isRevealed);
  }, [
    clearAutoAdvanceTimer,
    clearCountdownInterval,
    clearNextLedTimer,
    clearRevealTimer,
    stopPlayback,
  ]);

  useToolArrowKeyNavigation({
    onNext: handleNext,
    onPrevious: handlePrevious,
  });

  const nextButtonLabel = isRevealed ? 'Next' : 'Show Answer';
  const autoPlayButtonLabel = isPowerOn ? 'Stop' : 'Auto-Play';
  const nextButtonAriaLabel = isRevealed ? 'Advance to the next item' : 'Show answer';

  const handlePowerToggle = useCallback(() => {
    setIsPowerOn((current) => {
      const next = !current;
      trackTimePracticeEvent('autoplay_toggled', 'random', { enabled: next });
      setSettings((currentSettings) => ({
        ...currentSettings,
        randomAutoLoop: next,
      }));
      return next;
    });
  }, []);

  const handlePauseChange = useCallback((seconds: number) => {
    trackTimePracticeEvent('pause_length_changed', 'random', { seconds });
    setSettings((currentSettings) => ({
      ...currentSettings,
      revealDelaySeconds: seconds,
    }));
  }, []);

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

  useEffect(() => {
    if (isPowerOn) {
      return undefined;
    }

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
    <div className="space-y-5">
      <section className="card retro-paper-panel">
        <div className="mb-5 rounded border-2 border-[#0f3561] bg-gradient-to-br from-[#102d57] via-[#143b6f] to-[#184779] px-4 pt-6 pb-7 text-[#f7f6ef] shadow-[0_6px_0_rgba(17,51,92,0.26)] sm:px-5 sm:pt-7 sm:pb-8">
          <p className="pb-3 text-[clamp(1.45rem,1.05rem+1.8vw,2.5rem)] font-semibold leading-[1.05] tracking-[0.04em] text-[#8fd3ea]">
            日本語タイムトレーナー
          </p>
          <p className="retro-headline mt-1 text-[clamp(1.4rem,1rem+1.7vw,2.05rem)] leading-[1.08] text-[#f9f8ed]">
            READ IT.
            <span className="mx-2 text-[#37b4d7]">LISTEN.</span>
            CHECK YOUR ANSWER.
          </p>
          <p className="mt-2 text-sm font-semibold leading-tight text-[#d3ecf4] sm:text-base">
            A time appears first. Say it in Japanese before reveal, then compare with the audio.
          </p>
        </div>

        <TimePracticeClockRadio
          autoPlayButtonLabel={autoPlayButtonLabel}
          digitalDisplay={digitalDisplay}
          isNextLedActive={isNextLedActive}
          isPowerOn={isPowerOn}
          nextButtonAriaLabel={nextButtonAriaLabel}
          nextButtonLabel={nextButtonLabel}
          onNext={handleNext}
          onPauseChange={handlePauseChange}
          onPowerToggle={handlePowerToggle}
          onVolumeChange={handleVolumeChange}
          pauseSeconds={pauseSeconds}
          reading={reading}
          shouldShowScript={shouldShowScript}
          statusText={statusText}
          volumeLevel={volumeLevel}
        />

        <div className="mt-4 rounded border border-[#173b6538] bg-[#edf5f9] px-3 py-3 shadow-[0_3px_0_rgba(17,51,92,0.12)] sm:px-4">
          <ul className="list-disc pl-5 text-sm font-semibold leading-snug text-[#1b3f69] sm:text-[0.96rem]">
            <li>
              Use <span className="retro-caps text-[#15355a]">Show Answer + Next</span> for manual
              practice at your pace.
            </li>
            <li>
              Switch to <span className="retro-caps text-[#15355a]">Auto-Play</span> to get a
              nonstop quiz loop on the selected pause length.
            </li>
          </ul>
        </div>
        {playbackHint && <p className="mt-3 text-sm text-[#9e4c2a]">{playbackHint}</p>}
      </section>
    </div>
  );
};

export default JapaneseTimePracticeToolPage;
