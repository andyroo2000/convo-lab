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
import type { AudioSequencePlayback } from '../logic/preRenderedTimeAudio';

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
const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'] as const;

const toTwoDigits = (value: number) => String(value).padStart(2, '0');
const toFullWidthDigits = (value: number | string) =>
  String(value).replace(/\d/g, (digit) => String.fromCharCode(digit.charCodeAt(0) + 0xfee0));

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
  const year = toFullWidthDigits(date.getFullYear());
  const month = toFullWidthDigits(toTwoDigits(date.getMonth() + 1));
  const day = toFullWidthDigits(toTwoDigits(date.getDate()));
  return showYear ? `${year}/${month}/${day}` : `${month}/${day}`;
};

const RubyPart = ({ script, kana, showFurigana }: RubyPartProps) => (
  <ruby className="mr-1">
    {script}
    <rt className={`!text-[0.27em] ${showFurigana ? '' : 'invisible'}`}>{kana}</rt>
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
          <rt className={`!text-[0.27em] ${showFurigana ? '' : 'invisible'}`}>{numberKana}</rt>
        </ruby>
        <ruby>
          年<rt className={`!text-[0.27em] ${showFurigana ? '' : 'invisible'}`}>ねん</rt>
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
          <rt className={`!text-[0.27em] ${showFurigana ? '' : 'invisible'}`}>{numberKana}</rt>
        </ruby>
        <ruby>
          月<rt className={`!text-[0.27em] ${showFurigana ? '' : 'invisible'}`}>がつ</rt>
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
  const [pauseSeconds, setPauseSeconds] = useState<number>(12);
  const [countdownSeconds, setCountdownSeconds] = useState<number | null>(null);
  const [isNextLedActive, setIsNextLedActive] = useState(false);
  const [playbackHint, setPlaybackHint] = useState<string | null>(null);

  const revealTimerRef = useRef<number | null>(null);
  const autoAdvanceTimerRef = useRef<number | null>(null);
  const countdownIntervalRef = useRef<number | null>(null);
  const nextLedTimerRef = useRef<number | null>(null);
  const playbackRef = useRef<AudioSequencePlayback | null>(null);
  const isFirstPowerOnRef = useRef(true);

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

  const calendarYear = card.date.getFullYear();
  const calendarMonth = card.date.getMonth() + 1;
  const selectedDay = card.date.getDate();
  const monthStartWeekday = new Date(calendarYear, card.date.getMonth(), 1).getDay();
  const daysInMonth = new Date(calendarYear, card.date.getMonth() + 1, 0).getDate();

  const calendarCells = useMemo(() => {
    const cells: Array<{ key: string; day: number | null; weekdayIndex: number }> = [];

    for (let index = 0; index < monthStartWeekday; index += 1) {
      cells.push({ key: `pad-start-${index + 1}`, day: null, weekdayIndex: index % 7 });
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const weekdayIndex = (monthStartWeekday + day - 1) % 7;
      cells.push({ key: `day-${day}`, day, weekdayIndex });
    }

    let trailing = 0;
    while (cells.length % 7 !== 0) {
      trailing += 1;
      cells.push({
        key: `pad-end-${trailing}`,
        day: null,
        weekdayIndex: cells.length % 7,
      });
    }

    return cells;
  }, [daysInMonth, monthStartWeekday]);

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
    stopPlayback,
  ]);

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
                  className={`retro-clock-radio-action ${isPowerOn ? 'is-active' : ''}`}
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
                  className="retro-clock-radio-action"
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

            <div className="retro-clock-radio-pause-group" role="group" aria-label="Pause length">
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
                {showYear ? 'Year On' : 'Year Off'}
              </button>
            </div>
          </div>
        </div>

        <div className="retro-date-calendar mt-4">
          <header className="retro-date-calendar-header">
            <p className="retro-caps text-[0.72rem] tracking-[0.1em] text-[#8fd3ea]">
              {toFullWidthDigits(calendarYear)}年 {toFullWidthDigits(calendarMonth)}月
            </p>
          </header>
          <div className="retro-date-calendar-grid">
            {WEEKDAY_LABELS.map((weekday, index) => (
              <div
                key={weekday}
                className={`retro-date-calendar-weekday ${index === 0 ? 'is-sunday' : ''} ${index === 6 ? 'is-saturday' : ''}`}
              >
                {weekday}
              </div>
            ))}
            {calendarCells.map((cell) => {
              const { day, weekdayIndex } = cell;
              const isSelected = day === selectedDay;
              const isWeekend = weekdayIndex === 0 || weekdayIndex === 6;
              return (
                <div
                  key={cell.key}
                  className={`retro-date-calendar-day ${day ? 'has-day' : ''} ${isWeekend ? 'is-weekend' : ''} ${isSelected ? 'is-selected' : ''}`}
                >
                  {day ? toFullWidthDigits(day) : ''}
                </div>
              );
            })}
          </div>
        </div>

        <p className="mt-3 text-sm font-semibold leading-snug text-[#5a4523]">
          Use Show Answer + Next for manual practice. Turn on Auto-Play for continuous timed date
          prompts.
        </p>
        {playbackHint && <p className="mt-2 text-sm text-[#9e4c2a]">{playbackHint}</p>}
      </section>
    </div>
  );
};

export default JapaneseDateToolPage;
