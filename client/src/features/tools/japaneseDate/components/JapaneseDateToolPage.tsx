import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  generateJapaneseDateTimeReading,
  parseLocalDateTimeInput,
  toLocalDateInputValue,
} from '../logic/readingEngine';
import {
  buildDateAudioClipUrls,
  getDateAudioYearRange,
  playDateAudioClipSequence,
} from '../logic/preRenderedDateAudio';
import useToolArrowKeyNavigation from '../../hooks/useToolArrowKeyNavigation';
import type { AudioSequencePlayback } from '../logic/preRenderedTimeAudio';
import DateMiniCalendar from './DateMiniCalendar';

interface RubyPartProps {
  script: string;
  kana: string;
  showFurigana: boolean;
}

interface DatePracticeCard {
  id: string;
  date: Date;
}

const PAUSE_OPTIONS = [5, 8, 12] as const;
const RUBY_RT_CLASS = '!text-[0.34em] sm:!text-[0.27em]';
const HISTORY_LIMIT = 120;

interface DateCardSnapshot {
  card: DatePracticeCard;
  isRevealed: boolean;
}

const toTwoDigits = (value: number) => String(value).padStart(2, '0');

const createDateCard = (date: Date): DatePracticeCard => {
  const normalized = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 9, 0, 0, 0);
  return {
    id: `${normalized.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
    date: normalized,
  };
};

const createCurrentLocalDateCard = (): DatePracticeCard => createDateCard(new Date());

const createRandomDateCard = (minYear: number, maxYear: number): DatePracticeCard => {
  const year = minYear + Math.floor(Math.random() * (maxYear - minYear + 1));
  const month = Math.floor(Math.random() * 12);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const day = 1 + Math.floor(Math.random() * daysInMonth);
  return createDateCard(new Date(year, month, day));
};

const formatDateDisplay = (date: Date, showYear: boolean): string => {
  const year = String(date.getFullYear());
  const month = toTwoDigits(date.getMonth() + 1);
  const day = toTwoDigits(date.getDate());
  return showYear ? `${year}/${month}/${day}` : `${month}/${day}`;
};

const RubyPart = ({ script, kana, showFurigana }: RubyPartProps) => (
  <ruby className="mr-1">
    {script}
    <rt className={`${RUBY_RT_CLASS} ${showFurigana ? '' : 'invisible'}`}>{kana}</rt>
  </ruby>
);

const UnitRubyPart = ({ script, kana, showFurigana }: RubyPartProps) => {
  if (script.endsWith('年') && kana.endsWith('ねん')) {
    const numberScript = script.slice(0, -1);
    const numberKana = kana.slice(0, -2);
    return (
      <span className="mr-1 inline-flex items-start">
        <ruby>
          {numberScript}
          <rt className={`${RUBY_RT_CLASS} ${showFurigana ? '' : 'invisible'}`}>{numberKana}</rt>
        </ruby>
        <ruby>
          年<rt className={`${RUBY_RT_CLASS} ${showFurigana ? '' : 'invisible'}`}>ねん</rt>
        </ruby>
      </span>
    );
  }

  if (script.endsWith('月') && kana.endsWith('がつ')) {
    const numberScript = script.slice(0, -1);
    const numberKana = kana.slice(0, -2);
    return (
      <span className="mr-1 inline-flex items-start">
        <ruby>
          {numberScript}
          <rt className={`${RUBY_RT_CLASS} ${showFurigana ? '' : 'invisible'}`}>{numberKana}</rt>
        </ruby>
        <ruby>
          月<rt className={`${RUBY_RT_CLASS} ${showFurigana ? '' : 'invisible'}`}>がつ</rt>
        </ruby>
      </span>
    );
  }

  if (script.endsWith('日')) {
    // Day-of-month readings include irregular forms (e.g. 14日 = じゅうよっか),
    // so keep the entire token in one ruby to avoid incorrect splitting.
    return <RubyPart script={script} kana={kana} showFurigana={showFurigana} />;
  }

  return <RubyPart script={script} kana={kana} showFurigana={showFurigana} />;
};

const JapaneseDateToolPage = () => {
  const { minYear, maxYear } = getDateAudioYearRange();
  const [card, setCard] = useState<DatePracticeCard>(createCurrentLocalDateCard);
  const [isPowerOn, setIsPowerOn] = useState(false);
  const [isRevealed, setIsRevealed] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showYear, setShowYear] = useState(false);
  const [volumeLevel, setVolumeLevel] = useState<number>(1);
  const [pauseSeconds, setPauseSeconds] = useState<number>(8);
  const [countdownSeconds, setCountdownSeconds] = useState<number | null>(null);
  const [isNextLedActive, setIsNextLedActive] = useState(false);
  const [playbackHint, setPlaybackHint] = useState<string | null>(null);

  const revealTimerRef = useRef<number | null>(null);
  const autoAdvanceTimerRef = useRef<number | null>(null);
  const countdownIntervalRef = useRef<number | null>(null);
  const nextLedTimerRef = useRef<number | null>(null);
  const playbackRef = useRef<AudioSequencePlayback | null>(null);
  const isFirstPowerOnRef = useRef(true);
  const previousCardsRef = useRef<DateCardSnapshot[]>([]);

  const dateValue = useMemo(() => toLocalDateInputValue(card.date), [card.date]);
  const reading = useMemo(
    () =>
      generateJapaneseDateTimeReading(parseLocalDateTimeInput(dateValue, '09:00'), {
        hourFormat: '24h',
      }),
    [dateValue]
  );

  const dateDisplay = useMemo(() => formatDateDisplay(card.date, showYear), [card.date, showYear]);

  const statusText = (() => {
    if (!isPowerOn || countdownSeconds === null) return '';
    if (!isRevealed) return `answer in ${countdownSeconds}s`;
    if (!isPlaying) return `replaying in ${countdownSeconds}s`;
    return '';
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
    setIsPlaying(false);
  }, []);

  const playCurrentCardAudio = useCallback(async () => {
    stopPlayback();

    let currentPlayback: AudioSequencePlayback | null = null;

    try {
      const year = card.date.getFullYear();
      const month = card.date.getMonth() + 1;
      const day = card.date.getDate();
      const urls = buildDateAudioClipUrls({ year, month, day, includeYear: showYear });
      const playback = playDateAudioClipSequence(urls, { volume: volumeLevel });
      currentPlayback = playback;
      playbackRef.current = playback;
      setIsPlaying(true);
      setPlaybackHint(null);
      await playback.finished;
    } catch (error) {
      const isAbort = error instanceof DOMException && error.name === 'AbortError';
      if (!isAbort) {
        setPlaybackHint('Autoplay was blocked. Tap Auto-Play or Show Answer to hear audio.');
      }
    } finally {
      if (currentPlayback && playbackRef.current === currentPlayback) {
        playbackRef.current = null;
      }
      setIsPlaying(false);
    }
  }, [card.date, showYear, stopPlayback, volumeLevel]);

  const revealCard = useCallback(() => {
    setIsRevealed(true);
    playCurrentCardAudio().catch(() => {
      setPlaybackHint('Autoplay was blocked. Tap Auto-Play or Show Answer to hear audio.');
    });
  }, [playCurrentCardAudio]);

  const advanceToNextCard = useCallback(() => {
    setIsRevealed(false);
    setCard(createRandomDateCard(minYear, maxYear));
  }, [maxYear, minYear]);

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

  return (
    <div className="space-y-5">
      <section className="card retro-paper-panel">
        <div className="mb-5 rounded border-2 border-[#0f3561] bg-gradient-to-br from-[#102d57] via-[#143b6f] to-[#184779] px-4 pt-6 pb-7 text-[#f7f6ef] shadow-[0_6px_0_rgba(17,51,92,0.26)] sm:px-5 sm:pt-7 sm:pb-8">
          <p className="pb-3 text-[clamp(1.45rem,1.05rem+1.8vw,2.5rem)] font-semibold leading-[1.05] tracking-[0.04em] text-[#8fd3ea]">
            日本語デートトレーナー
          </p>
          <p className="retro-headline mt-1 text-[clamp(1.4rem,1rem+1.7vw,2.05rem)] leading-[1.08] text-[#f9f8ed]">
            READ IT.
            <span className="mx-2 text-[#37b4d7]">LISTEN.</span>
            CHECK YOUR ANSWER.
          </p>
          <p className="mt-2 text-sm font-semibold leading-tight text-[#d3ecf4] sm:text-base">
            A date appears first. Say it in Japanese before reveal, then compare with the audio.
          </p>
        </div>

        <div className="retro-date-practice-layout">
          <div className="retro-date-practice-player">
            <div className="retro-clock-radio-shell">
              <div className="retro-clock-radio-body">
                <div className="retro-clock-radio-window">
                  <div className="retro-clock-radio-glow" />
                  {statusText && <p className="retro-clock-radio-status">{statusText}</p>}
                  {isRevealed ? (
                    <p className="japanese-text retro-clock-radio-script">
                      {showYear && (
                        <UnitRubyPart
                          script={reading.parts.yearScript}
                          kana={reading.parts.yearKana}
                          showFurigana
                        />
                      )}
                      <UnitRubyPart
                        script={reading.parts.monthScript}
                        kana={reading.parts.monthKana}
                        showFurigana
                      />
                      <UnitRubyPart
                        script={reading.parts.dayScript}
                        kana={reading.parts.dayKana}
                        showFurigana
                      />
                    </p>
                  ) : (
                    <p className="retro-clock-radio-digital retro-clock-radio-date-digital">
                      {dateDisplay}
                    </p>
                  )}
                </div>
              </div>

              <div className="retro-clock-radio-controls">
                <div className="retro-clock-radio-transport">
                  <div className="retro-clock-radio-autoplay-stack">
                    <span className={`retro-clock-radio-led ${isPowerOn ? 'is-on' : 'is-off'}`} />
                    <button
                      type="button"
                      onClick={() => setIsPowerOn((current) => !current)}
                      className={`retro-clock-radio-action retro-clock-radio-transport-action ${isPowerOn ? 'is-active' : ''}`}
                      aria-pressed={isPowerOn}
                    >
                      {isPowerOn ? 'Stop' : 'Auto-Play'}
                    </button>
                  </div>
                  <div className="retro-clock-radio-next-stack">
                    <span
                      className={`retro-clock-radio-led retro-clock-radio-led-next ${isNextLedActive ? 'is-flash' : ''}`}
                    />
                    <button
                      type="button"
                      onClick={handleNext}
                      className="retro-clock-radio-action retro-clock-radio-transport-action"
                      aria-label={isRevealed ? 'Advance to the next item' : 'Show answer'}
                    >
                      {nextButtonLabel}
                    </button>
                  </div>
                </div>

                <div className="retro-clock-radio-volume" role="group" aria-label="Volume">
                  <span className="retro-clock-radio-control-label">Volume</span>
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

                <div
                  className="retro-clock-radio-pause-group"
                  role="group"
                  aria-label="Pause length"
                >
                  <span className="retro-clock-radio-control-label">
                    Pause Length (In Auto-Play Mode)
                  </span>
                  <div className="retro-clock-radio-pause-options">
                    {PAUSE_OPTIONS.map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setPauseSeconds(option)}
                        className={`retro-clock-radio-pause-button ${pauseSeconds === option ? 'is-active' : ''}`}
                        aria-pressed={pauseSeconds === option}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowYear((current) => !current)}
                    className={`retro-clock-radio-pause-button retro-date-year-toggle ${showYear ? 'is-active' : ''}`}
                    aria-pressed={showYear}
                  >
                    {showYear ? 'Hide Year' : 'Show Year'}
                  </button>
                </div>
              </div>
            </div>
          </div>
          <DateMiniCalendar date={card.date} />
        </div>

        <div className="mt-4 rounded border border-[#173b6538] bg-[#edf5f9] px-3 py-3 shadow-[0_3px_0_rgba(17,51,92,0.12)] sm:px-4">
          <ul className="list-disc pl-5 text-sm font-semibold leading-snug text-[#1b3f69] sm:text-[0.96rem]">
            <li>
              Use <span className="retro-caps text-[#15355a]">SHOW ANSWER + NEXT</span> for manual
              practice at your pace.
            </li>
            <li>
              Switch to <span className="retro-caps text-[#15355a]">AUTO-PLAY</span> to get a
              nonstop quiz loop on the selected pause length.
            </li>
          </ul>
        </div>
        {playbackHint && <p className="mt-3 text-sm text-[#9e4c2a]">{playbackHint}</p>}
      </section>
    </div>
  );
};

export default JapaneseDateToolPage;
