import type { JapaneseDateTimeReading } from '../../japaneseDate/logic/readingEngine';

interface RubyPartProps {
  script: string;
  kana: string;
  showFurigana: boolean;
}

interface TimePracticeClockRadioProps {
  autoPlayButtonLabel: string;
  digitalDisplay: string;
  isNextLedActive: boolean;
  isPowerOn: boolean;
  nextButtonAriaLabel: string;
  nextButtonLabel: string;
  onNext: () => void;
  onPauseChange: (seconds: number) => void;
  onPowerToggle: () => void;
  onVolumeChange: (volume: number) => void;
  pauseSeconds: number;
  reading: JapaneseDateTimeReading;
  shouldShowScript: boolean;
  statusText: string;
  volumeLevel: number;
}

const PAUSE_OPTIONS = [5, 8, 12] as const;
const RUBY_RT_CLASS = '!text-[0.34em] sm:!text-[0.27em]';

const RubyPart = ({ script, kana, showFurigana }: RubyPartProps) => (
  <ruby className="mr-1">
    {script}
    <rt className={`${RUBY_RT_CLASS} ${showFurigana ? '' : 'invisible'}`}>{kana}</rt>
  </ruby>
);

const getMinuteUnitKana = (script: string, kana: string) => {
  if (!script.endsWith('分')) return null;
  return ['ふん', 'ぷん'].find((unitKana) => kana.endsWith(unitKana)) ?? null;
};

const UnitRubyPart = ({ script, kana, showFurigana }: RubyPartProps) => {
  if (script.endsWith('時') && kana.endsWith('じ')) {
    const numberScript = script.slice(0, -1);
    const numberKana = kana.slice(0, -1);
    return (
      <span className="mr-1 inline-flex items-start">
        <ruby>
          {numberScript}
          <rt className={`${RUBY_RT_CLASS} ${showFurigana ? '' : 'invisible'}`}>{numberKana}</rt>
        </ruby>
        <ruby>
          時<rt className={`${RUBY_RT_CLASS} ${showFurigana ? '' : 'invisible'}`}>じ</rt>
        </ruby>
      </span>
    );
  }

  const unitKana = getMinuteUnitKana(script, kana);
  if (unitKana) {
    const numberScript = script.slice(0, -1);
    const numberKana = kana.slice(0, -unitKana.length);
    return (
      <span className="mr-1 inline-flex items-start">
        <ruby>
          {numberScript}
          <rt className={`${RUBY_RT_CLASS} ${showFurigana ? '' : 'invisible'}`}>{numberKana}</rt>
        </ruby>
        <ruby>
          分<rt className={`${RUBY_RT_CLASS} ${showFurigana ? '' : 'invisible'}`}>{unitKana}</rt>
        </ruby>
      </span>
    );
  }

  return <RubyPart script={script} kana={kana} showFurigana={showFurigana} />;
};

const TimePracticeDisplay = ({
  digitalDisplay,
  reading,
  shouldShowScript,
  statusText,
}: Pick<
  TimePracticeClockRadioProps,
  'digitalDisplay' | 'reading' | 'shouldShowScript' | 'statusText'
>) => (
  <div className="retro-clock-radio-window">
    <div className="retro-clock-radio-glow" />
    {statusText && <p className="retro-clock-radio-status">{statusText}</p>}
    {shouldShowScript ? (
      <p className="japanese-text retro-clock-radio-script">
        <UnitRubyPart
          script={reading.parts.hourScript}
          kana={reading.parts.hourKana}
          showFurigana
        />
        <UnitRubyPart
          script={reading.parts.minuteScript}
          kana={reading.parts.minuteKana}
          showFurigana
        />
      </p>
    ) : (
      <p className="retro-clock-radio-digital">{digitalDisplay}</p>
    )}
  </div>
);

const TimePracticeControls = ({
  autoPlayButtonLabel,
  isNextLedActive,
  isPowerOn,
  nextButtonAriaLabel,
  nextButtonLabel,
  onNext,
  onPauseChange,
  onPowerToggle,
  onVolumeChange,
  pauseSeconds,
  volumeLevel,
}: Omit<
  TimePracticeClockRadioProps,
  'digitalDisplay' | 'reading' | 'shouldShowScript' | 'statusText'
>) => (
  <div className="retro-clock-radio-controls">
    <div className="retro-clock-radio-transport">
      <div className="retro-clock-radio-autoplay-stack">
        <span className={`retro-clock-radio-led ${isPowerOn ? 'is-on' : 'is-off'}`} />
        <button
          type="button"
          onClick={onPowerToggle}
          className={`retro-clock-radio-action ${isPowerOn ? 'is-active' : ''}`}
          aria-pressed={isPowerOn}
        >
          {autoPlayButtonLabel}
        </button>
      </div>
      <div className="retro-clock-radio-next-stack">
        <span
          className={`retro-clock-radio-led retro-clock-radio-led-next ${isNextLedActive ? 'is-flash' : ''}`}
        />
        <button
          type="button"
          onClick={onNext}
          className="retro-clock-radio-action"
          aria-label={nextButtonAriaLabel}
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
        onChange={(event) => onVolumeChange(Number(event.target.value) / 100)}
        className="retro-clock-radio-volume-slider"
        aria-label={`Volume ${Math.round(volumeLevel * 100)} percent`}
      />
    </div>
    <div className="retro-clock-radio-pause-group" role="group" aria-label="Pause length">
      <span className="retro-clock-radio-control-label">Pause Length (In Auto-Play Mode)</span>
      <div className="retro-clock-radio-pause-options">
        {PAUSE_OPTIONS.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onPauseChange(option)}
            className={`retro-clock-radio-pause-button ${pauseSeconds === option ? 'is-active' : ''}`}
            aria-pressed={pauseSeconds === option}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  </div>
);

const TimePracticeClockRadio = ({
  digitalDisplay,
  reading,
  shouldShowScript,
  statusText,
  ...controlProps
}: TimePracticeClockRadioProps) => (
  <div className="retro-clock-radio-shell">
    <div className="retro-clock-radio-body">
      <TimePracticeDisplay
        digitalDisplay={digitalDisplay}
        reading={reading}
        shouldShowScript={shouldShowScript}
        statusText={statusText}
      />
    </div>
    <TimePracticeControls {...controlProps} />
  </div>
);

export default TimePracticeClockRadio;
