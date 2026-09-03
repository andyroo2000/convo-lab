import { useMemo } from 'react';

import {
  generateJapaneseDateTimeReading,
  parseLocalDateTimeInput,
  toLocalDateInputValue,
} from '../../japaneseDate/logic/readingEngine';
import type { TimePracticeCard } from '../logic/types';
import TimePracticeClockRadio from './TimePracticeClockRadio';
import { getTimePracticeStatusText } from './useTimePracticeAudio';

const toTwoDigits = (value: number) => String(value).padStart(2, '0');

interface TimePracticePanelProps {
  card: TimePracticeCard;
  countdownSeconds: number | null;
  isNextLedActive: boolean;
  isPlaying: boolean;
  isPowerOn: boolean;
  isRevealed: boolean;
  pauseSeconds: number;
  playbackHint: string | null;
  volumeLevel: number;
  onNext: () => void;
  onPauseChange: (seconds: number) => void;
  onPowerToggle: () => void;
  onVolumeChange: (volume: number) => void;
}

const TimePracticePanel = ({
  card,
  countdownSeconds,
  isNextLedActive,
  isPlaying,
  isPowerOn,
  isRevealed,
  pauseSeconds,
  playbackHint,
  volumeLevel,
  onNext,
  onPauseChange,
  onPowerToggle,
  onVolumeChange,
}: TimePracticePanelProps) => {
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
  const statusText = getTimePracticeStatusText({
    countdownSeconds,
    isPlaying,
    isPowerOn,
    isRevealed,
  });

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
          autoPlayButtonLabel={isPowerOn ? 'Stop' : 'Auto-Play'}
          digitalDisplay={`${toTwoDigits(card.hour24)}:${toTwoDigits(card.minute)}`}
          isNextLedActive={isNextLedActive}
          isPowerOn={isPowerOn}
          nextButtonAriaLabel={isRevealed ? 'Advance to the next item' : 'Show answer'}
          nextButtonLabel={isRevealed ? 'Next' : 'Show Answer'}
          onNext={onNext}
          onPauseChange={onPauseChange}
          onPowerToggle={onPowerToggle}
          onVolumeChange={onVolumeChange}
          pauseSeconds={pauseSeconds}
          reading={reading}
          shouldShowScript={isRevealed}
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

export default TimePracticePanel;
