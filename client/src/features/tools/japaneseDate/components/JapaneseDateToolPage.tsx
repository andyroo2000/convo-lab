import { useMemo, useState } from 'react';
import { CalendarDays, Check, Clock3, Copy, Volume2 } from 'lucide-react';

import {
  generateJapaneseDateTimeReading,
  parseLocalDateTimeInput,
  toLocalDateInputValue,
  toLocalTimeInputValue,
  type JapaneseHourFormat,
} from '../logic/readingEngine';

interface JapaneseDateToolPageProps {
  surface: 'public' | 'app';
}

type CopyTarget = 'script' | 'kana';

const COPY_SUCCESS_LABEL: Record<CopyTarget, string> = {
  script: 'Japanese text copied',
  kana: 'Kana reading copied',
};

interface RubyPartProps {
  script: string;
  kana: string;
}

const RubyPart = ({ script, kana }: RubyPartProps) => (
  <ruby className="mr-1">
    {script}
    <rt>{kana}</rt>
  </ruby>
);

const JapaneseDateToolPage = ({ surface }: JapaneseDateToolPageProps) => {
  const now = useMemo(() => new Date(), []);
  const [dateValue, setDateValue] = useState(toLocalDateInputValue(now));
  const [timeValue, setTimeValue] = useState(toLocalTimeInputValue(now));
  const [hourFormat, setHourFormat] = useState<JapaneseHourFormat>('12h');
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const [audioMessage, setAudioMessage] = useState<string | null>(null);

  const localDateTime = useMemo(
    () => parseLocalDateTimeInput(dateValue, timeValue),
    [dateValue, timeValue]
  );

  const reading = useMemo(
    () => generateJapaneseDateTimeReading(localDateTime, { hourFormat }),
    [hourFormat, localDateTime]
  );

  const copyText = async (target: CopyTarget, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopyMessage(COPY_SUCCESS_LABEL[target]);
      setTimeout(() => setCopyMessage(null), 2000);
    } catch (error) {
      console.error('Clipboard copy failed:', error);
      setCopyMessage('Copy failed. Please copy manually.');
      setTimeout(() => setCopyMessage(null), 3000);
    }
  };

  const handlePlayClick = () => {
    setAudioMessage('Audio clip playback is enabled in the next phase.');
    setTimeout(() => setAudioMessage(null), 3000);
  };

  return (
    <div className="space-y-5">
      <section className="card retro-paper-panel">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="retro-headline text-2xl sm:text-3xl">Japanese Date & Time</h1>
            <p className="text-sm sm:text-base text-[#2f4f73] mt-2">
              Convert Gregorian date/time into natural Japanese script and kana readings.
            </p>
          </div>
          <span className="inline-flex items-center rounded-full bg-[#e9efe8] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#26496c]">
            {surface === 'public' ? 'Public Tool' : 'In-App Tool'}
          </span>
        </div>
      </section>

      <section className="card retro-paper-panel">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
          <div className="japanese-text mt-2 rounded border border-[#173b6533] bg-[#fbf5e0] px-4 py-3 !text-[2.5rem] !leading-[1.5] text-[#15355a] sm:!text-[3rem]">
            <p>
              <RubyPart script={reading.parts.yearScript} kana={reading.parts.yearKana} />
              <RubyPart script={reading.parts.monthScript} kana={reading.parts.monthKana} />
              <RubyPart script={reading.parts.dayScript} kana={reading.parts.dayKana} />（
              <RubyPart script={reading.parts.weekdayScript} kana={reading.parts.weekdayKana} />）
            </p>
            <p className="mt-2 sm:mt-3">
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

          <button
            type="button"
            onClick={() => copyText('script', reading.fullScript)}
            className="btn-outline inline-flex items-center gap-2"
          >
            <Copy className="h-4 w-4" />
            Copy Script
          </button>

          <button
            type="button"
            onClick={() => copyText('kana', reading.fullKana)}
            className="btn-outline inline-flex items-center gap-2"
          >
            <Copy className="h-4 w-4" />
            Copy Kana
          </button>
        </div>

        {(copyMessage || audioMessage) && (
          <div className="inline-flex items-center gap-2 rounded border border-[#173b6533] bg-[#edf6eb] px-3 py-2 text-sm text-[#234868]">
            <Check className="h-4 w-4" />
            {copyMessage || audioMessage}
          </div>
        )}
      </section>
    </div>
  );
};

export default JapaneseDateToolPage;
