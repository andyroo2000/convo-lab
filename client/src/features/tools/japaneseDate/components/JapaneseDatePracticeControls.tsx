import type { JapaneseDateNavigation } from './useJapaneseDateNavigation';
import type { JapaneseDatePracticeState } from './useJapaneseDatePracticeState';

const PAUSE_OPTIONS = [5, 8, 12] as const;

const AutoplayControl = ({ state }: { state: JapaneseDatePracticeState }) => (
  <div className="retro-clock-radio-autoplay-stack">
    <span className={`retro-clock-radio-led ${state.isPowerOn ? 'is-on' : 'is-off'}`} />
    <button
      type="button"
      onClick={() => state.setIsPowerOn((current) => !current)}
      className={`retro-clock-radio-action retro-clock-radio-transport-action ${state.isPowerOn ? 'is-active' : ''}`}
      aria-pressed={state.isPowerOn}
    >
      {state.isPowerOn ? 'Stop' : 'Auto-Play'}
    </button>
  </div>
);

const NextControl = ({
  state,
  navigation,
}: {
  state: JapaneseDatePracticeState;
  navigation: JapaneseDateNavigation;
}) => (
  <div className="retro-clock-radio-next-stack">
    <span
      className={`retro-clock-radio-led retro-clock-radio-led-next ${state.isNextLedActive ? 'is-flash' : ''}`}
    />
    <button
      type="button"
      onClick={navigation.handleNext}
      className="retro-clock-radio-action retro-clock-radio-transport-action"
      aria-label={state.isRevealed ? 'Advance to the next item' : 'Show answer'}
    >
      {state.isRevealed ? 'Next' : 'Show Answer'}
    </button>
  </div>
);

const VolumeControl = ({ state }: { state: JapaneseDatePracticeState }) => (
  <div className="retro-clock-radio-volume" role="group" aria-label="Volume">
    <span className="retro-clock-radio-control-label">Volume</span>
    <input
      type="range"
      min={0}
      max={100}
      step={1}
      value={Math.round(state.volumeLevel * 100)}
      onChange={(event) => {
        const nextVolume = Number(event.target.value) / 100;
        state.setVolumeLevel(nextVolume);
        state.playbackRef.current?.setVolume(nextVolume);
      }}
      className="retro-clock-radio-volume-slider"
      aria-label={`Volume ${Math.round(state.volumeLevel * 100)} percent`}
    />
  </div>
);

const PauseControls = ({ state }: { state: JapaneseDatePracticeState }) => (
  <div className="retro-clock-radio-pause-group" role="group" aria-label="Pause length">
    <span className="retro-clock-radio-control-label">Pause Length (In Auto-Play Mode)</span>
    <div className="retro-clock-radio-pause-options">
      {PAUSE_OPTIONS.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => state.setPauseSeconds(option)}
          className={`retro-clock-radio-pause-button ${state.pauseSeconds === option ? 'is-active' : ''}`}
          aria-pressed={state.pauseSeconds === option}
        >
          {option}
        </button>
      ))}
    </div>
    <button
      type="button"
      onClick={() => state.setShowYear((current) => !current)}
      className={`retro-clock-radio-pause-button retro-date-year-toggle ${state.showYear ? 'is-active' : ''}`}
      aria-pressed={state.showYear}
    >
      {state.showYear ? 'Hide Year' : 'Show Year'}
    </button>
  </div>
);

const JapaneseDatePracticeControls = ({
  state,
  navigation,
}: {
  state: JapaneseDatePracticeState;
  navigation: JapaneseDateNavigation;
}) => (
  <div className="retro-clock-radio-controls">
    <div className="retro-clock-radio-transport">
      <AutoplayControl state={state} />
      <NextControl state={state} navigation={navigation} />
    </div>
    <VolumeControl state={state} />
    <PauseControls state={state} />
  </div>
);

export default JapaneseDatePracticeControls;
