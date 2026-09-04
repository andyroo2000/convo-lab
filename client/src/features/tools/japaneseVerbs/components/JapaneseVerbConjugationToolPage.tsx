import VerbPracticeCardPanel from './VerbPracticeCard';
import VerbPracticeControls from './VerbPracticeControls';
import useVerbPracticeController from './useVerbPracticeController';

export { FURIGANA_STORAGE_KEY } from './useVerbPracticeController';

const JapaneseVerbConjugationToolPage = () => {
  const practice = useVerbPracticeController();

  return (
    <div className="space-y-5">
      <section className="card retro-paper-panel !p-3 sm:!p-5 lg:!p-6">
        <div className="mb-5 rounded border-2 border-[#0f3561] bg-gradient-to-br from-[#102d57] via-[#143b6f] to-[#184779] px-4 pt-6 pb-7 text-[#f7f6ef] shadow-[0_6px_0_rgba(17,51,92,0.26)] sm:px-5 sm:pt-7 sm:pb-8">
          <p className="pb-3 text-[clamp(1.1rem,0.95rem+1.8vw,2.5rem)] font-semibold leading-[1.05] tracking-[0.04em] text-[#8fd3ea]">
            日本語動詞活用トレーナー
          </p>
          <p className="retro-headline mt-1 text-[clamp(1.25rem,0.95rem+1.7vw,2.05rem)] leading-[1.08] text-[#f9f8ed]">
            Japanese Verb Conjugation Tool
          </p>
          <p className="mt-2 text-[0.79rem] font-semibold leading-tight text-[#d3ecf4] sm:text-base">
            Read the dictionary form, then reveal and check the target conjugation.
          </p>
        </div>

        <div className="retro-verb-layout">
          <VerbPracticeCardPanel
            card={practice.card}
            isNextLedActive={practice.isNextLedActive}
            isRevealed={practice.isRevealed}
            onNext={practice.handleNext}
            showFurigana={practice.showFurigana}
            statusText={practice.statusText}
          />

          <VerbPracticeControls
            countdownSeconds={practice.countdownSeconds}
            isPowerOn={practice.isPowerOn}
            onPauseChange={practice.setPauseSeconds}
            onPowerToggle={practice.onPowerToggle}
            onShowFuriganaToggle={() => practice.setShowFurigana((current) => !current)}
            onToggleConjugation={practice.onToggleConjugation}
            onToggleJlptLevel={practice.onToggleJlptLevel}
            onToggleVerbGroup={practice.onToggleVerbGroup}
            onVolumeChange={practice.onVolumeChange}
            pauseSeconds={practice.pauseSeconds}
            selectedConjugationIds={practice.selectedConjugationIds}
            selectedJlptLevels={practice.selectedJlptLevels}
            selectedVerbGroups={practice.selectedVerbGroups}
            showFurigana={practice.showFurigana}
            volumeLevel={practice.volumeLevel}
          />
        </div>

        <div className="mt-4 rounded border border-[#173b6538] bg-[#edf5f9] px-3 py-3 shadow-[0_3px_0_rgba(17,51,92,0.12)] sm:px-4">
          <ul className="list-disc pl-5 text-sm font-semibold leading-snug text-[#1b3f69] sm:text-[0.96rem]">
            <li>
              Use <span className="retro-caps text-[#15355a]">Show Answer + Next</span> for
              deliberate conjugation drills.
            </li>
            <li>
              Use <span className="retro-caps text-[#15355a]">Auto-Loop</span> for continuous random
              drills.
            </li>
            <li>
              For <span className="retro-caps text-[#15355a]">Potential (Colloquial)</span> cards,
              answer with the spoken contraction.
            </li>
          </ul>
        </div>
        {practice.playbackHint && (
          <p className="mt-3 text-sm text-[#9e4c2a]">{practice.playbackHint}</p>
        )}
      </section>
    </div>
  );
};

export default JapaneseVerbConjugationToolPage;
