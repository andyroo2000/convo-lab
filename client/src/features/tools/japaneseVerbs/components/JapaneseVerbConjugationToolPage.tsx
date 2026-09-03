import { useCallback, useEffect, useRef, useState } from 'react';

import useToolArrowKeyNavigation from '../../hooks/useToolArrowKeyNavigation';
import VerbPracticeCardPanel from './VerbPracticeCard';
import VerbPracticeControls from './VerbPracticeControls';
import { playVerbAudioClip } from '../logic/preRenderedVerbAudio';
import {
  createVerbPracticeCard,
  DEFAULT_CONJUGATION_IDS,
  DEFAULT_JLPT_LEVELS,
  DEFAULT_VERB_GROUPS,
  toggleSelection,
  type JLPTLevel,
  type VerbConjugationId,
  type VerbPracticeCard,
  type VerbGroup,
} from '../logic/verbConjugation';

interface VerbCardSnapshot {
  card: VerbPracticeCard | null;
  isRevealed: boolean;
}

const HISTORY_LIMIT = 120;
const RECENT_CARD_HISTORY_LIMIT = 18;
const buildCardHistoryKey = (card: VerbPracticeCard): string =>
  `${card.verb.id}:${card.conjugation.id}`;

export const FURIGANA_STORAGE_KEY = 'convolab:japanese-verbs:show-furigana';

const loadShowFurigana = (): boolean => {
  try {
    return window.localStorage.getItem(FURIGANA_STORAGE_KEY) !== 'false';
  } catch {
    return true;
  }
};

const JapaneseVerbConjugationToolPage = () => {
  const [showFurigana, setShowFurigana] = useState(loadShowFurigana);
  const isInitialFuriganaRender = useRef(true);

  useEffect(() => {
    if (isInitialFuriganaRender.current) {
      isInitialFuriganaRender.current = false;
      return;
    }
    try {
      window.localStorage.setItem(FURIGANA_STORAGE_KEY, String(showFurigana));
    } catch {
      // Ignore storage write errors (quota/private mode).
    }
  }, [showFurigana]);

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
            card={card}
            isNextLedActive={isNextLedActive}
            isRevealed={isRevealed}
            onNext={handleNext}
            showFurigana={showFurigana}
            statusText={statusText}
          />

          <VerbPracticeControls
            countdownSeconds={countdownSeconds}
            isPowerOn={isPowerOn}
            onPauseChange={setPauseSeconds}
            onPowerToggle={() => setIsPowerOn((current) => !current)}
            onShowFuriganaToggle={() => setShowFurigana((current) => !current)}
            onToggleConjugation={(conjugationId) =>
              setSelectedConjugationIds((current) => toggleSelection(current, conjugationId))
            }
            onToggleJlptLevel={(level) =>
              setSelectedJlptLevels((current) => toggleSelection(current, level))
            }
            onToggleVerbGroup={(group) =>
              setSelectedVerbGroups((current) => toggleSelection(current, group))
            }
            onVolumeChange={(nextVolume) => {
              setVolumeLevel(nextVolume);
              playbackRef.current?.setVolume(nextVolume);
            }}
            pauseSeconds={pauseSeconds}
            selectedConjugationIds={selectedConjugationIds}
            selectedJlptLevels={selectedJlptLevels}
            selectedVerbGroups={selectedVerbGroups}
            showFurigana={showFurigana}
            volumeLevel={volumeLevel}
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
        {playbackHint && <p className="mt-3 text-sm text-[#9e4c2a]">{playbackHint}</p>}
      </section>
    </div>
  );
};

export default JapaneseVerbConjugationToolPage;
