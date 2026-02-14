import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Clock3, Volume2 } from 'lucide-react';

import {
  generateJapaneseDateTimeReading,
  parseLocalDateTimeInput,
  toLocalDateInputValue,
  type JapaneseHourFormat,
} from '../logic/readingEngine';
import {
  buildTimeAudioClipUrls,
  playAudioClipSequence,
  type AudioSequencePlayback,
} from '../logic/preRenderedTimeAudio';

interface RubyPartProps {
  script: string;
  kana: string;
  showFurigana: boolean;
}

const COMPOUND_RUBY_SPLITS: Record<string, [string, string]> = {
  午前: ['ご', 'ぜん'],
  午後: ['ご', 'ご'],
};

const RubyPart = ({ script, kana, showFurigana }: RubyPartProps) => {
  const split = COMPOUND_RUBY_SPLITS[script];

  if (split && script.length === 2) {
    return (
      <span className="mr-1 inline-flex items-start">
        <ruby>
          {script[0]}
          <rt className={`!text-[0.27em] ${showFurigana ? '' : 'invisible'}`}>{split[0]}</rt>
        </ruby>
        <ruby>
          {script[1]}
          <rt className={`!text-[0.27em] ${showFurigana ? '' : 'invisible'}`}>{split[1]}</rt>
        </ruby>
      </span>
    );
  }

  return (
    <ruby className="mr-1">
      {script}
      <rt className={`!text-[0.27em] ${showFurigana ? '' : 'invisible'}`}>{kana}</rt>
    </ruby>
  );
};

const UnitRubyPart = ({ script, kana, showFurigana }: RubyPartProps) => {
  if (script.endsWith('時') && kana.endsWith('じ')) {
    const numberScript = script.slice(0, -1);
    const numberKana = kana.slice(0, -1);
    return (
      <span className="mr-1 inline-flex items-start">
        <ruby>
          {numberScript}
          <rt className={`!text-[0.27em] ${showFurigana ? '' : 'invisible'}`}>{numberKana}</rt>
        </ruby>
        <ruby>
          時<rt className={`!text-[0.27em] ${showFurigana ? '' : 'invisible'}`}>じ</rt>
        </ruby>
      </span>
    );
  }

  if (script.endsWith('分') && (kana.endsWith('ふん') || kana.endsWith('ぷん'))) {
    const unitKana = kana.endsWith('ふん') ? 'ふん' : 'ぷん';
    const numberScript = script.slice(0, -1);
    const numberKana = kana.slice(0, -unitKana.length);
    return (
      <span className="mr-1 inline-flex items-start">
        <ruby>
          {numberScript}
          <rt className={`!text-[0.27em] ${showFurigana ? '' : 'invisible'}`}>{numberKana}</rt>
        </ruby>
        <ruby>
          分<rt className={`!text-[0.27em] ${showFurigana ? '' : 'invisible'}`}>{unitKana}</rt>
        </ruby>
      </span>
    );
  }

  return <RubyPart script={script} kana={kana} showFurigana={showFurigana} />;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const toTwoDigits = (value: number) => String(value).padStart(2, '0');

const getCurrentTimeSnapshot = () => {
  const now = new Date();

  return {
    hour24: now.getHours(),
    minute: now.getMinutes(),
    localDate: toLocalDateInputValue(now),
  };
};

const JapaneseTimeToolPage = () => {
  const [timeParts, setTimeParts] = useState(() => getCurrentTimeSnapshot());
  const [hourFormat, setHourFormat] = useState<JapaneseHourFormat>('12h');
  const [isUsingCurrentTime, setIsUsingCurrentTime] = useState(true);
  const [showFurigana, setShowFurigana] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isTimePickerOpen, setIsTimePickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement | null>(null);
  const hourInputRef = useRef<HTMLInputElement | null>(null);
  const playbackRef = useRef<AudioSequencePlayback | null>(null);

  const { hour24, minute, localDate } = timeParts;
  const currentPeriod = hour24 < 12 ? 'AM' : 'PM';
  const hour12 = hour24 % 12 || 12;
  const timeValue = `${toTwoDigits(hour24)}:${toTwoDigits(minute)}`;
  const displayTime =
    hourFormat === '12h'
      ? `${toTwoDigits(hour12)}:${toTwoDigits(minute)} ${currentPeriod}`
      : `${toTwoDigits(hour24)}:${toTwoDigits(minute)}`;

  const localDateTime = useMemo(
    () => parseLocalDateTimeInput(localDate, timeValue),
    [localDate, timeValue]
  );

  const reading = useMemo(
    () => generateJapaneseDateTimeReading(localDateTime, { hourFormat }),
    [hourFormat, localDateTime]
  );

  useEffect(() => {
    if (!isTimePickerOpen) return undefined;

    const handleOutsideClick = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setIsTimePickerOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isTimePickerOpen]);

  useEffect(
    () => () => {
      playbackRef.current?.stop();
      playbackRef.current = null;
      setIsPlaying(false);
    },
    []
  );

  useEffect(() => {
    if (!isUsingCurrentTime) return undefined;

    const syncCurrentTime = () => {
      setTimeParts((current) => {
        const next = getCurrentTimeSnapshot();
        if (
          current.hour24 === next.hour24 &&
          current.minute === next.minute &&
          current.localDate === next.localDate
        ) {
          return current;
        }
        return next;
      });
    };

    syncCurrentTime();
    const intervalId = window.setInterval(syncCurrentTime, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isUsingCurrentTime]);

  const openTimePicker = () => {
    setIsTimePickerOpen(true);
    requestAnimationFrame(() => {
      hourInputRef.current?.focus();
    });
  };

  const handleManualTimeChange = () => {
    setIsUsingCurrentTime(false);
  };

  const handleUseCurrentTime = () => {
    setTimeParts(getCurrentTimeSnapshot());
    setIsUsingCurrentTime(true);
  };

  const updateMinute = (value: string) => {
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed)) return;
    handleManualTimeChange();
    setTimeParts((current) => ({ ...current, minute: clamp(parsed, 0, 59) }));
  };

  const updateHour24 = (value: string) => {
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed)) return;
    handleManualTimeChange();
    setTimeParts((current) => ({ ...current, hour24: clamp(parsed, 0, 23) }));
  };

  const updateHour12 = (value: string) => {
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed)) return;
    const clampedHour12 = clamp(parsed, 1, 12);
    handleManualTimeChange();

    setTimeParts((current) => {
      const nextHour24 = currentPeriod === 'AM' ? clampedHour12 % 12 : (clampedHour12 % 12) + 12;
      return {
        ...current,
        hour24: nextHour24,
      };
    });
  };

  const updatePeriod = (nextPeriod: 'AM' | 'PM') => {
    handleManualTimeChange();
    setTimeParts((current) => {
      const currentHour12 = current.hour24 % 12 || 12;
      const nextHour24 = nextPeriod === 'AM' ? currentHour12 % 12 : (currentHour12 % 12) + 12;
      return {
        ...current,
        hour24: nextHour24,
      };
    });
  };

  const stepHour = (delta: number) => {
    handleManualTimeChange();
    if (hourFormat === '12h') {
      const current = hour12;
      const next = ((current - 1 + delta + 12) % 12) + 1;
      updateHour12(String(next));
      return;
    }

    setTimeParts((current) => ({
      ...current,
      hour24: (current.hour24 + delta + 24) % 24,
    }));
  };

  const stepMinute = (delta: number) => {
    handleManualTimeChange();
    setTimeParts((current) => ({
      ...current,
      minute: (current.minute + delta + 60) % 60,
    }));
  };

  const stopPlayback = () => {
    playbackRef.current?.stop();
    playbackRef.current = null;
    setIsPlaying(false);
  };

  const handlePlayTimeClick = async () => {
    if (isPlaying) {
      stopPlayback();
      return;
    }

    stopPlayback();
    let currentPlayback: AudioSequencePlayback | null = null;

    try {
      const urls = buildTimeAudioClipUrls({
        hour24: timeParts.hour24,
        minute: timeParts.minute,
        hourFormat,
      });

      const playback = playAudioClipSequence(urls);
      currentPlayback = playback;
      playbackRef.current = playback;
      setIsPlaying(true);

      await playback.finished;
    } catch (error) {
      const isAbort = error instanceof DOMException && error.name === 'AbortError';
      if (!isAbort) {
        console.warn('Time audio playback failed.', error);
      }
    } finally {
      if (currentPlayback && playbackRef.current === currentPlayback) {
        playbackRef.current = null;
        setIsPlaying(false);
      }
    }
  };

  return (
    <div className="retro-date-tool-page space-y-4 sm:space-y-5">
      <section className="card retro-paper-panel retro-date-tool-card">
        <div className="retro-date-tool-header">
          <h1 className="retro-headline text-2xl sm:text-3xl">Japanese Time</h1>
          <p className="retro-date-tool-kana text-lg font-semibold text-[#2f4f73] sm:text-xl">
            日本語の時刻
          </p>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <span className="retro-date-tool-field-label text-sm font-semibold text-[#204266] inline-flex items-center gap-2">
              <Clock3 className="h-4 w-4" />
              Time
            </span>
            <div className="retro-time-picker" ref={pickerRef}>
              <button
                type="button"
                className="input retro-date-tool-input retro-time-picker-trigger flex h-[3.25rem] items-center justify-center py-0 text-[1.35rem] font-semibold tracking-[0.03em]"
                onClick={openTimePicker}
                aria-expanded={isTimePickerOpen}
                aria-haspopup="dialog"
              >
                <span className="retro-time-picker-display">{displayTime}</span>
              </button>

              {isTimePickerOpen && (
                <div
                  className="retro-time-picker-panel mt-2 rounded border border-[#173b6533] bg-[#fbf5e0] p-3 shadow-[0_4px_0_rgba(17,51,92,0.08)]"
                  role="dialog"
                  aria-label="Time picker"
                >
                  <div className="retro-time-picker-row grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                    <div className="flex flex-col items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => stepHour(1)}
                        className="btn-outline h-8 w-10 px-0 py-0"
                        aria-label="Increase hour"
                      >
                        <ChevronUp className="h-4 w-4" />
                      </button>
                      <input
                        ref={hourInputRef}
                        type="number"
                        min={hourFormat === '12h' ? 1 : 0}
                        max={hourFormat === '12h' ? 12 : 23}
                        step={1}
                        value={hourFormat === '12h' ? hour12 : timeParts.hour24}
                        onChange={(event) => {
                          if (hourFormat === '12h') {
                            updateHour12(event.target.value);
                          } else {
                            updateHour24(event.target.value);
                          }
                        }}
                        className="input retro-time-picker-input h-10 w-[5.2rem] py-0 text-center text-lg font-semibold"
                      />
                      <button
                        type="button"
                        onClick={() => stepHour(-1)}
                        className="btn-outline h-8 w-10 px-0 py-0"
                        aria-label="Decrease hour"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </button>
                    </div>
                    <span className="retro-time-picker-separator">:</span>
                    <div className="flex flex-col items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => stepMinute(1)}
                        className="btn-outline h-8 w-10 px-0 py-0"
                        aria-label="Increase minute"
                      >
                        <ChevronUp className="h-4 w-4" />
                      </button>
                      <input
                        type="number"
                        min={0}
                        max={59}
                        step={1}
                        value={timeParts.minute}
                        onChange={(event) => updateMinute(event.target.value)}
                        className="input retro-time-picker-input h-10 w-[5.2rem] py-0 text-center text-lg font-semibold"
                      />
                      <button
                        type="button"
                        onClick={() => stepMinute(-1)}
                        className="btn-outline h-8 w-10 px-0 py-0"
                        aria-label="Decrease minute"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {hourFormat === '12h' && (
                    <div className="retro-time-picker-period mt-3 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => updatePeriod('AM')}
                        className={`btn-outline retro-time-picker-period-btn ${currentPeriod === 'AM' ? 'bg-[#173b65] text-[#fbf5e0]' : ''}`}
                      >
                        AM
                      </button>
                      <button
                        type="button"
                        onClick={() => updatePeriod('PM')}
                        className={`btn-outline retro-time-picker-period-btn ${currentPeriod === 'PM' ? 'bg-[#173b65] text-[#fbf5e0]' : ''}`}
                      >
                        PM
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="retro-date-tool-field-label text-sm font-semibold text-[#204266]">
              Format
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setHourFormat('12h')}
                className={`btn-outline retro-date-tool-format-btn h-[3.25rem] py-0 ${hourFormat === '12h' ? 'bg-[#173b65] text-[#fbf5e0]' : ''}`}
              >
                12h
              </button>
              <button
                type="button"
                onClick={() => setHourFormat('24h')}
                className={`btn-outline retro-date-tool-format-btn h-[3.25rem] py-0 ${hourFormat === '24h' ? 'bg-[#173b65] text-[#fbf5e0]' : ''}`}
              >
                24h
              </button>
            </div>
            <button
              type="button"
              aria-pressed={isUsingCurrentTime}
              onClick={handleUseCurrentTime}
              className={`btn-outline retro-date-tool-format-btn mt-2 h-[2.75rem] w-full py-0 ${isUsingCurrentTime ? 'bg-[#173b65] text-[#fbf5e0]' : ''}`}
            >
              Use Current Time
            </button>
          </div>
        </div>
      </section>

      <section className="card retro-paper-panel retro-date-tool-card space-y-4">
        <div>
          <div className="flex items-center justify-between gap-3">
            <h2 className="retro-headline text-lg sm:text-xl">Japanese Reading</h2>
            <button
              type="button"
              onClick={() => setShowFurigana((current) => !current)}
              aria-pressed={showFurigana}
              className={`btn-outline retro-date-tool-format-btn px-3 py-1.5 whitespace-nowrap focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 ${showFurigana ? 'bg-[#173b65] text-[#fbf5e0]' : ''}`}
            >
              {showFurigana ? 'Hide Furigana' : 'Show Furigana'}
            </button>
          </div>
          <div className="japanese-text retro-date-tool-reading mt-2 rounded border border-[#173b6533] bg-[#fbf5e0] px-4 py-3 text-[clamp(2.15rem,1.35rem+2.4vw,3.6rem)] leading-[1.25] text-[#15355a]">
            <p className="retro-date-tool-reading-line">
              {reading.parts.periodScript && reading.parts.periodKana && (
                <RubyPart
                  script={reading.parts.periodScript}
                  kana={reading.parts.periodKana}
                  showFurigana={showFurigana}
                />
              )}
              <UnitRubyPart
                script={reading.parts.hourScript}
                kana={reading.parts.hourKana}
                showFurigana={showFurigana}
              />
              <UnitRubyPart
                script={reading.parts.minuteScript}
                kana={reading.parts.minuteKana}
                showFurigana={showFurigana}
              />
            </p>
          </div>
        </div>

        <div className="retro-date-tool-actions flex flex-wrap items-center gap-2 pt-1">
          <button
            type="button"
            aria-pressed={isPlaying}
            onClick={() => {
              handlePlayTimeClick().catch((error) => {
                console.warn('Time audio playback failed.', error);
              });
            }}
            className={`btn-primary retro-date-tool-audio-btn inline-flex items-center gap-2 focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 ${isPlaying ? 'bg-[#173b65] text-[#fbf5e0] animate-pulse' : ''}`}
          >
            <Volume2 className="h-4 w-4" />
            {isPlaying ? 'Stop' : 'Play'}
          </button>
        </div>
      </section>
    </div>
  );
};

export default JapaneseTimeToolPage;
