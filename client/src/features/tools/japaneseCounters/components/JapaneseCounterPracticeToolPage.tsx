import { useCallback, useEffect, useRef, useState } from 'react';

import CounterObjectIllustration from './CounterObjectIllustration';
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

const RubyPart = ({ script, kana, showFurigana }: RubyPartProps) => (
  <ruby className="mr-1">
    {script}
    <rt className={`${RUBY_RT_CLASS} ${showFurigana ? '' : 'invisible'}`}>{kana}</rt>
  </ruby>
);

const JapaneseCounterPracticeToolPage = () => {
  const [selectedCounterIds, setSelectedCounterIds] = useState<CounterId[]>(DEFAULT_COUNTER_IDS);
  const [card, setCard] = useState<CounterPracticeCard>(() =>
    createCounterPracticeCard(DEFAULT_COUNTER_IDS)
  );
  const [isPowerOn, setIsPowerOn] = useState(false);
  const [isRevealed, setIsRevealed] = useState(false);
  const [pauseSeconds, setPauseSeconds] = useState<number>(8);
  const [countdownSeconds, setCountdownSeconds] = useState<number | null>(null);
  const [isNextLedActive, setIsNextLedActive] = useState(false);

  const revealTimerRef = useRef<number | null>(null);
  const autoAdvanceTimerRef = useRef<number | null>(null);
  const countdownIntervalRef = useRef<number | null>(null);
  const nextLedTimerRef = useRef<number | null>(null);
  const isFirstPowerOnRef = useRef(true);

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

  const revealCard = useCallback(() => {
    setIsRevealed(true);
  }, []);

  const advanceToNextCard = useCallback(() => {
    setIsRevealed(false);
    setCard(createCounterPracticeCard(selectedCounterIds));
  }, [selectedCounterIds]);

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

    if (isRevealed) {
      advanceToNextCard();
      return;
    }

    revealCard();
  }, [
    advanceToNextCard,
    clearAutoAdvanceTimer,
    clearCountdownInterval,
    clearNextLedTimer,
    clearRevealTimer,
    isRevealed,
    revealCard,
  ]);

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
        if (!cancelled) {
          setCountdownSeconds(null);
          advanceToNextCard();
        }
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
    revealCard,
  ]);

  useEffect(() => {
    if (isPowerOn) {
      return undefined;
    }

    clearAutoAdvanceTimer();
    clearCountdownInterval();
    clearRevealTimer();
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
  ]);

  useEffect(
    () => () => {
      clearRevealTimer();
      clearAutoAdvanceTimer();
      clearCountdownInterval();
      clearNextLedTimer();
    },
    [clearAutoAdvanceTimer, clearCountdownInterval, clearNextLedTimer, clearRevealTimer]
  );

  useEffect(() => {
    if (selectedCounterIds.includes(card.counterId)) {
      return;
    }

    setIsRevealed(false);
    setCard(createCounterPracticeCard(selectedCounterIds));
  }, [card.counterId, selectedCounterIds]);

  const nextButtonLabel = isRevealed ? 'Next' : 'Show Answer';
  const autoPlayButtonLabel = isPowerOn ? 'Stop Loop' : 'Auto-Loop';

  return (
    <div className="space-y-5">
      <section className="card retro-paper-panel">
        <div className="mb-5 rounded border-2 border-[#0f3561] bg-gradient-to-br from-[#f8f4e8] via-[#eee2c9] to-[#e1d0ac] px-4 pt-6 pb-7 text-[#17365d] shadow-[0_6px_0_rgba(17,51,92,0.18)] sm:px-5 sm:pt-7 sm:pb-8">
          <p className="pb-2 text-[clamp(1.2rem,0.95rem+1.2vw,1.9rem)] font-semibold leading-[1.1] tracking-[0.04em] text-[#325984]">
            日本語カウンタートレーナー
          </p>
          <h1 className="retro-headline text-[clamp(1.3rem,1rem+1.4vw,2rem)] leading-[1.1] text-[#17365d]">
            Japanese Counter Practice Tool
          </h1>
          <p className="mt-2 text-sm font-semibold leading-tight text-[#395d86] sm:text-base">
            Old-textbook drills for counters. Read the image, pick the right counter, then check the
            ruby answer.
          </p>
        </div>

        <div className="retro-counter-layout">
          <div className="retro-counter-sheet" role="region" aria-label="Counter quiz card">
            {statusText && <p className="retro-counter-status">{statusText}</p>}
            <div className="retro-counter-problem-row">
              <p className="retro-counter-problem-qty">{card.quantity} ×</p>
              <CounterObjectIllustration
                illustrationId={card.object.illustrationId}
                className="retro-counter-illustration"
              />
            </div>
            {!isRevealed && (
              <p className="retro-counter-prompt">
                Say the phrase out loud, then reveal the answer.
              </p>
            )}
            {isRevealed && (
              <>
                <p className="japanese-text retro-counter-answer" aria-live="polite">
                  <RubyPart script={card.object.script} kana={card.object.kana} showFurigana />
                  <span className="mx-1">を</span>
                  <RubyPart script={card.countScript} kana={card.countKana} showFurigana />
                </p>
                <p className="retro-counter-gloss">
                  {card.object.englishLabel} uses counter {card.counterSymbol} ({card.counterHint}).
                </p>
              </>
            )}
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
                  <span className={`retro-clock-radio-led ${isPowerOn ? 'is-on' : 'is-off'}`} />
                  <button
                    type="button"
                    onClick={() => setIsPowerOn((current) => !current)}
                    className={`retro-counter-control-btn ${isPowerOn ? 'is-active' : ''}`}
                    aria-pressed={isPowerOn}
                  >
                    {autoPlayButtonLabel}
                  </button>
                </div>
                <div className="retro-counter-control-stack">
                  <span
                    className={`retro-clock-radio-led retro-clock-radio-led-next ${isNextLedActive ? 'is-flash' : ''}`}
                  />
                  <button
                    type="button"
                    onClick={handleNext}
                    className="retro-counter-control-btn"
                    aria-label={isRevealed ? 'Advance to the next item' : 'Show answer'}
                  >
                    {nextButtonLabel}
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
      </section>
    </div>
  );
};

export default JapaneseCounterPracticeToolPage;
