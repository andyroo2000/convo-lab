import { useCallback, useEffect, useRef, useState } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';

import CounterObjectIllustration from './CounterObjectIllustration';
import useToolArrowKeyNavigation from '../../hooks/useToolArrowKeyNavigation';
import { playCounterAudioClip } from '../logic/preRenderedCounterAudio';
import {
  COUNTER_POOL,
  createCounterPracticeCard,
  DEFAULT_COUNTER_IDS,
  toggleCounterSelection,
  type CounterId,
  type CounterPracticeCard,
} from '../logic/counterPractice';

interface RubyPartProps {
  script: string;
  kana: string;
  showFurigana: boolean;
}

const PAUSE_OPTIONS = [5, 8, 12] as const;
const RUBY_RT_CLASS = '!text-[0.34em] sm:!text-[0.27em]';
const DEFAULT_AUTO_LOOP_ENABLED = false;
const HISTORY_LIMIT = 120;
const RECENT_OBJECT_HISTORY_LIMIT = 10;
const KANJI_REGEX = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff々]/u;

interface CounterCardSnapshot {
  card: CounterPracticeCard;
  isRevealed: boolean;
}

const RubyPart = ({ script, kana, showFurigana }: RubyPartProps) => {
  const shouldShowFurigana = showFurigana && KANJI_REGEX.test(script);

  return (
    <ruby className="mr-1">
      {script}
      {shouldShowFurigana ? <rt className={RUBY_RT_CLASS}>{kana}</rt> : null}
    </ruby>
  );
};

const FloorStairsCue = () => (
  <svg
    className="retro-counter-floor-cue"
    viewBox="-5 -10 110 135"
    aria-hidden="true"
    focusable="false"
    data-testid="floor-stairs-cue"
  >
    <path
      d="m52.82 20.996c-0.46094 0.10547-0.81641 0.53125-0.81641 0.99219v7.0156h-5.1719c-0.46094 0.070313-0.85156 0.53125-0.81641 0.99219v7.0156h-5.207c-0.46094 0.070312-0.81641 0.53125-0.81641 0.99219v6.9805h-5.1719c-0.46094 0.10547-0.81641 0.53125-0.81641 1.0273v6.9805h-5.1719c-0.46094 0.10547-0.85156 0.53125-0.81641 0.99219v7.0156h-5.207c-0.46094 0.070312-0.81641 0.53125-0.81641 0.99219v7.0156h-5.1719c-0.46484 0.074219-0.81641 0.53516-0.81641 0.99609v8.0078c0 0.53125 0.46094 0.99219 0.99219 0.99219h66.012c0.53125 0 0.99219-0.46094 0.99219-0.99219v-56.02c-0.003906-0.5-0.46094-0.99609-0.99219-0.99609h-30.191zm3.1875 2.0195h13.996v5.9883h-13.996zm18 0h8.0078v54h-44.008v-6.0234h4.9961c0.53125 0 0.99219-0.46094 0.99219-0.99219v-7.0156h4.9961c0.53125 0 1.0273-0.46094 1.0273-0.99219v-6.9805h4.9961c0.49609 0 0.99219-0.49609 0.99219-1.0273v-6.9805h4.9961c0.53125 0 0.99219-0.49609 0.99219-0.99219v-7.0156h4.9961c0.53125 0 1.0273-0.46094 1.0273-0.99219v-7.0156h4.9961c0.49609 0 0.99219-0.46094 0.99219-0.99219zm-23.988 7.9727h13.996v6.0234h-13.996zm-6.0234 8.0078h13.996v5.9883h-13.996zm-5.9883 8.0078h13.996v5.9883h-13.996zm-5.9883 8.0078h13.996v5.9883h-13.996zm47.871 6.9453c-0.49609 0.070313-0.92188 0.53125-0.88672 1.0273v11.02h-1.9844c-0.53125 0-1.0273 0.46094-1.0273 0.99219s0.49609 1.0273 1.0273 0.99219h2.9766c0.53125 0 0.99219-0.46094 0.99219-0.99219v-12.012c0.035157-0.56641-0.53125-1.0977-1.0977-1.0273zm-53.895 1.0273h13.996v6.0234h-13.996zm-5.9883 8.0078h13.996v6.0234h-13.996z"
      fill="currentColor"
      stroke="none"
    />
  </svg>
);

const buildCardObjectHistoryKey = (card: CounterPracticeCard): string =>
  `${card.counterId}:${card.object.id}`;

const getCounterStatusText = (
  isPowerOn: boolean,
  isRevealed: boolean,
  countdownSeconds: number | null
) => {
  if (!isPowerOn || countdownSeconds === null) return '';
  return isRevealed ? `next card in ${countdownSeconds}s` : `answer in ${countdownSeconds}s`;
};

interface CounterPracticeViewModel {
  autoPlayButtonLabel: string;
  card: CounterPracticeCard;
  elapsedCountdownSeconds: number;
  handleNext: () => void;
  isNextLedActive: boolean;
  isPowerOn: boolean;
  isRevealed: boolean;
  nextButtonLabel: string;
  pauseSeconds: number;
  playbackHint: string | null;
  selectedCounterIds: CounterId[];
  setPauseSeconds: (seconds: number) => void;
  setPowerOn: (enabled: boolean) => void;
  setVolumeLevel: (volume: number) => void;
  statusText: string;
  toggleCounter: (counterId: CounterId) => void;
  volumeLevel: number;
}

const CounterQuizCard = ({ model }: { model: CounterPracticeViewModel }) => {
  const showFloorStairsCue = model.card.counterId === 'kai';
  return (
    <div className="retro-counter-sheet" role="region" aria-label="Counter quiz card">
      <p className="retro-counter-status" aria-live="polite">
        {model.statusText || '\u00A0'}
      </p>
      <div className="retro-counter-problem-row">
        <p className="retro-counter-problem-qty">{model.card.quantity} ×</p>
        <div className="retro-counter-illustration-wrap">
          {showFloorStairsCue && <FloorStairsCue />}
          <CounterObjectIllustration
            illustrationId={model.card.object.illustrationId}
            className={`retro-counter-illustration illustration-${model.card.object.illustrationId} ${showFloorStairsCue ? 'has-floor-cue' : ''}`}
          />
        </div>
      </div>
      <div className="retro-counter-answer-slot">
        {model.isRevealed && (
          <>
            <p className="japanese-text retro-counter-answer" aria-live="polite">
              <RubyPart
                script={model.card.object.script}
                kana={model.card.object.kana}
                showFurigana
              />
              <span className="mx-1">{model.card.particle}</span>
              <RubyPart script={model.card.countScript} kana={model.card.countKana} showFurigana />
            </p>
            <p className="retro-counter-gloss">
              {model.card.object.englishLabel} uses counter {model.card.counterSymbol} (
              {model.card.counterHint}).
            </p>
          </>
        )}
      </div>
    </div>
  );
};

const CounterNextControl = ({ model }: { model: CounterPracticeViewModel }) => (
  <div className="retro-counter-next-row">
    <span
      className={`retro-clock-radio-led retro-clock-radio-led-next ${model.isNextLedActive ? 'is-flash' : ''}`}
    />
    <button
      type="button"
      onClick={model.handleNext}
      className="retro-counter-control-btn retro-counter-next-btn"
      aria-label={model.isRevealed ? 'Advance to the next item' : 'Show answer'}
    >
      {model.nextButtonLabel}
    </button>
  </div>
);

const CounterPoolControls = ({ model }: { model: CounterPracticeViewModel }) => (
  <div className="retro-counter-control-group" role="group" aria-label="Counter pool">
    <span className="retro-counter-control-label">Counter Pool</span>
    <div className="retro-counter-filter-grid">
      {COUNTER_POOL.map((counter) => {
        const isActive = model.selectedCounterIds.includes(counter.id);
        return (
          <button
            key={counter.id}
            type="button"
            onClick={() => model.toggleCounter(counter.id)}
            className={`retro-counter-filter-btn ${isActive ? 'is-active' : ''}`}
            aria-pressed={isActive}
          >
            <span className="retro-counter-filter-symbol">{counter.symbol}</span>
            <span className="retro-counter-filter-copy">{counter.hint}</span>
          </button>
        );
      })}
    </div>
  </div>
);

const getCountdownLedState = (isPowerOn: boolean, elapsed: boolean) => {
  if (!isPowerOn) return 'is-off';
  return elapsed ? 'is-red' : 'is-green';
};

const CountdownLeds = ({ model }: { model: CounterPracticeViewModel }) => (
  <div className="retro-counter-countdown-led-row" aria-hidden="true">
    {Array.from({ length: model.pauseSeconds }, (_, index) => {
      const indexFromRight = model.pauseSeconds - 1 - index;
      const elapsed = indexFromRight < model.elapsedCountdownSeconds;
      const stateClass = getCountdownLedState(model.isPowerOn, elapsed);
      return (
        <span
          key={`countdown-led-${model.pauseSeconds}-${index}`}
          data-testid="auto-loop-countdown-led"
          className={`retro-clock-radio-led retro-counter-countdown-led ${stateClass}`}
        />
      );
    })}
  </div>
);

const AutoLoopControls = ({ model }: { model: CounterPracticeViewModel }) => (
  <div className="retro-counter-control-group" role="group" aria-label="Quiz controls">
    <span className="retro-counter-control-label">Quiz Controls</span>
    <div className="retro-counter-control-buttons">
      <div className="retro-counter-control-stack">
        <CountdownLeds model={model} />
        <button
          type="button"
          onClick={() => model.setPowerOn(!model.isPowerOn)}
          className={`retro-counter-control-btn ${model.isPowerOn ? 'is-active' : ''}`}
          aria-pressed={model.isPowerOn}
        >
          {model.autoPlayButtonLabel}
        </button>
      </div>
    </div>
  </div>
);

const PauseControls = ({ model }: { model: CounterPracticeViewModel }) => (
  <div className="retro-counter-control-group" role="group" aria-label="Pause length">
    <span className="retro-counter-control-label">Pause Length (Auto-Loop)</span>
    <div className="retro-counter-pause-grid">
      {PAUSE_OPTIONS.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => model.setPauseSeconds(option)}
          className={`retro-counter-pause-btn ${model.pauseSeconds === option ? 'is-active' : ''}`}
          aria-pressed={model.pauseSeconds === option}
        >
          {option}
        </button>
      ))}
    </div>
  </div>
);

const VolumeControl = ({ model }: { model: CounterPracticeViewModel }) => (
  <div className="retro-counter-control-group" role="group" aria-label="Volume">
    <span className="retro-counter-control-label">Volume</span>
    <input
      type="range"
      min={0}
      max={100}
      step={1}
      value={Math.round(model.volumeLevel * 100)}
      onChange={(event) => model.setVolumeLevel(Number(event.target.value) / 100)}
      className="retro-clock-radio-volume-slider"
      aria-label={`Volume ${Math.round(model.volumeLevel * 100)} percent`}
    />
  </div>
);

const CounterPracticeView = ({ model }: { model: CounterPracticeViewModel }) => (
  <div className="space-y-5">
    <section className="card retro-paper-panel !p-3 sm:!p-5 lg:!p-6">
      <div className="mb-5 rounded border-2 border-[#0f3561] bg-gradient-to-br from-[#102d57] via-[#143b6f] to-[#184779] px-4 pt-6 pb-7 text-[#f7f6ef] shadow-[0_6px_0_rgba(17,51,92,0.26)] sm:px-5 sm:pt-7 sm:pb-8">
        <p className="pb-3 text-[clamp(1.1rem,0.95rem+1.8vw,2.5rem)] font-semibold leading-[1.05] tracking-[0.04em] text-[#8fd3ea]">
          日本語カウンタートレーナー
        </p>
        <p className="retro-headline mt-1 text-[clamp(1.25rem,0.95rem+1.7vw,2.05rem)] leading-[1.08] text-[#f9f8ed]">
          Japanese Counter Practice Tool
        </p>
        <p className="mt-2 text-[0.79rem] font-semibold leading-tight text-[#d3ecf4] sm:text-base">
          Read the image, pick the right counter, then check the answer.
        </p>
      </div>
      <div className="retro-counter-layout">
        <div className="retro-counter-main-panel">
          <CounterQuizCard model={model} />
          <CounterNextControl model={model} />
        </div>
        <div className="retro-counter-controls-panel">
          <CounterPoolControls model={model} />
          <AutoLoopControls model={model} />
          <PauseControls model={model} />
          <VolumeControl model={model} />
        </div>
      </div>
      <div className="mt-4 rounded border border-[#173b6538] bg-[#edf5f9] px-3 py-3 shadow-[0_3px_0_rgba(17,51,92,0.12)] sm:px-4">
        <ul className="list-disc pl-5 text-sm font-semibold leading-snug text-[#1b3f69] sm:text-[0.96rem]">
          <li>
            Use <span className="retro-caps text-[#15355a]">Show Answer + Next</span> for manual
            practice.
          </li>
          <li>
            Use <span className="retro-caps text-[#15355a]">Auto-Loop</span> for continuous random
            drills.
          </li>
        </ul>
      </div>
      {model.playbackHint && <p className="mt-3 text-sm text-[#9e4c2a]">{model.playbackHint}</p>}
    </section>
  </div>
);

const clearScheduledRef = (timerId: number | null, clearScheduled: (timerId: number) => void) => {
  if (timerId !== null) clearScheduled(timerId);
};

const useCounterTimers = () => {
  const revealTimerRef = useRef<number | null>(null);
  const autoAdvanceTimerRef = useRef<number | null>(null);
  const countdownIntervalRef = useRef<number | null>(null);
  const nextLedTimerRef = useRef<number | null>(null);
  const clearRevealTimer = useCallback(() => {
    clearScheduledRef(revealTimerRef.current, window.clearTimeout);
    revealTimerRef.current = null;
  }, []);
  const clearAutoAdvanceTimer = useCallback(() => {
    clearScheduledRef(autoAdvanceTimerRef.current, window.clearTimeout);
    autoAdvanceTimerRef.current = null;
  }, []);
  const clearCountdownInterval = useCallback(() => {
    clearScheduledRef(countdownIntervalRef.current, window.clearInterval);
    countdownIntervalRef.current = null;
  }, []);
  const clearNextLedTimer = useCallback(() => {
    clearScheduledRef(nextLedTimerRef.current, window.clearTimeout);
    nextLedTimerRef.current = null;
  }, []);
  return {
    autoAdvanceTimerRef,
    clearAutoAdvanceTimer,
    clearCountdownInterval,
    clearNextLedTimer,
    clearRevealTimer,
    countdownIntervalRef,
    nextLedTimerRef,
    revealTimerRef,
  };
};

const useCounterPlayback = (card: CounterPracticeCard, volumeLevel: number) => {
  const [playbackHint, setPlaybackHint] = useState<string | null>(null);
  const playbackRef = useRef<ReturnType<typeof playCounterAudioClip> | null>(null);
  const stopPlayback = useCallback(() => {
    playbackRef.current?.stop();
    playbackRef.current = null;
  }, []);
  const playCurrentCardAudio = useCallback(async () => {
    stopPlayback();
    let currentPlayback: ReturnType<typeof playCounterAudioClip> | null = null;
    try {
      const audioCard = {
        counterId: card.counterId,
        quantity: card.quantity,
        object: { id: card.object.id },
      };
      const playback = playCounterAudioClip(audioCard, { volume: volumeLevel });
      currentPlayback = playback;
      playbackRef.current = playback;
      setPlaybackHint(null);
      await playback.finished;
    } catch (error) {
      const isAbort = error instanceof DOMException && error.name === 'AbortError';
      if (!isAbort) setPlaybackHint('Audio playback failed. Tap Show Answer or Next to retry.');
    } finally {
      if (currentPlayback && playbackRef.current === currentPlayback) playbackRef.current = null;
    }
  }, [card.counterId, card.object.id, card.quantity, stopPlayback, volumeLevel]);
  const triggerRevealAudioPlayback = useCallback(() => {
    playCurrentCardAudio().catch((error) => {
      console.warn('[Counter Tool] Unexpected reveal audio rejection:', error);
      setPlaybackHint('Audio playback failed. Tap Show Answer or Next to retry.');
    });
  }, [playCurrentCardAudio]);
  const updatePlaybackVolume = (nextVolume: number) => playbackRef.current?.setVolume(nextVolume);
  return {
    playbackHint,
    playCurrentCardAudio,
    stopPlayback,
    triggerRevealAudioPlayback,
    updatePlaybackVolume,
  };
};

const useCounterCardDeck = () => {
  const [selectedCounterIds, setSelectedCounterIds] = useState<CounterId[]>(DEFAULT_COUNTER_IDS);
  const [card, setCard] = useState<CounterPracticeCard>(() =>
    createCounterPracticeCard(DEFAULT_COUNTER_IDS)
  );
  const [isRevealed, setIsRevealed] = useState(false);
  const previousCardsRef = useRef<CounterCardSnapshot[]>([]);
  const recentObjectKeysRef = useRef<string[]>([]);

  const pushCurrentCardToHistory = useCallback(() => {
    previousCardsRef.current.push({ card, isRevealed });
    if (previousCardsRef.current.length > HISTORY_LIMIT) previousCardsRef.current.shift();
  }, [card, isRevealed]);
  const rememberCardObject = useCallback((currentCard: CounterPracticeCard): string[] => {
    const key = buildCardObjectHistoryKey(currentCard);
    const dedupedKeys = [key, ...recentObjectKeysRef.current.filter((entry) => entry !== key)];
    recentObjectKeysRef.current = dedupedKeys.slice(0, RECENT_OBJECT_HISTORY_LIMIT);
    return recentObjectKeysRef.current;
  }, []);
  const advanceToNextCard = useCallback(() => {
    setIsRevealed(false);
    const recentObjectKeys = rememberCardObject(card);
    setCard(createCounterPracticeCard(selectedCounterIds, recentObjectKeys));
  }, [card, rememberCardObject, selectedCounterIds]);
  const restorePreviousCard = useCallback(() => {
    const previousCard = previousCardsRef.current.pop();
    if (!previousCard) return;
    setCard(previousCard.card);
    setIsRevealed(previousCard.isRevealed);
  }, []);
  const toggleCounter = (counterId: CounterId) => {
    previousCardsRef.current = [];
    setSelectedCounterIds((current) => toggleCounterSelection(current, counterId));
  };

  useEffect(() => {
    if (selectedCounterIds.includes(card.counterId)) return;
    previousCardsRef.current = [];
    recentObjectKeysRef.current = [];
    setIsRevealed(false);
    setCard(createCounterPracticeCard(selectedCounterIds, recentObjectKeysRef.current));
  }, [card.counterId, selectedCounterIds]);

  return {
    advanceToNextCard,
    card,
    isRevealed,
    pushCurrentCardToHistory,
    restorePreviousCard,
    selectedCounterIds,
    setIsRevealed,
    toggleCounter,
  };
};

interface CounterNavigationOptions {
  advanceToNextCard: () => void;
  clearAutoAdvanceTimer: () => void;
  clearCountdownInterval: () => void;
  clearNextLedTimer: () => void;
  clearRevealTimer: () => void;
  isRevealed: boolean;
  nextLedTimerRef: MutableRefObject<number | null>;
  pushCurrentCardToHistory: () => void;
  restorePreviousCard: () => void;
  revealCard: () => void;
  setCountdownSeconds: Dispatch<SetStateAction<number | null>>;
  stopPlayback: () => void;
}

const useCounterNavigation = (options: CounterNavigationOptions) => {
  const [isNextLedActive, setIsNextLedActive] = useState(false);
  const {
    advanceToNextCard,
    clearAutoAdvanceTimer,
    clearCountdownInterval,
    clearNextLedTimer,
    clearRevealTimer,
    isRevealed,
    nextLedTimerRef,
    pushCurrentCardToHistory,
    restorePreviousCard,
    revealCard,
    setCountdownSeconds,
    stopPlayback,
  } = options;
  const clearActivePlayback = useCallback(() => {
    clearAutoAdvanceTimer();
    clearRevealTimer();
    clearCountdownInterval();
    stopPlayback();
    setCountdownSeconds(null);
  }, [
    clearAutoAdvanceTimer,
    clearCountdownInterval,
    clearRevealTimer,
    setCountdownSeconds,
    stopPlayback,
  ]);
  const handleNext = useCallback(() => {
    clearNextLedTimer();
    setIsNextLedActive(true);
    nextLedTimerRef.current = window.setTimeout(() => {
      setIsNextLedActive(false);
      nextLedTimerRef.current = null;
    }, 1000);
    clearActivePlayback();
    pushCurrentCardToHistory();
    if (isRevealed) advanceToNextCard();
    else revealCard();
  }, [
    advanceToNextCard,
    clearActivePlayback,
    clearNextLedTimer,
    isRevealed,
    nextLedTimerRef,
    pushCurrentCardToHistory,
    revealCard,
  ]);
  const handlePrevious = useCallback(() => {
    clearActivePlayback();
    clearNextLedTimer();
    setIsNextLedActive(false);
    restorePreviousCard();
  }, [clearActivePlayback, clearNextLedTimer, restorePreviousCard]);
  useToolArrowKeyNavigation({ onNext: handleNext, onPrevious: handlePrevious });
  return { handleNext, isNextLedActive, setIsNextLedActive };
};

interface CounterAutoLoopOptions {
  advanceToNextCard: () => void;
  autoAdvanceTimerRef: MutableRefObject<number | null>;
  cardId: string;
  clearAutoAdvanceTimer: () => void;
  clearCountdownInterval: () => void;
  clearNextLedTimer: () => void;
  clearRevealTimer: () => void;
  countdownIntervalRef: MutableRefObject<number | null>;
  isFirstPowerOnRef: MutableRefObject<boolean>;
  isPowerOn: boolean;
  isRevealed: boolean;
  pauseSeconds: number;
  playCurrentCardAudio: () => Promise<void>;
  revealCard: () => void;
  revealTimerRef: MutableRefObject<number | null>;
  setCountdownSeconds: Dispatch<SetStateAction<number | null>>;
  setIsNextLedActive: (active: boolean) => void;
  stopPlayback: () => void;
  wasPowerOnRef: MutableRefObject<boolean>;
}

const handlePoweredOffLoop = (options: CounterAutoLoopOptions, wasPowerOn: boolean) => {
  if (options.isPowerOn) return false;
  if (wasPowerOn) {
    options.clearNextLedTimer();
    options.stopPlayback();
    options.setIsNextLedActive(false);
  }
  options.setCountdownSeconds(null);
  return true;
};

const revealFirstAutoLoopCard = (options: CounterAutoLoopOptions) => {
  const { isFirstPowerOnRef } = options;
  if (options.isRevealed || !isFirstPowerOnRef.current) return false;
  isFirstPowerOnRef.current = false;
  options.setCountdownSeconds(null);
  options.revealCard();
  return true;
};

const scheduleCounterLoopStep = (options: CounterAutoLoopOptions, isCancelled: () => boolean) => {
  const { autoAdvanceTimerRef, revealTimerRef } = options;
  if (options.isRevealed) {
    autoAdvanceTimerRef.current = window.setTimeout(() => {
      options.setCountdownSeconds(null);
      const finishAdvance = () => {
        if (!isCancelled()) options.advanceToNextCard();
      };
      options.playCurrentCardAudio().then(finishAdvance).catch(finishAdvance);
    }, options.pauseSeconds * 1000);
    return;
  }
  revealTimerRef.current = window.setTimeout(() => {
    if (!isCancelled()) {
      options.setCountdownSeconds(null);
      options.revealCard();
    }
  }, options.pauseSeconds * 1000);
};

const useCounterAutoLoop = (options: CounterAutoLoopOptions) => {
  const {
    advanceToNextCard,
    autoAdvanceTimerRef,
    cardId,
    clearAutoAdvanceTimer,
    clearCountdownInterval,
    clearNextLedTimer,
    clearRevealTimer,
    countdownIntervalRef,
    isFirstPowerOnRef,
    isPowerOn,
    isRevealed,
    pauseSeconds,
    playCurrentCardAudio,
    revealCard,
    revealTimerRef,
    setCountdownSeconds,
    setIsNextLedActive,
    stopPlayback,
    wasPowerOnRef,
  } = options;

  useEffect(() => {
    const effectOptions: CounterAutoLoopOptions = {
      advanceToNextCard,
      autoAdvanceTimerRef,
      cardId,
      clearAutoAdvanceTimer,
      clearCountdownInterval,
      clearNextLedTimer,
      clearRevealTimer,
      countdownIntervalRef,
      isFirstPowerOnRef,
      isPowerOn,
      isRevealed,
      pauseSeconds,
      playCurrentCardAudio,
      revealCard,
      revealTimerRef,
      setCountdownSeconds,
      setIsNextLedActive,
      stopPlayback,
      wasPowerOnRef,
    };
    const wasPowerOn = wasPowerOnRef.current;
    wasPowerOnRef.current = isPowerOn;
    clearAutoAdvanceTimer();
    clearRevealTimer();
    clearCountdownInterval();

    if (handlePoweredOffLoop(effectOptions, wasPowerOn)) return undefined;

    let cancelled = false;
    if (revealFirstAutoLoopCard(effectOptions)) return undefined;

    setCountdownSeconds(pauseSeconds);
    countdownIntervalRef.current = window.setInterval(() => {
      setCountdownSeconds((current) => (current === null ? null : Math.max(0, current - 1)));
    }, 1000);

    scheduleCounterLoopStep(effectOptions, () => cancelled);

    return () => {
      cancelled = true;
      clearAutoAdvanceTimer();
      clearRevealTimer();
      clearCountdownInterval();
    };
  }, [
    advanceToNextCard,
    autoAdvanceTimerRef,
    cardId,
    clearAutoAdvanceTimer,
    clearCountdownInterval,
    clearNextLedTimer,
    clearRevealTimer,
    countdownIntervalRef,
    isFirstPowerOnRef,
    isPowerOn,
    isRevealed,
    pauseSeconds,
    playCurrentCardAudio,
    revealCard,
    revealTimerRef,
    setCountdownSeconds,
    setIsNextLedActive,
    stopPlayback,
    wasPowerOnRef,
  ]);
};

type CounterCleanupOptions = Pick<
  CounterAutoLoopOptions,
  | 'clearAutoAdvanceTimer'
  | 'clearCountdownInterval'
  | 'clearNextLedTimer'
  | 'clearRevealTimer'
  | 'stopPlayback'
>;

const useCounterCleanup = (options: CounterCleanupOptions) => {
  const {
    clearAutoAdvanceTimer,
    clearCountdownInterval,
    clearNextLedTimer,
    clearRevealTimer,
    stopPlayback,
  } = options;
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

type CounterViewInputs = Omit<
  CounterPracticeViewModel,
  'autoPlayButtonLabel' | 'elapsedCountdownSeconds' | 'nextButtonLabel' | 'statusText'
> & { countdownSeconds: number | null };

const buildCounterViewModel = (inputs: CounterViewInputs): CounterPracticeViewModel => {
  const { countdownSeconds, ...viewInputs } = inputs;
  const normalizedCountdownSeconds =
    countdownSeconds === null
      ? viewInputs.pauseSeconds
      : Math.max(0, Math.min(viewInputs.pauseSeconds, countdownSeconds));
  return {
    ...viewInputs,
    autoPlayButtonLabel: viewInputs.isPowerOn ? 'Stop Loop' : 'Auto-Loop',
    elapsedCountdownSeconds: Math.max(0, viewInputs.pauseSeconds - normalizedCountdownSeconds),
    nextButtonLabel: viewInputs.isRevealed ? 'Next' : 'Show Answer',
    statusText: getCounterStatusText(viewInputs.isPowerOn, viewInputs.isRevealed, countdownSeconds),
  };
};

const JapaneseCounterPracticeToolPage = () => {
  const [isPowerOn, setIsPowerOn] = useState(DEFAULT_AUTO_LOOP_ENABLED);
  const [volumeLevel, setVolumeLevel] = useState<number>(1);
  const [pauseSeconds, setPauseSeconds] = useState<number>(8);
  const [countdownSeconds, setCountdownSeconds] = useState<number | null>(null);
  const {
    advanceToNextCard,
    card,
    isRevealed,
    pushCurrentCardToHistory,
    restorePreviousCard,
    selectedCounterIds,
    setIsRevealed,
    toggleCounter,
  } = useCounterCardDeck();
  const {
    autoAdvanceTimerRef,
    clearAutoAdvanceTimer,
    clearCountdownInterval,
    clearNextLedTimer,
    clearRevealTimer,
    countdownIntervalRef,
    nextLedTimerRef,
    revealTimerRef,
  } = useCounterTimers();
  const isFirstPowerOnRef = useRef(true);
  const wasPowerOnRef = useRef(isPowerOn);

  const {
    playbackHint,
    playCurrentCardAudio,
    stopPlayback,
    triggerRevealAudioPlayback,
    updatePlaybackVolume,
  } = useCounterPlayback(card, volumeLevel);

  const revealCard = useCallback(() => {
    setIsRevealed(true);
    triggerRevealAudioPlayback();
  }, [setIsRevealed, triggerRevealAudioPlayback]);

  const { handleNext, isNextLedActive, setIsNextLedActive } = useCounterNavigation({
    advanceToNextCard,
    clearAutoAdvanceTimer,
    clearCountdownInterval,
    clearNextLedTimer,
    clearRevealTimer,
    isRevealed,
    nextLedTimerRef,
    pushCurrentCardToHistory,
    restorePreviousCard,
    revealCard,
    setCountdownSeconds,
    stopPlayback,
  });

  useCounterAutoLoop({
    advanceToNextCard,
    autoAdvanceTimerRef,
    cardId: card.id,
    clearAutoAdvanceTimer,
    clearCountdownInterval,
    clearNextLedTimer,
    clearRevealTimer,
    countdownIntervalRef,
    isFirstPowerOnRef,
    isPowerOn,
    isRevealed,
    pauseSeconds,
    playCurrentCardAudio,
    revealCard,
    revealTimerRef,
    setCountdownSeconds,
    setIsNextLedActive,
    stopPlayback,
    wasPowerOnRef,
  });

  useCounterCleanup({
    clearAutoAdvanceTimer,
    clearCountdownInterval,
    clearNextLedTimer,
    clearRevealTimer,
    stopPlayback,
  });
  const updateVolume = (nextVolume: number) => {
    setVolumeLevel(nextVolume);
    updatePlaybackVolume(nextVolume);
  };

  return (
    <CounterPracticeView
      model={buildCounterViewModel({
        card,
        countdownSeconds,
        handleNext,
        isNextLedActive,
        isPowerOn,
        isRevealed,
        pauseSeconds,
        playbackHint,
        selectedCounterIds,
        setPauseSeconds,
        setPowerOn: setIsPowerOn,
        setVolumeLevel: updateVolume,
        toggleCounter,
        volumeLevel,
      })}
    />
  );
};

export default JapaneseCounterPracticeToolPage;
