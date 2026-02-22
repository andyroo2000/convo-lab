import { useCallback, useEffect, useRef, useState } from 'react';

import useToolArrowKeyNavigation from '../../hooks/useToolArrowKeyNavigation';
import {
  CONJUGATION_BADGE_LABELS,
  createVerbPracticeCard,
  DEFAULT_CONJUGATION_IDS,
  DEFAULT_JLPT_LEVELS,
  DEFAULT_VERB_GROUPS,
  JLPT_LEVEL_OPTIONS,
  REGISTER_BADGE_LABELS,
  toggleSelection,
  VERB_CONJUGATION_OPTIONS,
  VERB_GROUP_OPTIONS,
  type JLPTLevel,
  type RegisterBadge,
  type VerbConjugationId,
  type VerbPracticeCard,
  type VerbGroup,
} from '../logic/verbConjugation';

interface RubyPartProps {
  script: string;
  kana: string;
}

interface VerbCardSnapshot {
  card: VerbPracticeCard | null;
  isRevealed: boolean;
}

const RUBY_RT_CLASS = '!text-[0.34em] sm:!text-[0.27em]';
const HISTORY_LIMIT = 120;
const RECENT_CARD_HISTORY_LIMIT = 18;
const KANJI_REGEX = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff々]/u;
const HIRAGANA_REGEX = /[\u3040-\u309f]/u;
const KATAKANA_REGEX = /[\u30a0-\u30ff]/u;

const GROUP_BADGE_CLASSES: Record<VerbGroup, string> = {
  '1': 'retro-verb-badge-group-1',
  '2': 'retro-verb-badge-group-2',
  '3': 'retro-verb-badge-group-3',
};

const REGISTER_BADGE_CLASSES: Record<RegisterBadge, string> = {
  formal: 'retro-verb-badge-register-formal',
  casual: 'retro-verb-badge-register-casual',
  spoken: 'retro-verb-badge-register-spoken',
  colloquial: 'retro-verb-badge-register-colloquial',
};

const isKana = (char: string): boolean => HIRAGANA_REGEX.test(char) || KATAKANA_REGEX.test(char);

const buildRubyParts = (
  script: string,
  kana: string
): {
  prefix: string;
  kanjiPart: string;
  suffix: string;
  reading: string;
} | null => {
  if (!KANJI_REGEX.test(script)) {
    return null;
  }

  let kanjiStart = 0;
  while (kanjiStart < script.length && isKana(script[kanjiStart])) {
    kanjiStart += 1;
  }

  let kanjiEnd = script.length;
  while (kanjiEnd > kanjiStart && isKana(script[kanjiEnd - 1])) {
    kanjiEnd -= 1;
  }

  if (kanjiStart >= kanjiEnd) {
    return null;
  }

  const prefix = script.slice(0, kanjiStart);
  const kanjiPart = script.slice(kanjiStart, kanjiEnd);
  const suffix = script.slice(kanjiEnd);

  let adjustedReading = kana;
  if (prefix && adjustedReading.startsWith(prefix)) {
    adjustedReading = adjustedReading.slice(prefix.length);
  }
  if (suffix && adjustedReading.endsWith(suffix)) {
    adjustedReading = adjustedReading.slice(0, adjustedReading.length - suffix.length);
  }

  if (!adjustedReading) {
    return null;
  }

  return {
    prefix,
    kanjiPart,
    suffix,
    reading: adjustedReading,
  };
};

const RubyPart = ({ script, kana }: RubyPartProps) => {
  const rubyParts = buildRubyParts(script, kana);
  if (!rubyParts) {
    return <span className="mr-1">{script}</span>;
  }

  return (
    <span className="mr-1">
      {rubyParts.prefix}
      <ruby>
        {rubyParts.kanjiPart}
        <rt className={RUBY_RT_CLASS}>{rubyParts.reading}</rt>
      </ruby>
      {rubyParts.suffix}
    </span>
  );
};

const buildCardHistoryKey = (card: VerbPracticeCard): string =>
  `${card.verb.id}:${card.conjugation.id}`;

const JapaneseVerbConjugationToolPage = () => {
  const [selectedJlptLevels, setSelectedJlptLevels] = useState<JLPTLevel[]>(DEFAULT_JLPT_LEVELS);
  const [selectedVerbGroups, setSelectedVerbGroups] = useState<VerbGroup[]>(DEFAULT_VERB_GROUPS);
  const [selectedConjugationIds, setSelectedConjugationIds] =
    useState<VerbConjugationId[]>(DEFAULT_CONJUGATION_IDS);
  const [card, setCard] = useState<VerbPracticeCard | null>(() =>
    createVerbPracticeCard(DEFAULT_JLPT_LEVELS, DEFAULT_VERB_GROUPS, DEFAULT_CONJUGATION_IDS)
  );
  const [isRevealed, setIsRevealed] = useState(false);

  const previousCardsRef = useRef<VerbCardSnapshot[]>([]);
  const recentCardKeysRef = useRef<string[]>([]);

  const pushCurrentCardToHistory = useCallback(() => {
    previousCardsRef.current.push({ card, isRevealed });
    if (previousCardsRef.current.length > HISTORY_LIMIT) {
      previousCardsRef.current.shift();
    }
  }, [card, isRevealed]);

  const advanceToNextCard = useCallback(() => {
    if (card) {
      const cardKey = buildCardHistoryKey(card);
      const dedupedKeys = [
        cardKey,
        ...recentCardKeysRef.current.filter((entry) => entry !== cardKey),
      ];
      recentCardKeysRef.current = dedupedKeys.slice(0, RECENT_CARD_HISTORY_LIMIT);
    }

    setIsRevealed(false);
    setCard(
      createVerbPracticeCard(
        selectedJlptLevels,
        selectedVerbGroups,
        selectedConjugationIds,
        recentCardKeysRef.current
      )
    );
  }, [card, selectedConjugationIds, selectedJlptLevels, selectedVerbGroups]);

  const handleNext = useCallback(() => {
    if (!card) {
      return;
    }

    if (isRevealed) {
      pushCurrentCardToHistory();
      advanceToNextCard();
      return;
    }

    pushCurrentCardToHistory();
    setIsRevealed(true);
  }, [advanceToNextCard, card, isRevealed, pushCurrentCardToHistory]);

  const handlePrevious = useCallback(() => {
    const previousCard = previousCardsRef.current.pop();
    if (!previousCard) {
      return;
    }

    setCard(previousCard.card);
    setIsRevealed(previousCard.isRevealed);
  }, []);

  useToolArrowKeyNavigation({
    onNext: handleNext,
    onPrevious: handlePrevious,
  });

  useEffect(() => {
    previousCardsRef.current = [];
    recentCardKeysRef.current = [];
    setIsRevealed(false);
    setCard(createVerbPracticeCard(selectedJlptLevels, selectedVerbGroups, selectedConjugationIds));
  }, [selectedConjugationIds, selectedJlptLevels, selectedVerbGroups]);

  const nextButtonLabel = isRevealed ? 'Next' : 'Show Answer';

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
          <div className="retro-verb-main-panel">
            <div className="retro-verb-sheet" role="region" aria-label="Verb conjugation quiz card">
              {card ? (
                <>
                  <div className="retro-verb-badge-row">
                    <span className={`retro-verb-badge ${GROUP_BADGE_CLASSES[card.verb.group]}`}>
                      Group {card.verb.group}
                    </span>
                    <span className="retro-verb-badge retro-verb-badge-jlpt">
                      {card.verb.jlptLevel}
                    </span>
                    {card.conjugation.registers.map((register) => (
                      <span
                        key={`register-${register}`}
                        className={`retro-verb-badge ${REGISTER_BADGE_CLASSES[register]}`}
                      >
                        {REGISTER_BADGE_LABELS[register]}
                      </span>
                    ))}
                    <span className="retro-verb-badge retro-verb-badge-conjugation">
                      {CONJUGATION_BADGE_LABELS[card.conjugation.conjugationBadge]}
                    </span>
                  </div>

                  <p className="retro-verb-target-label">{card.conjugation.label}</p>
                  <p className="japanese-text retro-verb-dictionary-form" aria-live="polite">
                    <RubyPart script={card.verb.dictionary} kana={card.verb.reading} />
                  </p>
                  <p className="retro-verb-meaning">{card.verb.meaning}</p>

                  {card.conjugation.promptHint && (
                    <p className="retro-verb-prompt-hint" data-testid="verb-colloquial-hint">
                      {card.conjugation.promptHint}
                    </p>
                  )}

                  <div className="retro-verb-answer-slot">
                    {isRevealed && (
                      <>
                        <p className="japanese-text retro-verb-answer" aria-live="polite">
                          <RubyPart script={card.answer.script} kana={card.answer.reading} />
                        </p>
                        {card.referenceAnswer && (
                          <p className="retro-verb-reference-answer">
                            Textbook: {card.referenceAnswer.script} ({card.referenceAnswer.reading})
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </>
              ) : (
                <div className="retro-verb-empty-state" role="status">
                  <p className="retro-verb-empty-title">No matching cards.</p>
                  <p className="retro-verb-empty-copy">
                    Expand JLPT level, verb group, or conjugation filters to generate cards.
                  </p>
                </div>
              )}
            </div>

            <div className="retro-verb-next-row">
              <button
                type="button"
                onClick={handleNext}
                className="retro-counter-control-btn retro-verb-next-btn"
                aria-label={isRevealed ? 'Advance to the next item' : 'Show answer'}
                disabled={!card}
              >
                {nextButtonLabel}
              </button>
            </div>
          </div>

          <div className="retro-verb-controls-panel">
            <div
              className="retro-counter-control-group"
              role="group"
              aria-label="JLPT level filters"
            >
              <span className="retro-counter-control-label">JLPT Levels</span>
              <div className="retro-verb-filter-row">
                {JLPT_LEVEL_OPTIONS.map((level) => {
                  const isActive = selectedJlptLevels.includes(level);

                  return (
                    <button
                      key={level}
                      type="button"
                      onClick={() =>
                        setSelectedJlptLevels((current) => toggleSelection(current, level))
                      }
                      className={`retro-verb-filter-chip ${isActive ? 'is-active' : ''}`}
                      aria-pressed={isActive}
                    >
                      {level}
                    </button>
                  );
                })}
              </div>
            </div>

            <div
              className="retro-counter-control-group"
              role="group"
              aria-label="Verb group filters"
            >
              <span className="retro-counter-control-label">Verb Groups</span>
              <div className="retro-verb-filter-row">
                {VERB_GROUP_OPTIONS.map((group) => {
                  const isActive = selectedVerbGroups.includes(group);

                  return (
                    <button
                      key={group}
                      type="button"
                      onClick={() =>
                        setSelectedVerbGroups((current) => toggleSelection(current, group))
                      }
                      className={`retro-verb-filter-chip ${isActive ? 'is-active' : ''}`}
                      aria-pressed={isActive}
                    >
                      Group {group}
                    </button>
                  );
                })}
              </div>
            </div>

            <div
              className="retro-counter-control-group"
              role="group"
              aria-label="Conjugation filters"
            >
              <span className="retro-counter-control-label">Conjugation Targets</span>
              <div className="retro-verb-filter-grid">
                {VERB_CONJUGATION_OPTIONS.map((conjugation) => {
                  const isActive = selectedConjugationIds.includes(conjugation.id);

                  return (
                    <button
                      key={conjugation.id}
                      type="button"
                      onClick={() =>
                        setSelectedConjugationIds((current) =>
                          toggleSelection<VerbConjugationId>(current, conjugation.id)
                        )
                      }
                      className={`retro-verb-conjugation-btn ${isActive ? 'is-active' : ''}`}
                      aria-pressed={isActive}
                      aria-label={conjugation.label}
                    >
                      <span className="retro-verb-conjugation-btn-title">{conjugation.label}</span>
                      <span className="retro-verb-conjugation-btn-meta">
                        {conjugation.registers
                          .map((register) => REGISTER_BADGE_LABELS[register])
                          .join(' • ')}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 rounded border border-[#173b6538] bg-[#edf5f9] px-3 py-3 shadow-[0_3px_0_rgba(17,51,92,0.12)] sm:px-4">
          <ul className="list-disc pl-5 text-sm font-semibold leading-snug text-[#1b3f69] sm:text-[0.96rem]">
            <li>
              Use <span className="retro-caps text-[#15355a]">Show Answer + Next</span> for
              deliberate conjugation drills.
            </li>
            <li>
              For <span className="retro-caps text-[#15355a]">Potential (Colloquial)</span> cards,
              answer with the spoken contraction.
            </li>
          </ul>
        </div>
      </section>
    </div>
  );
};

export default JapaneseVerbConjugationToolPage;
