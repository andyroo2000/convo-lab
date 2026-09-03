import DateMiniCalendar from './DateMiniCalendar';
import JapaneseDatePracticeControls from './JapaneseDatePracticeControls';
import JapaneseDatePracticeDisplay from './JapaneseDatePracticeDisplay';
import type { JapaneseDateNavigation } from './useJapaneseDateNavigation';
import type { JapaneseDatePracticeState } from './useJapaneseDatePracticeState';

const JapaneseDatePracticeView = ({
  state,
  navigation,
}: {
  state: JapaneseDatePracticeState;
  navigation: JapaneseDateNavigation;
}) => (
  <div className="space-y-5">
    <section className="card retro-paper-panel">
      <div className="mb-5 rounded border-2 border-[#0f3561] bg-gradient-to-br from-[#102d57] via-[#143b6f] to-[#184779] px-4 pt-6 pb-7 text-[#f7f6ef] shadow-[0_6px_0_rgba(17,51,92,0.26)] sm:px-5 sm:pt-7 sm:pb-8">
        <p className="pb-3 text-[clamp(1.45rem,1.05rem+1.8vw,2.5rem)] font-semibold leading-[1.05] tracking-[0.04em] text-[#8fd3ea]">
          日本語デートトレーナー
        </p>
        <p className="retro-headline mt-1 text-[clamp(1.4rem,1rem+1.7vw,2.05rem)] leading-[1.08] text-[#f9f8ed]">
          READ IT. <span className="mx-2 text-[#37b4d7]">LISTEN.</span> CHECK YOUR ANSWER.
        </p>
        <p className="mt-2 text-sm font-semibold leading-tight text-[#d3ecf4] sm:text-base">
          A date appears first. Say it in Japanese before reveal, then compare with the audio.
        </p>
      </div>
      <div className="retro-date-practice-layout">
        <div className="retro-date-practice-player">
          <div className="retro-clock-radio-shell">
            <div className="retro-clock-radio-body">
              <JapaneseDatePracticeDisplay state={state} />
            </div>
            <JapaneseDatePracticeControls state={state} navigation={navigation} />
          </div>
        </div>
        <DateMiniCalendar date={state.card.date} />
      </div>
      <div className="mt-4 rounded border border-[#173b6538] bg-[#edf5f9] px-3 py-3 shadow-[0_3px_0_rgba(17,51,92,0.12)] sm:px-4">
        <ul className="list-disc pl-5 text-sm font-semibold leading-snug text-[#1b3f69] sm:text-[0.96rem]">
          <li>
            Use <span className="retro-caps text-[#15355a]">SHOW ANSWER + NEXT</span> for manual
            practice at your pace.
          </li>
          <li>
            Switch to <span className="retro-caps text-[#15355a]">AUTO-PLAY</span> to get a nonstop
            quiz loop on the selected pause length.
          </li>
        </ul>
      </div>
      {state.playbackHint && <p className="mt-3 text-sm text-[#9e4c2a]">{state.playbackHint}</p>}
    </section>
  </div>
);

export default JapaneseDatePracticeView;
