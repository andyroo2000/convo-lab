import {
  JLPT_LEVEL_OPTIONS,
  REGISTER_BADGE_LABELS,
  VERB_CONJUGATION_OPTIONS,
  VERB_GROUP_OPTIONS,
  type JLPTLevel,
  type VerbConjugationId,
  type VerbGroup,
} from '../logic/verbConjugation';

interface VerbPracticeControlsProps {
  countdownSeconds: number | null;
  isPowerOn: boolean;
  onPauseChange: (seconds: number) => void;
  onPowerToggle: () => void;
  onShowFuriganaToggle: () => void;
  onToggleConjugation: (conjugationId: VerbConjugationId) => void;
  onToggleJlptLevel: (level: JLPTLevel) => void;
  onToggleVerbGroup: (group: VerbGroup) => void;
  onVolumeChange: (volume: number) => void;
  pauseSeconds: number;
  selectedConjugationIds: VerbConjugationId[];
  selectedJlptLevels: JLPTLevel[];
  selectedVerbGroups: VerbGroup[];
  showFurigana: boolean;
  volumeLevel: number;
}

const PAUSE_OPTIONS = [5, 8, 12] as const;

const JlptFilters = ({
  onToggle,
  selected,
}: {
  onToggle: (level: JLPTLevel) => void;
  selected: JLPTLevel[];
}) => (
  <div className="retro-counter-control-group" role="group" aria-label="JLPT level filters">
    <span className="retro-counter-control-label">JLPT Levels</span>
    <div className="retro-verb-filter-row">
      {JLPT_LEVEL_OPTIONS.map((level) => {
        const isActive = selected.includes(level);
        return (
          <button
            key={level}
            type="button"
            onClick={() => onToggle(level)}
            className={`retro-verb-filter-chip ${isActive ? 'is-active' : ''}`}
            aria-pressed={isActive}
          >
            {level}
          </button>
        );
      })}
    </div>
  </div>
);

const VerbGroupFilters = ({
  onToggle,
  selected,
}: {
  onToggle: (group: VerbGroup) => void;
  selected: VerbGroup[];
}) => (
  <div className="retro-counter-control-group" role="group" aria-label="Verb group filters">
    <span className="retro-counter-control-label">Verb Groups</span>
    <div className="retro-verb-filter-row">
      {VERB_GROUP_OPTIONS.map((group) => {
        const isActive = selected.includes(group);
        return (
          <button
            key={group}
            type="button"
            onClick={() => onToggle(group)}
            className={`retro-verb-filter-chip ${isActive ? 'is-active' : ''}`}
            aria-pressed={isActive}
          >
            Group {group}
          </button>
        );
      })}
    </div>
  </div>
);

const ConjugationFilters = ({
  onToggle,
  selected,
}: {
  onToggle: (conjugationId: VerbConjugationId) => void;
  selected: VerbConjugationId[];
}) => (
  <div className="retro-counter-control-group" role="group" aria-label="Conjugation filters">
    <span className="retro-counter-control-label">Conjugation Targets</span>
    <div className="retro-verb-filter-grid">
      {VERB_CONJUGATION_OPTIONS.map((conjugation) => {
        const isActive = selected.includes(conjugation.id);
        return (
          <button
            key={conjugation.id}
            type="button"
            onClick={() => onToggle(conjugation.id)}
            className={`retro-verb-conjugation-btn ${isActive ? 'is-active' : ''}`}
            aria-pressed={isActive}
            aria-label={conjugation.label}
          >
            <span className="retro-verb-conjugation-btn-title">{conjugation.label}</span>
            <span className="retro-verb-conjugation-btn-meta">
              {conjugation.registers.map((register) => REGISTER_BADGE_LABELS[register]).join(' • ')}
            </span>
          </button>
        );
      })}
    </div>
  </div>
);

const CountdownControls = ({
  countdownSeconds,
  isPowerOn,
  onPowerToggle,
  pauseSeconds,
}: Pick<
  VerbPracticeControlsProps,
  'countdownSeconds' | 'isPowerOn' | 'onPowerToggle' | 'pauseSeconds'
>) => {
  const normalizedSeconds =
    countdownSeconds === null
      ? pauseSeconds
      : Math.max(0, Math.min(pauseSeconds, countdownSeconds));
  const elapsedSeconds = Math.max(0, pauseSeconds - normalizedSeconds);

  return (
    <div className="retro-counter-control-group" role="group" aria-label="Quiz controls">
      <span className="retro-counter-control-label">Quiz Controls</span>
      <div className="retro-counter-control-buttons">
        <div className="retro-counter-control-stack">
          <div className="retro-counter-countdown-led-row" aria-hidden="true">
            {Array.from({ length: pauseSeconds }, (_, index) => {
              const indexFromRight = pauseSeconds - 1 - index;
              const activeClass = indexFromRight < elapsedSeconds ? 'is-red' : 'is-green';
              const stateClass = isPowerOn ? activeClass : 'is-off';
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
            onClick={onPowerToggle}
            className={`retro-counter-control-btn ${isPowerOn ? 'is-active' : ''}`}
            aria-pressed={isPowerOn}
          >
            {isPowerOn ? 'Stop Loop' : 'Auto-Loop'}
          </button>
        </div>
      </div>
    </div>
  );
};

const PauseControls = ({
  onChange,
  pauseSeconds,
}: {
  onChange: (seconds: number) => void;
  pauseSeconds: number;
}) => (
  <div className="retro-counter-control-group" role="group" aria-label="Pause length">
    <span className="retro-counter-control-label">Pause Length (Auto-Loop)</span>
    <div className="retro-counter-pause-grid">
      {PAUSE_OPTIONS.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={`retro-counter-pause-btn ${pauseSeconds === option ? 'is-active' : ''}`}
          aria-pressed={pauseSeconds === option}
        >
          {option}
        </button>
      ))}
    </div>
  </div>
);

const VerbPracticeControls = ({
  countdownSeconds,
  isPowerOn,
  onPauseChange,
  onPowerToggle,
  onShowFuriganaToggle,
  onToggleConjugation,
  onToggleJlptLevel,
  onToggleVerbGroup,
  onVolumeChange,
  pauseSeconds,
  selectedConjugationIds,
  selectedJlptLevels,
  selectedVerbGroups,
  showFurigana,
  volumeLevel,
}: VerbPracticeControlsProps) => (
  <div className="retro-verb-controls-panel">
    <JlptFilters onToggle={onToggleJlptLevel} selected={selectedJlptLevels} />
    <VerbGroupFilters onToggle={onToggleVerbGroup} selected={selectedVerbGroups} />
    <ConjugationFilters onToggle={onToggleConjugation} selected={selectedConjugationIds} />
    <CountdownControls
      countdownSeconds={countdownSeconds}
      isPowerOn={isPowerOn}
      onPowerToggle={onPowerToggle}
      pauseSeconds={pauseSeconds}
    />
    <PauseControls onChange={onPauseChange} pauseSeconds={pauseSeconds} />
    <div className="retro-counter-control-group" role="group" aria-label="Volume">
      <span className="retro-counter-control-label">Volume</span>
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
    <div className="retro-counter-control-group" role="group" aria-label="Display options">
      <span className="retro-counter-control-label">Display</span>
      <button
        type="button"
        onClick={onShowFuriganaToggle}
        className={`retro-toggle-button ${showFurigana ? 'is-on' : ''}`}
        title={showFurigana ? 'Hide furigana' : 'Show furigana'}
        aria-pressed={showFurigana}
      >
        <span className="retro-toggle-switch" aria-hidden="true" />
        <span>Furigana</span>
      </button>
    </div>
  </div>
);

export default VerbPracticeControls;
