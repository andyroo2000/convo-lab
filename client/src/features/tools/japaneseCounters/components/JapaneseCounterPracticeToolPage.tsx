import { useCallback, useEffect, useRef, useState } from 'react';

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

const JapaneseCounterPracticeToolPage = () => {
  const [selectedCounterIds, setSelectedCounterIds] = useState<CounterId[]>(DEFAULT_COUNTER_IDS);
  const [card, setCard] = useState<CounterPracticeCard>(() =>
    createCounterPracticeCard(DEFAULT_COUNTER_IDS)
  );
  const [isPowerOn, setIsPowerOn] = useState(DEFAULT_AUTO_LOOP_ENABLED);
  const [isRevealed, setIsRevealed] = useState(false);
  const [volumeLevel, setVolumeLevel] = useState<number>(1);
  const [pauseSeconds, setPauseSeconds] = useState<number>(8);
  const [countdownSeconds, setCountdownSeconds] = useState<number | null>(null);
  const [isNextLedActive, setIsNextLedActive] = useState(false);
  const [playbackHint, setPlaybackHint] = useState<string | null>(null);

  const revealTimerRef = useRef<number | null>(null);
  const autoAdvanceTimerRef = useRef<number | null>(null);
  const countdownIntervalRef = useRef<number | null>(null);
  const nextLedTimerRef = useRef<number | null>(null);
  const playbackRef = useRef<ReturnType<typeof playCounterAudioClip> | null>(null);
  const isFirstPowerOnRef = useRef(true);
  const previousCardsRef = useRef<CounterCardSnapshot[]>([]);
  const recentObjectKeysRef = useRef<string[]>([]);

  const statusText = (() => {
    if (!isPowerOn || countdownSeconds === null) return '';
    if (!isRevealed) return `answer in ${countdownSeconds}s`;
    return `next card in ${countdownSeconds}s`;
  })();

  const clearRevealTimer = useCallback(() => {
    if (revealTimerRef.current !== null) {
      window.clearTimeout(revealTimerRef.current);
      revealTimerRef.current = null;
    }
  }, []);

  const clearAutoAdvanceTimer = useCallback(() => {
    if (autoAdvanceTimerRef.current !== null) {
      window.clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }
  }, []);

  const clearCountdownInterval = useCallback(() => {
    if (countdownIntervalRef.current !== null) {
      window.clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
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
      if (!isAbort) {
        setPlaybackHint('Audio playback failed. Tap Show Answer or Next to retry.');
      }
    } finally {
      if (currentPlayback && playbackRef.current === currentPlayback) {
        playbackRef.current = null;
      }
    }
  }, [card.counterId, card.object.id, card.quantity, stopPlayback, volumeLevel]);

  const revealCard = useCallback(() => {
    setIsRevealed(true);
    playCurrentCardAudio().catch(() => {
      setPlaybackHint('Audio playback failed. Tap Show Answer or Next to retry.');
    });
  }, [playCurrentCardAudio]);

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
    stopPlayback();
    setCountdownSeconds(null);

    if (isRevealed) {
      pushCurrentCardToHistory();
      advanceToNextCard();
      return;
    }

    pushCurrentCardToHistory();
    revealCard();
  }, [
    advanceToNextCard,
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
    stopPlayback();
    setIsNextLedActive(false);
    setCountdownSeconds(null);

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

  useEffect(() => {
    clearAutoAdvanceTimer();
    clearRevealTimer();
    clearCountdownInterval();

    if (!isPowerOn) {
      setCountdownSeconds(null);
      return undefined;
    }

    let cancelled = false;

    if (!isRevealed && isFirstPowerOnRef.current) {
      isFirstPowerOnRef.current = false;
      setCountdownSeconds(null);
      revealCard();
      return undefined;
    }

    setCountdownSeconds(pauseSeconds);
    countdownIntervalRef.current = window.setInterval(() => {
      setCountdownSeconds((current) => {
        if (current === null) return null;
        return Math.max(0, current - 1);
      });
    }, 1000);

    if (isRevealed) {
      autoAdvanceTimerRef.current = window.setTimeout(() => {
        setCountdownSeconds(null);
        const finishAdvance = () => {
          if (!cancelled) {
            advanceToNextCard();
          }
        };

        playCurrentCardAudio().then(finishAdvance).catch(finishAdvance);
      }, pauseSeconds * 1000);
    } else {
      revealTimerRef.current = window.setTimeout(() => {
        if (!cancelled) {
          setCountdownSeconds(null);
          revealCard();
        }
      }, pauseSeconds * 1000);
    }

    return () => {
      cancelled = true;
      clearAutoAdvanceTimer();
      clearRevealTimer();
      clearCountdownInterval();
    };
  }, [
    advanceToNextCard,
    card.id,
    clearAutoAdvanceTimer,
    clearCountdownInterval,
    clearRevealTimer,
    isPowerOn,
    isRevealed,
    pauseSeconds,
    playCurrentCardAudio,
    revealCard,
  ]);

  useEffect(() => {
    if (isPowerOn) {
      return undefined;
    }

    clearAutoAdvanceTimer();
    clearCountdownInterval();
    clearRevealTimer();
    stopPlayback();
    setCountdownSeconds(null);

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
    if (selectedCounterIds.includes(card.counterId)) {
      return;
    }

    previousCardsRef.current = [];
    recentObjectKeysRef.current = [];
    setIsRevealed(false);
    setCard(createCounterPracticeCard(selectedCounterIds, recentObjectKeysRef.current));
  }, [card.counterId, selectedCounterIds]);

  const nextButtonLabel = isRevealed ? 'Next' : 'Show Answer';
  const autoPlayButtonLabel = isPowerOn ? 'Stop Loop' : 'Auto-Loop';
  const showFloorStairsCue = card.counterId === 'kai';
  const normalizedCountdownSeconds =
    countdownSeconds === null
      ? pauseSeconds
      : Math.max(0, Math.min(pauseSeconds, countdownSeconds));
  const elapsedCountdownSeconds = Math.max(0, pauseSeconds - normalizedCountdownSeconds);

  return (
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
            <div className="retro-counter-sheet" role="region" aria-label="Counter quiz card">
              <p className="retro-counter-status" aria-live="polite">
                {statusText || '\u00A0'}
              </p>
              <div className="retro-counter-problem-row">
                <p className="retro-counter-problem-qty">{card.quantity} ×</p>
                <div className="retro-counter-illustration-wrap">
                  {showFloorStairsCue && <FloorStairsCue />}
                  <CounterObjectIllustration
                    illustrationId={card.object.illustrationId}
                    className={`retro-counter-illustration illustration-${card.object.illustrationId} ${showFloorStairsCue ? 'has-floor-cue' : ''}`}
                  />
                </div>
              </div>
              <div className="retro-counter-answer-slot">
                {isRevealed && (
                  <>
                    <p className="japanese-text retro-counter-answer" aria-live="polite">
                      <RubyPart script={card.object.script} kana={card.object.kana} showFurigana />
                      <span className="mx-1">{card.particle}</span>
                      <RubyPart script={card.countScript} kana={card.countKana} showFurigana />
                    </p>
                    <p className="retro-counter-gloss">
                      {card.object.englishLabel} uses counter {card.counterSymbol} (
                      {card.counterHint}
                      ).
                    </p>
                  </>
                )}
              </div>
            </div>

            <div className="retro-counter-next-row">
              <span
                className={`retro-clock-radio-led retro-clock-radio-led-next ${isNextLedActive ? 'is-flash' : ''}`}
              />
              <button
                type="button"
                onClick={handleNext}
                className="retro-counter-control-btn retro-counter-next-btn"
                aria-label={isRevealed ? 'Advance to the next item' : 'Show answer'}
              >
                {nextButtonLabel}
              </button>
            </div>
          </div>

          <div className="retro-counter-controls-panel">
            <div className="retro-counter-control-group" role="group" aria-label="Counter pool">
              <span className="retro-counter-control-label">Counter Pool</span>
              <div className="retro-counter-filter-grid">
                {COUNTER_POOL.map((counter) => {
                  const isActive = selectedCounterIds.includes(counter.id);
                  return (
                    <button
                      key={counter.id}
                      type="button"
                      onClick={() => {
                        previousCardsRef.current = [];
                        setSelectedCounterIds((current) =>
                          toggleCounterSelection(current, counter.id)
                        );
                      }}
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

            <div className="retro-counter-control-group" role="group" aria-label="Quiz controls">
              <span className="retro-counter-control-label">Quiz Controls</span>
              <div className="retro-counter-control-buttons">
                <div className="retro-counter-control-stack">
                  <div className="retro-counter-countdown-led-row" aria-hidden="true">
                    {Array.from({ length: pauseSeconds }, (_, index) => {
                      let stateClass = 'is-off';
                      if (isPowerOn) {
                        const indexFromRight = pauseSeconds - 1 - index;
                        stateClass =
                          indexFromRight < elapsedCountdownSeconds ? 'is-red' : 'is-green';
                      }

                      return (
                        <span
                          key={`countdown-led-${pauseSeconds}-${index}`}
                          data-testid="auto-loop-countdown-led"
                          className={`retro-clock-radio-led retro-counter-countdown-led ${stateClass}`}
                        />
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsPowerOn((current) => !current)}
                    className={`retro-counter-control-btn ${isPowerOn ? 'is-active' : ''}`}
                    aria-pressed={isPowerOn}
                  >
                    {autoPlayButtonLabel}
                  </button>
                </div>
              </div>
            </div>

            <div className="retro-counter-control-group" role="group" aria-label="Pause length">
              <span className="retro-counter-control-label">Pause Length (Auto-Loop)</span>
              <div className="retro-counter-pause-grid">
                {PAUSE_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setPauseSeconds(option)}
                    className={`retro-counter-pause-btn ${pauseSeconds === option ? 'is-active' : ''}`}
                    aria-pressed={pauseSeconds === option}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            <div className="retro-counter-control-group" role="group" aria-label="Volume">
              <span className="retro-counter-control-label">Volume</span>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={Math.round(volumeLevel * 100)}
                onChange={(event) => {
                  const nextVolume = Number(event.target.value) / 100;
                  setVolumeLevel(nextVolume);
                  playbackRef.current?.setVolume(nextVolume);
                }}
                className="retro-clock-radio-volume-slider"
                aria-label={`Volume ${Math.round(volumeLevel * 100)} percent`}
              />
            </div>
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
        {playbackHint && <p className="mt-3 text-sm text-[#9e4c2a]">{playbackHint}</p>}
      </section>
    </div>
  );
};

export default JapaneseCounterPracticeToolPage;
