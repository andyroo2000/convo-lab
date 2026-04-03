import { useCallback, useEffect, useRef, useState } from 'react';

import useToolArrowKeyNavigation from '../../hooks/useToolArrowKeyNavigation';
import { playVerbAudioClip } from '../logic/preRenderedVerbAudio';
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
  showFurigana?: boolean;
}

interface VerbCardSnapshot {
  card: VerbPracticeCard | null;
  isRevealed: boolean;
}

const PAUSE_OPTIONS = [5, 8, 12] as const;
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

const RubyPart = ({ script, kana, showFurigana = true }: RubyPartProps) => {
  const rubyParts = buildRubyParts(script, kana);
  if (!rubyParts) {
    return <span className="mr-1">{script}</span>;
  }

  return (
    <span className="mr-1">
      {rubyParts.prefix}
      <ruby>
        {rubyParts.kanjiPart}
        <rt className={`${RUBY_RT_CLASS}${showFurigana ? '' : ' invisible'}`}>
          {rubyParts.reading}
        </rt>
      </ruby>
      {rubyParts.suffix}
    </span>
  );
};

const buildCardHistoryKey = (card: VerbPracticeCard): string =>
  `${card.verb.id}:${card.conjugation.id}`;

const JapaneseVerbConjugationToolPage = () => {
  const [showFurigana, setShowFurigana] = useState(true);
  const [selectedJlptLevels, setSelectedJlptLevels] = useState<JLPTLevel[]>(DEFAULT_JLPT_LEVELS);
  const [selectedVerbGroups, setSelectedVerbGroups] = useState<VerbGroup[]>(DEFAULT_VERB_GROUPS);
  const [selectedConjugationIds, setSelectedConjugationIds] =
    useState<VerbConjugationId[]>(DEFAULT_CONJUGATION_IDS);
  const [card, setCard] = useState<VerbPracticeCard | null>(() =>
    createVerbPracticeCard(DEFAULT_JLPT_LEVELS, DEFAULT_VERB_GROUPS, DEFAULT_CONJUGATION_IDS)
  );
  const [isRevealed, setIsRevealed] = useState(false);
  const [isPowerOn, setIsPowerOn] = useState(false);
  const [volumeLevel, setVolumeLevel] = useState<number>(1);
  const [pauseSeconds, setPauseSeconds] = useState<number>(8);
  const [countdownSeconds, setCountdownSeconds] = useState<number | null>(null);
  const [isNextLedActive, setIsNextLedActive] = useState(false);
  const [playbackHint, setPlaybackHint] = useState<string | null>(null);

  // Volume is read from a ref inside playCurrentCardAudio so that changing the
  // slider doesn't cascade through useCallback deps and restart the auto-loop.
  const volumeRef = useRef(volumeLevel);
  volumeRef.current = volumeLevel;

  const previousCardsRef = useRef<VerbCardSnapshot[]>([]);
  const recentCardKeysRef = useRef<string[]>([]);
  const revealTimerRef = useRef<number | null>(null);
  const autoAdvanceTimerRef = useRef<number | null>(null);
  const countdownIntervalRef = useRef<number | null>(null);
  const nextLedTimerRef = useRef<number | null>(null);
  const playbackRef = useRef<ReturnType<typeof playVerbAudioClip> | null>(null);
  const isFirstPowerOnRef = useRef(true);
  // Tracks the previous isPowerOn value so the auto-loop effect can distinguish
  // an on→off transition (needs cleanup) from an already-off re-render (no-op).
  const wasPowerOnRef = useRef(false);

  const statusText = (() => {
    if (!isPowerOn || countdownSeconds === null) return '';
    if (!isRevealed) return `answer in ${countdownSeconds}s`;
    return `next card in ${countdownSeconds}s`;
  })();

  const clearRevealTimer = useCallback(() => {
    if (revealTimerRef.current !== null) {
      window.clearTimeout(revealTimerRef.current);
      revealTimerRef.current = null;
    }
  }, []);

  const clearAutoAdvanceTimer = useCallback(() => {
    if (autoAdvanceTimerRef.current !== null) {
      window.clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }
  }, []);

  const clearCountdownInterval = useCallback(() => {
    if (countdownIntervalRef.current !== null) {
      window.clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  }, []);

  const clearNextLedTimer = useCallback(() => {
    if (nextLedTimerRef.current !== null) {
      window.clearTimeout(nextLedTimerRef.current);
      nextLedTimerRef.current = null;
    }
  }, []);

  const pushCurrentCardToHistory = useCallback(() => {
    previousCardsRef.current.push({ card, isRevealed });
    if (previousCardsRef.current.length > HISTORY_LIMIT) {
      previousCardsRef.current.shift();
    }
  }, [card, isRevealed]);

  const stopPlayback = useCallback(() => {
    playbackRef.current?.stop();
    playbackRef.current = null;
  }, []);

  const playCurrentCardAudio = useCallback(async () => {
    stopPlayback();

    if (!card) return;

    let currentPlayback: ReturnType<typeof playVerbAudioClip> | null = null;

    try {
      const playback = playVerbAudioClip(
        { verb: card.verb, conjugation: card.conjugation },
        { volume: volumeRef.current }
      );
      currentPlayback = playback;
      playbackRef.current = playback;
      setPlaybackHint(null);
      await playback.finished;
    } catch (error) {
      const isAbort = error instanceof DOMException && error.name === 'AbortError';
      if (!isAbort) {
        setPlaybackHint('Audio playback failed. Tap Show Answer or Next to retry.');
      }
    } finally {
      if (currentPlayback && playbackRef.current === currentPlayback) {
        playbackRef.current = null;
      }
    }
  }, [card, stopPlayback]);

  const revealCard = useCallback(() => {
    setIsRevealed(true);
    playCurrentCardAudio();
  }, [playCurrentCardAudio]);

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

    clearNextLedTimer();
    setIsNextLedActive(true);
    nextLedTimerRef.current = window.setTimeout(() => {
      setIsNextLedActive(false);
      nextLedTimerRef.current = null;
    }, 1000);

    clearAutoAdvanceTimer();
    clearRevealTimer();
    clearCountdownInterval();
    stopPlayback();
    setCountdownSeconds(null);

    if (isRevealed) {
      pushCurrentCardToHistory();
      advanceToNextCard();
      return;
    }

    pushCurrentCardToHistory();
    revealCard();
  }, [
    advanceToNextCard,
    card,
    clearAutoAdvanceTimer,
    clearCountdownInterval,
    clearNextLedTimer,
    clearRevealTimer,
    isRevealed,
    pushCurrentCardToHistory,
    revealCard,
    stopPlayback,
  ]);

  const handlePrevious = useCallback(() => {
    clearAutoAdvanceTimer();
    clearRevealTimer();
    clearCountdownInterval();
    clearNextLedTimer();
    stopPlayback();
    setIsNextLedActive(false);
    setCountdownSeconds(null);

    const previousCard = previousCardsRef.current.pop();
    if (!previousCard) {
      return;
    }

    setCard(previousCard.card);
    setIsRevealed(previousCard.isRevealed);
  }, [
    clearAutoAdvanceTimer,
    clearCountdownInterval,
    clearNextLedTimer,
    clearRevealTimer,
    stopPlayback,
  ]);

  useToolArrowKeyNavigation({
    onNext: handleNext,
    onPrevious: handlePrevious,
  });

  // Auto-loop effect
  useEffect(() => {
    const wasPowerOn = wasPowerOnRef.current;
    wasPowerOnRef.current = isPowerOn;

    clearAutoAdvanceTimer();
    clearRevealTimer();
    clearCountdownInterval();

    if (!isPowerOn) {
      if (wasPowerOn) {
        clearNextLedTimer();
        stopPlayback();
        setIsNextLedActive(false);
      }
      setCountdownSeconds(null);
      return undefined;
    }

    // Guards against stale closures: if React re-runs this effect before the
    // timeout fires, the cleanup function sets cancelled = true so the old
    // callback becomes a no-op.
    let cancelled = false;

    if (!isRevealed && isFirstPowerOnRef.current) {
      isFirstPowerOnRef.current = false;
      setCountdownSeconds(null);
      revealCard();
      return undefined;
    }

    setCountdownSeconds(pauseSeconds);
    countdownIntervalRef.current = window.setInterval(() => {
      setCountdownSeconds((current) => {
        if (current === null) return null;
        return Math.max(0, current - 1);
      });
    }, 1000);

    if (isRevealed) {
      autoAdvanceTimerRef.current = window.setTimeout(() => {
        if (!cancelled) {
          setCountdownSeconds(null);
          advanceToNextCard();
        }
      }, pauseSeconds * 1000);
    } else {
      revealTimerRef.current = window.setTimeout(() => {
        if (!cancelled) {
          setCountdownSeconds(null);
          revealCard();
        }
      }, pauseSeconds * 1000);
    }

    return () => {
      cancelled = true;
      clearAutoAdvanceTimer();
      clearRevealTimer();
      clearCountdownInterval();
    };
    // card?.id restarts the countdown cycle when the active card changes (e.g. after advancing)
  }, [
    advanceToNextCard,
    card?.id,
    clearAutoAdvanceTimer,
    clearCountdownInterval,
    clearNextLedTimer,
    clearRevealTimer,
    isPowerOn,
    isRevealed,
    pauseSeconds,
    revealCard,
    stopPlayback,
  ]);

  // Cleanup on unmount
  useEffect(
    () => () => {
      clearRevealTimer();
      clearAutoAdvanceTimer();
      clearCountdownInterval();
      clearNextLedTimer();
      stopPlayback();
    },
    [
      clearAutoAdvanceTimer,
      clearCountdownInterval,
      clearNextLedTimer,
      clearRevealTimer,
      stopPlayback,
    ]
  );

  // Filter change effect
  useEffect(() => {
    previousCardsRef.current = [];
    recentCardKeysRef.current = [];
    // Reset so the next power-on after a filter change immediately reveals
    // rather than waiting a full countdown cycle.
    isFirstPowerOnRef.current = true;
    stopPlayback();
    clearAutoAdvanceTimer();
    clearRevealTimer();
    clearCountdownInterval();
    clearNextLedTimer();
    setIsNextLedActive(false);
    setCountdownSeconds(null);
    setIsRevealed(false);
    setCard(createVerbPracticeCard(selectedJlptLevels, selectedVerbGroups, selectedConjugationIds));
  }, [
    clearAutoAdvanceTimer,
    clearCountdownInterval,
    clearNextLedTimer,
    clearRevealTimer,
    selectedConjugationIds,
    selectedJlptLevels,
    selectedVerbGroups,
    stopPlayback,
  ]);

  const nextButtonLabel = isRevealed ? 'Next' : 'Show Answer';
  const autoPlayButtonLabel = isPowerOn ? 'Stop Loop' : 'Auto-Loop';
  const normalizedCountdownSeconds =
    countdownSeconds === null
      ? pauseSeconds
      : Math.max(0, Math.min(pauseSeconds, countdownSeconds));
  const elapsedCountdownSeconds = Math.max(0, pauseSeconds - normalizedCountdownSeconds);

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
                  <p className="retro-verb-status" aria-live="polite">
                    {statusText || '\u00A0'}
                  </p>

                  <p className="japanese-text retro-verb-dictionary-form" aria-live="polite">
                    <RubyPart
                      script={card.verb.dictionary}
                      kana={card.verb.reading}
                      showFurigana={showFurigana}
                    />
                  </p>
                  <p className="retro-verb-meaning">{card.verb.meaning}</p>

                  <div className="retro-verb-badge-row mt-2">
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

                  {card.conjugation.promptHint && (
                    <p className="retro-verb-prompt-hint" data-testid="verb-colloquial-hint">
                      {card.conjugation.promptHint}
                    </p>
                  )}

                  <div className="retro-verb-answer-slot">
                    {isRevealed && (
                      <>
                        <p className="japanese-text retro-verb-answer" aria-live="polite">
                          <RubyPart
                            script={card.answer.script}
                            kana={card.answer.reading}
                            showFurigana={showFurigana}
                          />
                        </p>
                        {card.referenceAnswer && (
                          <p className="retro-verb-reference-answer">
                            Textbook: {card.referenceAnswer.script} ({card.referenceAnswer.reading})
                          </p>
                        )}
                        <div className="retro-verb-badge-row mt-2">
                          <span
                            className={`retro-verb-badge ${GROUP_BADGE_CLASSES[card.verb.group]}`}
                          >
                            Group {card.verb.group}
                          </span>
                          <span className="retro-verb-badge retro-verb-badge-jlpt">
                            {card.verb.jlptLevel}
                          </span>
                        </div>
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
              <span
                className={`retro-clock-radio-led retro-clock-radio-led-next ${isNextLedActive ? 'is-flash' : ''}`}
              />
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

            <div className="retro-counter-control-group" role="group" aria-label="Quiz controls">
              <span className="retro-counter-control-label">Quiz Controls</span>
              <div className="retro-counter-control-buttons">
                <div className="retro-counter-control-stack">
                  <div className="retro-counter-countdown-led-row" aria-hidden="true">
                    {Array.from({ length: pauseSeconds }, (_, index) => {
                      let stateClass = 'is-off';
                      if (isPowerOn) {
                        const indexFromRight = pauseSeconds - 1 - index;
                        stateClass =
                          indexFromRight < elapsedCountdownSeconds ? 'is-red' : 'is-green';
                      }

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
                    onClick={() => setIsPowerOn((current) => !current)}
                    className={`retro-counter-control-btn ${isPowerOn ? 'is-active' : ''}`}
                    aria-pressed={isPowerOn}
                  >
                    {autoPlayButtonLabel}
                  </button>
                </div>
              </div>
            </div>

            <div className="retro-counter-control-group" role="group" aria-label="Pause length">
              <span className="retro-counter-control-label">Pause Length (Auto-Loop)</span>
              <div className="retro-counter-pause-grid">
                {PAUSE_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setPauseSeconds(option)}
                    className={`retro-counter-pause-btn ${pauseSeconds === option ? 'is-active' : ''}`}
                    aria-pressed={pauseSeconds === option}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            <div className="retro-counter-control-group" role="group" aria-label="Volume">
              <span className="retro-counter-control-label">Volume</span>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={Math.round(volumeLevel * 100)}
                onChange={(event) => {
                  const nextVolume = Number(event.target.value) / 100;
                  setVolumeLevel(nextVolume);
                  playbackRef.current?.setVolume(nextVolume);
                }}
                className="retro-clock-radio-volume-slider"
                aria-label={`Volume ${Math.round(volumeLevel * 100)} percent`}
              />
            </div>

            <div className="retro-counter-control-group" role="group" aria-label="Display options">
              <span className="retro-counter-control-label">Display</span>
              <button
                type="button"
                onClick={() => setShowFurigana((current) => !current)}
                className={`retro-toggle-button ${showFurigana ? 'is-on' : ''}`}
                title={showFurigana ? 'Hide furigana' : 'Show furigana'}
                aria-pressed={showFurigana}
              >
                <span className="retro-toggle-switch" aria-hidden="true" />
                <span>Furigana</span>
              </button>
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
              Use <span className="retro-caps text-[#15355a]">Auto-Loop</span> for continuous random
              drills.
            </li>
            <li>
              For <span className="retro-caps text-[#15355a]">Potential (Colloquial)</span> cards,
              answer with the spoken contraction.
            </li>
          </ul>
        </div>
        {playbackHint && <p className="mt-3 text-sm text-[#9e4c2a]">{playbackHint}</p>}
      </section>
    </div>
  );
};

export default JapaneseVerbConjugationToolPage;
