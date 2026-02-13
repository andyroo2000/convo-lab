import { useMemo, useState } from 'react';
import { CalendarDays, Check, Clock3, Volume2 } from 'lucide-react';

import {
  generateJapaneseDateTimeReading,
  parseLocalDateTimeInput,
  toLocalDateInputValue,
  toLocalTimeInputValue,
  type JapaneseHourFormat,
} from '../logic/readingEngine';

interface RubyPartProps {
  script: string;
  kana: string;
}

const RubyPart = ({ script, kana }: RubyPartProps) => (
  <ruby className="mr-1">
    {script}
    <rt className="!text-[0.27em]">{kana}</rt>
  </ruby>
);

const JapaneseDateToolPage = () => {
  const now = useMemo(() => new Date(), []);
  const [dateValue, setDateValue] = useState(toLocalDateInputValue(now));
  const [timeValue, setTimeValue] = useState(toLocalTimeInputValue(now));
  const [hourFormat, setHourFormat] = useState<JapaneseHourFormat>('12h');
  const [audioMessage, setAudioMessage] = useState<string | null>(null);

  const localDateTime = useMemo(
    () => parseLocalDateTimeInput(dateValue, timeValue),
    [dateValue, timeValue]
  );

  const reading = useMemo(
    () => generateJapaneseDateTimeReading(localDateTime, { hourFormat }),
    [hourFormat, localDateTime]
  );

  const handlePlayClick = () => {
    setAudioMessage('Audio clip playback is enabled in the next phase.');
    setTimeout(() => setAudioMessage(null), 3000);
  };

  return (
    <div className="space-y-5">
      <section className="card retro-paper-panel">
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="retro-headline text-2xl sm:text-3xl">Japanese Date & Time</h1>
          <p className="text-right text-lg font-semibold text-[#2f4f73] sm:text-xl">
            日本語の日付と時刻
          </p>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label htmlFor="jp-date-input" className="space-y-1.5">
            <span className="text-sm font-semibold text-[#204266] inline-flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              Date
            </span>
            <input
              id="jp-date-input"
              type="date"
              className="input"
              value={dateValue}
              onChange={(event) => setDateValue(event.target.value)}
            />
          </label>

          <label htmlFor="jp-time-input" className="space-y-1.5">
            <span className="text-sm font-semibold text-[#204266] inline-flex items-center gap-2">
              <Clock3 className="h-4 w-4" />
              Time
            </span>
            <input
              id="jp-time-input"
              type="time"
              className="input"
              value={timeValue}
              onChange={(event) => setTimeValue(event.target.value)}
            />
          </label>

          <div className="space-y-1.5">
            <span className="text-sm font-semibold text-[#204266]">Format</span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setHourFormat('12h')}
                className={`btn-outline py-2 ${hourFormat === '12h' ? 'bg-[#173b65] text-[#fbf5e0]' : ''}`}
              >
                12h (AM/PM)
              </button>
              <button
                type="button"
                onClick={() => setHourFormat('24h')}
                className={`btn-outline py-2 ${hourFormat === '24h' ? 'bg-[#173b65] text-[#fbf5e0]' : ''}`}
              >
                24h
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="card retro-paper-panel space-y-4">
        <div>
          <h2 className="retro-headline text-lg sm:text-xl">Japanese Reading</h2>
          <div className="japanese-text mt-2 rounded border border-[#173b6533] bg-[#fbf5e0] px-4 py-3 !text-[4.2rem] !leading-[1.45] text-[#15355a] sm:!text-[5.2rem]">
            <p>
              <RubyPart script={reading.parts.yearScript} kana={reading.parts.yearKana} />
              <RubyPart script={reading.parts.monthScript} kana={reading.parts.monthKana} />
              <span className="ml-5 inline-block">
                <RubyPart script={reading.parts.dayScript} kana={reading.parts.dayKana} />
              </span>
            </p>
            <p className="mt-3 sm:mt-4">
              （<RubyPart script={reading.parts.weekdayScript} kana={reading.parts.weekdayKana} />）
            </p>
            <p className="mt-5 sm:mt-6">
              {reading.parts.periodScript && reading.parts.periodKana && (
                <RubyPart script={reading.parts.periodScript} kana={reading.parts.periodKana} />
              )}
              <RubyPart script={reading.parts.hourScript} kana={reading.parts.hourKana} />
              <RubyPart script={reading.parts.minuteScript} kana={reading.parts.minuteKana} />
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            type="button"
            onClick={handlePlayClick}
            className="btn-primary inline-flex items-center gap-2"
          >
            <Volume2 className="h-4 w-4" />
            Play Audio
          </button>
        </div>

        {audioMessage && (
          <div className="inline-flex items-center gap-2 rounded border border-[#173b6533] bg-[#edf6eb] px-3 py-2 text-sm text-[#234868]">
            <Check className="h-4 w-4" />
            {audioMessage}
          </div>
        )}
      </section>
    </div>
  );
};

export default JapaneseDateToolPage;
