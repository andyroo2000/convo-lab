import type { JapaneseDatePracticeState } from './useJapaneseDatePracticeState';

interface RubyPartProps {
  script: string;
  kana: string;
  showFurigana: boolean;
}

const RUBY_RT_CLASS = '!text-[0.34em] sm:!text-[0.27em]';

const RubyPart = ({ script, kana, showFurigana }: RubyPartProps) => (
  <ruby className="mr-1">
    {script}
    <rt className={`${RUBY_RT_CLASS} ${showFurigana ? '' : 'invisible'}`}>{kana}</rt>
  </ruby>
);

const UnitRubyPart = ({ script, kana, showFurigana }: RubyPartProps) => {
  if (script.endsWith('年') && kana.endsWith('ねん')) {
    return (
      <span className="mr-1 inline-flex items-start">
        <ruby>
          {script.slice(0, -1)}
          <rt className={`${RUBY_RT_CLASS} ${showFurigana ? '' : 'invisible'}`}>
            {kana.slice(0, -2)}
          </rt>
        </ruby>
        <ruby>
          年<rt className={`${RUBY_RT_CLASS} ${showFurigana ? '' : 'invisible'}`}>ねん</rt>
        </ruby>
      </span>
    );
  }
  if (script.endsWith('月') && kana.endsWith('がつ')) {
    return (
      <span className="mr-1 inline-flex items-start">
        <ruby>
          {script.slice(0, -1)}
          <rt className={`${RUBY_RT_CLASS} ${showFurigana ? '' : 'invisible'}`}>
            {kana.slice(0, -2)}
          </rt>
        </ruby>
        <ruby>
          月<rt className={`${RUBY_RT_CLASS} ${showFurigana ? '' : 'invisible'}`}>がつ</rt>
        </ruby>
      </span>
    );
  }
  return <RubyPart script={script} kana={kana} showFurigana={showFurigana} />;
};

const RevealedDate = ({ state }: { state: JapaneseDatePracticeState }) => (
  <p className="japanese-text retro-clock-radio-script">
    {state.showYear && (
      <UnitRubyPart
        script={state.reading.parts.yearScript}
        kana={state.reading.parts.yearKana}
        showFurigana
      />
    )}
    <UnitRubyPart
      script={state.reading.parts.monthScript}
      kana={state.reading.parts.monthKana}
      showFurigana
    />
    <UnitRubyPart
      script={state.reading.parts.dayScript}
      kana={state.reading.parts.dayKana}
      showFurigana
    />
  </p>
);

const JapaneseDatePracticeDisplay = ({ state }: { state: JapaneseDatePracticeState }) => (
  <div className="retro-clock-radio-window">
    <div className="retro-clock-radio-glow" />
    {state.statusText && <p className="retro-clock-radio-status">{state.statusText}</p>}
    {state.isRevealed ? (
      <RevealedDate state={state} />
    ) : (
      <p className="retro-clock-radio-digital retro-clock-radio-date-digital">
        {state.dateDisplay}
      </p>
    )}
  </div>
);

export default JapaneseDatePracticeDisplay;
