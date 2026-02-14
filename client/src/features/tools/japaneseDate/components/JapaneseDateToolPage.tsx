import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, Volume2 } from 'lucide-react';

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

  if (script.endsWith('日') && kana.endsWith('にち')) {
    const numberScript = script.slice(0, -1);
    const numberKana = kana.slice(0, -2);
    return (
      <span className="mr-1 inline-flex items-start">
        <ruby>
          {numberScript}
          <rt className={`!text-[0.27em] ${showFurigana ? '' : 'invisible'}`}>{numberKana}</rt>
        </ruby>
        <ruby>
          日<rt className={`!text-[0.27em] ${showFurigana ? '' : 'invisible'}`}>にち</rt>
        </ruby>
      </span>
    );
  }

  return <RubyPart script={script} kana={kana} showFurigana={showFurigana} />;
};

const JapaneseDateToolPage = () => {
  const now = useMemo(() => new Date(), []);
  const { minYear, maxYear } = getDateAudioYearRange();
  const [dateValue, setDateValue] = useState(toLocalDateInputValue(now));
  const [isUsingCurrentDate, setIsUsingCurrentDate] = useState(true);
  const [showFurigana, setShowFurigana] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const playbackRef = useRef<AudioSequencePlayback | null>(null);

  const localDateTime = useMemo(() => parseLocalDateTimeInput(dateValue, '09:00'), [dateValue]);

  const reading = useMemo(
    () => generateJapaneseDateTimeReading(localDateTime, { hourFormat: '12h' }),
    [localDateTime]
  );

  useEffect(
    () => () => {
      playbackRef.current?.stop();
      playbackRef.current = null;
      setIsPlaying(false);
    },
    []
  );

  useEffect(() => {
    if (!isUsingCurrentDate) return undefined;

    const syncCurrentDate = () => {
      const nextDate = toLocalDateInputValue(new Date());
      setDateValue((current) => (current === nextDate ? current : nextDate));
    };

    syncCurrentDate();
    const intervalId = window.setInterval(syncCurrentDate, 30_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isUsingCurrentDate]);

  const handleManualDateChange = (value: string) => {
    const today = toLocalDateInputValue(new Date());
    setDateValue(value);
    setIsUsingCurrentDate(value === today);
  };

  const handleUseCurrentDate = () => {
    setDateValue(toLocalDateInputValue(new Date()));
    setIsUsingCurrentDate(true);
  };

  const stopPlayback = () => {
    playbackRef.current?.stop();
    playbackRef.current = null;
    setIsPlaying(false);
  };

  const handlePlayDateClick = async () => {
    if (isPlaying) {
      stopPlayback();
      return;
    }

    stopPlayback();

    let currentPlayback: AudioSequencePlayback | null = null;

    try {
      const year = localDateTime.getFullYear();
      const month = localDateTime.getMonth() + 1;
      const day = localDateTime.getDate();

      const urls = buildDateAudioClipUrls({ year, month, day });
      const playback = playDateAudioClipSequence(urls);
      currentPlayback = playback;

      playbackRef.current = playback;
      setIsPlaying(true);

      await playback.finished;
    } catch (error) {
      const isAbort = error instanceof DOMException && error.name === 'AbortError';
      if (!isAbort) {
        if (error instanceof Error && error.message.includes('year must be')) {
          // Keep this as a console warning so UI stays quiet on play.
          console.warn(`Date audio supports years ${minYear}-${maxYear}.`);
        } else {
          console.warn('Date audio playback failed.', error);
        }
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
          <h1 className="retro-headline text-2xl sm:text-3xl">Japanese Date</h1>
          <p className="retro-date-tool-kana text-lg font-semibold text-[#2f4f73] sm:text-xl">
            日本語の日付
          </p>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label htmlFor="jp-date-input" className="space-y-1.5">
            <span className="retro-date-tool-field-label text-sm font-semibold text-[#204266] inline-flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              Date
            </span>
            <div className="flex items-center gap-2">
              <input
                id="jp-date-input"
                type="date"
                className="input retro-date-tool-input min-w-0 flex-1"
                value={dateValue}
                min={`${minYear}-01-01`}
                max={`${maxYear}-12-31`}
                onChange={(event) => handleManualDateChange(event.target.value)}
              />
              <div className="w-[12rem] shrink-0">
                <button
                  type="button"
                  aria-pressed={false}
                  aria-hidden={isUsingCurrentDate}
                  tabIndex={isUsingCurrentDate ? -1 : 0}
                  onClick={handleUseCurrentDate}
                  className={`btn-outline retro-date-tool-format-btn h-[2.75rem] w-full py-0 text-[0.72rem] tracking-[0.04em] focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 ${isUsingCurrentDate ? 'invisible pointer-events-none' : ''}`}
                >
                  Sync to Current Date
                </button>
              </div>
            </div>
          </label>
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
              <UnitRubyPart
                script={reading.parts.yearScript}
                kana={reading.parts.yearKana}
                showFurigana={showFurigana}
              />
              <UnitRubyPart
                script={reading.parts.monthScript}
                kana={reading.parts.monthKana}
                showFurigana={showFurigana}
              />
              <UnitRubyPart
                script={reading.parts.dayScript}
                kana={reading.parts.dayKana}
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
              handlePlayDateClick().catch((error) => {
                console.warn('Date audio playback failed.', error);
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

export default JapaneseDateToolPage;
