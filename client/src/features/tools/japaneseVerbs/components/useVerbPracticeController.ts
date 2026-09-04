import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from 'react';

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
import useToolArrowKeyNavigation from '../../hooks/useToolArrowKeyNavigation';

interface VerbCardSnapshot {
  card: VerbPracticeCard | null;
  isRevealed: boolean;
}

interface PracticeFilters {
  selectedJlptLevels: JLPTLevel[];
  selectedVerbGroups: VerbGroup[];
  selectedConjugationIds: VerbConjugationId[];
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

const useShowFuriganaPreference = () => {
  const [showFurigana, setShowFurigana] = useState(loadShowFurigana);
  const isInitialRender = useRef(true);

  useEffect(() => {
    if (isInitialRender.current) {
      isInitialRender.current = false;
      return;
    }
    try {
      window.localStorage.setItem(FURIGANA_STORAGE_KEY, String(showFurigana));
    } catch {
      // Ignore storage write errors (quota/private mode).
    }
  }, [showFurigana]);

  return { showFurigana, setShowFurigana };
};

const usePracticeFilters = () => {
  const [selectedJlptLevels, setSelectedJlptLevels] = useState<JLPTLevel[]>(DEFAULT_JLPT_LEVELS);
  const [selectedVerbGroups, setSelectedVerbGroups] = useState<VerbGroup[]>(DEFAULT_VERB_GROUPS);
  const [selectedConjugationIds, setSelectedConjugationIds] =
    useState<VerbConjugationId[]>(DEFAULT_CONJUGATION_IDS);

  return {
    selectedJlptLevels,
    selectedVerbGroups,
    selectedConjugationIds,
    onToggleJlptLevel: (level: JLPTLevel) =>
      setSelectedJlptLevels((current) => toggleSelection(current, level)),
    onToggleVerbGroup: (group: VerbGroup) =>
      setSelectedVerbGroups((current) => toggleSelection(current, group)),
    onToggleConjugation: (conjugationId: VerbConjugationId) =>
      setSelectedConjugationIds((current) => toggleSelection(current, conjugationId)),
  };
};

const clearTimeoutRef = (timerRef: MutableRefObject<number | null>) => {
  const targetRef = timerRef;
  if (targetRef.current === null) return;
  window.clearTimeout(targetRef.current);
  targetRef.current = null;
};

const clearIntervalRef = (timerRef: MutableRefObject<number | null>) => {
  const targetRef = timerRef;
  if (targetRef.current === null) return;
  window.clearInterval(targetRef.current);
  targetRef.current = null;
};

const usePracticeTimers = () => {
  const revealTimerRef = useRef<number | null>(null);
  const autoAdvanceTimerRef = useRef<number | null>(null);
  const countdownIntervalRef = useRef<number | null>(null);
  const nextLedTimerRef = useRef<number | null>(null);

  const clearRevealTimer = useCallback(() => clearTimeoutRef(revealTimerRef), []);
  const clearAutoAdvanceTimer = useCallback(() => clearTimeoutRef(autoAdvanceTimerRef), []);
  const clearCountdownInterval = useCallback(() => clearIntervalRef(countdownIntervalRef), []);
  const clearNextLedTimer = useCallback(() => clearTimeoutRef(nextLedTimerRef), []);

  return useMemo(
    () => ({
      revealTimerRef,
      autoAdvanceTimerRef,
      countdownIntervalRef,
      nextLedTimerRef,
      clearRevealTimer,
      clearAutoAdvanceTimer,
      clearCountdownInterval,
      clearNextLedTimer,
    }),
    [clearAutoAdvanceTimer, clearCountdownInterval, clearNextLedTimer, clearRevealTimer]
  );
};

type PracticeTimers = ReturnType<typeof usePracticeTimers>;

const useVerbPlayback = (card: VerbPracticeCard | null, volumeRef: MutableRefObject<number>) => {
  const [playbackHint, setPlaybackHint] = useState<string | null>(null);
  const playbackRef = useRef<ReturnType<typeof playVerbAudioClip> | null>(null);

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
      if (!isAbort) setPlaybackHint('Audio playback failed. Tap Show Answer or Next to retry.');
    } finally {
      if (currentPlayback && playbackRef.current === currentPlayback) {
        playbackRef.current = null;
      }
    }
  }, [card, stopPlayback, volumeRef]);

  return { playbackHint, playbackRef, stopPlayback, playCurrentCardAudio };
};

type VerbPlayback = ReturnType<typeof useVerbPlayback>;

interface UseCardNavigationOptions extends PracticeFilters {
  timers: PracticeTimers;
  playback: VerbPlayback;
  setCountdownSeconds: (value: number | null) => void;
  state: CardState;
}

const useCardState = () => ({
  cardState: useState<VerbPracticeCard | null>(() =>
    createVerbPracticeCard(DEFAULT_JLPT_LEVELS, DEFAULT_VERB_GROUPS, DEFAULT_CONJUGATION_IDS)
  ),
  revealState: useState(false),
  nextLedState: useState(false),
  previousCardsRef: useRef<VerbCardSnapshot[]>([]),
  recentCardKeysRef: useRef<string[]>([]),
});

type CardState = ReturnType<typeof useCardState>;

interface UseNavigationActionsOptions {
  card: VerbPracticeCard | null;
  isRevealed: boolean;
  timers: PracticeTimers;
  playback: VerbPlayback;
  setCard: Dispatch<SetStateAction<VerbPracticeCard | null>>;
  setIsRevealed: Dispatch<SetStateAction<boolean>>;
  setIsNextLedActive: Dispatch<SetStateAction<boolean>>;
  setCountdownSeconds: (value: number | null) => void;
  previousCardsRef: MutableRefObject<VerbCardSnapshot[]>;
  pushCurrentCardToHistory: () => void;
  advanceToNextCard: () => void;
  revealCard: () => void;
}

const useNextNavigation = ({
  card,
  isRevealed,
  timers,
  playback,
  setIsNextLedActive,
  setCountdownSeconds,
  pushCurrentCardToHistory,
  advanceToNextCard,
  revealCard,
}: UseNavigationActionsOptions) => {
  const {
    nextLedTimerRef,
    clearNextLedTimer,
    clearAutoAdvanceTimer,
    clearRevealTimer,
    clearCountdownInterval,
  } = timers;
  const { stopPlayback } = playback;

  return useCallback(() => {
    if (!card) return;
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
    pushCurrentCardToHistory();

    if (isRevealed) advanceToNextCard();
    else revealCard();
  }, [
    advanceToNextCard,
    card,
    clearAutoAdvanceTimer,
    clearCountdownInterval,
    clearNextLedTimer,
    clearRevealTimer,
    isRevealed,
    nextLedTimerRef,
    pushCurrentCardToHistory,
    revealCard,
    setCountdownSeconds,
    setIsNextLedActive,
    stopPlayback,
  ]);
};

const usePreviousNavigation = ({
  timers,
  playback,
  setCard,
  setIsRevealed,
  setIsNextLedActive,
  setCountdownSeconds,
  previousCardsRef,
}: UseNavigationActionsOptions) => {
  const { clearNextLedTimer, clearAutoAdvanceTimer, clearRevealTimer, clearCountdownInterval } =
    timers;
  const { stopPlayback } = playback;

  return useCallback(() => {
    clearAutoAdvanceTimer();
    clearRevealTimer();
    clearCountdownInterval();
    clearNextLedTimer();
    stopPlayback();
    setIsNextLedActive(false);
    setCountdownSeconds(null);
    const previousCard = previousCardsRef.current.pop();
    if (!previousCard) return;
    setCard(previousCard.card);
    setIsRevealed(previousCard.isRevealed);
  }, [
    clearAutoAdvanceTimer,
    clearCountdownInterval,
    clearNextLedTimer,
    clearRevealTimer,
    previousCardsRef,
    setCard,
    setCountdownSeconds,
    setIsNextLedActive,
    setIsRevealed,
    stopPlayback,
  ]);
};

interface UseCardTransitionsOptions extends PracticeFilters {
  card: VerbPracticeCard | null;
  isRevealed: boolean;
  playback: VerbPlayback;
  setCard: Dispatch<SetStateAction<VerbPracticeCard | null>>;
  setIsRevealed: Dispatch<SetStateAction<boolean>>;
  previousCardsRef: MutableRefObject<VerbCardSnapshot[]>;
  recentCardKeysRef: MutableRefObject<string[]>;
}

const useCardTransitions = ({
  card,
  isRevealed,
  playback,
  setCard,
  setIsRevealed,
  previousCardsRef,
  recentCardKeysRef,
  selectedJlptLevels,
  selectedVerbGroups,
  selectedConjugationIds,
}: UseCardTransitionsOptions) => {
  const { playCurrentCardAudio } = playback;
  const recentKeysRef = recentCardKeysRef;
  const pushCurrentCardToHistory = useCallback(() => {
    previousCardsRef.current.push({ card, isRevealed });
    if (previousCardsRef.current.length > HISTORY_LIMIT) previousCardsRef.current.shift();
  }, [card, isRevealed, previousCardsRef]);

  const revealCard = useCallback(() => {
    setIsRevealed(true);
    playCurrentCardAudio();
  }, [playCurrentCardAudio, setIsRevealed]);

  const advanceToNextCard = useCallback(() => {
    if (card) {
      const cardKey = buildCardHistoryKey(card);
      const dedupedKeys = [cardKey, ...recentKeysRef.current.filter((entry) => entry !== cardKey)];
      recentKeysRef.current = dedupedKeys.slice(0, RECENT_CARD_HISTORY_LIMIT);
    }
    setIsRevealed(false);
    setCard(
      createVerbPracticeCard(
        selectedJlptLevels,
        selectedVerbGroups,
        selectedConjugationIds,
        recentKeysRef.current
      )
    );
  }, [
    card,
    recentKeysRef,
    selectedConjugationIds,
    selectedJlptLevels,
    selectedVerbGroups,
    setCard,
    setIsRevealed,
  ]);

  return { pushCurrentCardToHistory, revealCard, advanceToNextCard };
};

const useCardNavigation = ({
  selectedJlptLevels,
  selectedVerbGroups,
  selectedConjugationIds,
  timers,
  playback,
  setCountdownSeconds,
  state,
}: UseCardNavigationOptions) => {
  const [card, setCard] = state.cardState;
  const [isRevealed, setIsRevealed] = state.revealState;
  const [isNextLedActive, setIsNextLedActive] = state.nextLedState;
  const { previousCardsRef, recentCardKeysRef } = state;
  const { pushCurrentCardToHistory, revealCard, advanceToNextCard } = useCardTransitions({
    card,
    isRevealed,
    playback,
    setCard,
    setIsRevealed,
    previousCardsRef,
    recentCardKeysRef,
    selectedJlptLevels,
    selectedVerbGroups,
    selectedConjugationIds,
  });

  const navigationOptions = {
    card,
    isRevealed,
    timers,
    playback,
    setCard,
    setIsRevealed,
    setIsNextLedActive,
    setCountdownSeconds,
    previousCardsRef,
    pushCurrentCardToHistory,
    advanceToNextCard,
    revealCard,
  };
  const handleNext = useNextNavigation(navigationOptions);
  const handlePrevious = usePreviousNavigation(navigationOptions);

  return {
    card,
    setCard,
    isRevealed,
    setIsRevealed,
    isNextLedActive,
    setIsNextLedActive,
    previousCardsRef,
    recentCardKeysRef,
    revealCard,
    advanceToNextCard,
    handleNext,
    handlePrevious,
  };
};

type CardNavigation = ReturnType<typeof useCardNavigation>;

interface UseAutoLoopOptions {
  cardId: string | undefined;
  isPowerOn: boolean;
  isRevealed: boolean;
  pauseSeconds: number;
  setCountdownSeconds: (value: number | null | ((current: number | null) => number | null)) => void;
  timers: PracticeTimers;
  playback: VerbPlayback;
  navigation: CardNavigation;
}

type CountdownSetter = Dispatch<SetStateAction<number | null>>;

const startCountdown = (
  timers: PracticeTimers,
  pauseSeconds: number,
  setCountdownSeconds: CountdownSetter
) => {
  const { countdownIntervalRef } = timers;
  setCountdownSeconds(pauseSeconds);
  countdownIntervalRef.current = window.setInterval(() => {
    setCountdownSeconds((current) => (current === null ? null : Math.max(0, current - 1)));
  }, 1000);
};

const scheduleLoopTransition = (
  timerRef: MutableRefObject<number | null>,
  pauseSeconds: number,
  transition: () => void,
  setCountdownSeconds: CountdownSetter
) => {
  const targetRef = timerRef;
  let cancelled = false;
  targetRef.current = window.setTimeout(() => {
    if (cancelled) return;
    setCountdownSeconds(null);
    transition();
  }, pauseSeconds * 1000);
  return () => {
    cancelled = true;
  };
};

interface AutoLoopCycleOptions {
  isPowerOn: boolean;
  isRevealed: boolean;
  pauseSeconds: number;
  setCountdownSeconds: CountdownSetter;
  timers: PracticeTimers;
  isFirstPowerOnRef: MutableRefObject<boolean>;
  wasPowerOnRef: MutableRefObject<boolean>;
  stopPlayback: () => void;
  setIsNextLedActive: Dispatch<SetStateAction<boolean>>;
  revealCard: () => void;
  advanceToNextCard: () => void;
}

const runAutoLoopCycle = ({
  isPowerOn,
  isRevealed,
  pauseSeconds,
  setCountdownSeconds,
  timers,
  isFirstPowerOnRef,
  wasPowerOnRef,
  stopPlayback,
  setIsNextLedActive,
  revealCard,
  advanceToNextCard,
}: AutoLoopCycleOptions) => {
  const firstPowerOnRef = isFirstPowerOnRef;
  const previousPowerRef = wasPowerOnRef;
  const wasPowerOn = previousPowerRef.current;
  previousPowerRef.current = isPowerOn;
  timers.clearAutoAdvanceTimer();
  timers.clearRevealTimer();
  timers.clearCountdownInterval();

  if (!isPowerOn) {
    if (wasPowerOn) {
      timers.clearNextLedTimer();
      stopPlayback();
      setIsNextLedActive(false);
    }
    setCountdownSeconds(null);
    return undefined;
  }

  if (!isRevealed && firstPowerOnRef.current) {
    firstPowerOnRef.current = false;
    setCountdownSeconds(null);
    revealCard();
    return undefined;
  }

  startCountdown(timers, pauseSeconds, setCountdownSeconds);
  const timerRef = isRevealed ? timers.autoAdvanceTimerRef : timers.revealTimerRef;
  const transition = isRevealed ? advanceToNextCard : revealCard;
  const cancelTransition = scheduleLoopTransition(
    timerRef,
    pauseSeconds,
    transition,
    setCountdownSeconds
  );

  return () => {
    cancelTransition();
    timers.clearAutoAdvanceTimer();
    timers.clearRevealTimer();
    timers.clearCountdownInterval();
  };
};

const useAutoLoop = ({
  cardId,
  isPowerOn,
  isRevealed,
  pauseSeconds,
  setCountdownSeconds,
  timers,
  playback,
  navigation,
}: UseAutoLoopOptions) => {
  const isFirstPowerOnRef = useRef(true);
  const wasPowerOnRef = useRef(false);
  const { stopPlayback } = playback;
  const { setIsNextLedActive, revealCard, advanceToNextCard } = navigation;

  useEffect(
    () =>
      runAutoLoopCycle({
        isPowerOn,
        isRevealed,
        pauseSeconds,
        setCountdownSeconds,
        timers,
        isFirstPowerOnRef,
        wasPowerOnRef,
        stopPlayback,
        setIsNextLedActive,
        revealCard,
        advanceToNextCard,
      }),
    [
      advanceToNextCard,
      cardId,
      isPowerOn,
      isRevealed,
      pauseSeconds,
      revealCard,
      setCountdownSeconds,
      setIsNextLedActive,
      stopPlayback,
      timers,
    ]
  );

  return isFirstPowerOnRef;
};

interface UseFilterResetOptions extends PracticeFilters {
  timers: PracticeTimers;
  playback: VerbPlayback;
  navigation: CardNavigation;
  isFirstPowerOnRef: MutableRefObject<boolean>;
  setCountdownSeconds: (value: number | null) => void;
}

const useFilterReset = ({
  selectedJlptLevels,
  selectedVerbGroups,
  selectedConjugationIds,
  timers,
  playback,
  navigation,
  isFirstPowerOnRef,
  setCountdownSeconds,
}: UseFilterResetOptions) => {
  const { previousCardsRef, recentCardKeysRef, setIsNextLedActive, setIsRevealed, setCard } =
    navigation;
  const { stopPlayback } = playback;
  const { clearAutoAdvanceTimer, clearRevealTimer, clearCountdownInterval, clearNextLedTimer } =
    timers;
  const firstPowerOnRef = isFirstPowerOnRef;

  useEffect(() => {
    previousCardsRef.current = [];
    recentCardKeysRef.current = [];
    firstPowerOnRef.current = true;
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
    firstPowerOnRef,
    previousCardsRef,
    recentCardKeysRef,
    selectedConjugationIds,
    selectedJlptLevels,
    selectedVerbGroups,
    setCard,
    setCountdownSeconds,
    setIsNextLedActive,
    setIsRevealed,
    stopPlayback,
  ]);
};

const useUnmountCleanup = (timers: PracticeTimers, stopPlayback: () => void) => {
  useEffect(
    () => () => {
      timers.clearRevealTimer();
      timers.clearAutoAdvanceTimer();
      timers.clearCountdownInterval();
      timers.clearNextLedTimer();
      stopPlayback();
    },
    [stopPlayback, timers]
  );
};

const statusTextFor = (
  isPowerOn: boolean,
  isRevealed: boolean,
  countdownSeconds: number | null
) => {
  if (!isPowerOn || countdownSeconds === null) return '';
  return `${isRevealed ? 'next card' : 'answer'} in ${countdownSeconds}s`;
};

const useVerbPracticeController = () => {
  const furigana = useShowFuriganaPreference();
  const filters = usePracticeFilters();
  const [isPowerOn, setIsPowerOn] = useState(false);
  const [volumeLevel, setVolumeLevel] = useState(1);
  const [pauseSeconds, setPauseSeconds] = useState(8);
  const [countdownSeconds, setCountdownSeconds] = useState<number | null>(null);
  const volumeRef = useRef(volumeLevel);
  volumeRef.current = volumeLevel;
  const timers = usePracticeTimers();
  const cardState = useCardState();
  const [card] = cardState.cardState;
  const playback = useVerbPlayback(card, volumeRef);
  const navigation = useCardNavigation({
    ...filters,
    timers,
    playback,
    setCountdownSeconds,
    state: cardState,
  });
  const isFirstPowerOnRef = useAutoLoop({
    cardId: navigation.card?.id,
    isPowerOn,
    isRevealed: navigation.isRevealed,
    pauseSeconds,
    setCountdownSeconds,
    timers,
    playback,
    navigation,
  });
  useFilterReset({
    ...filters,
    timers,
    playback,
    navigation,
    isFirstPowerOnRef,
    setCountdownSeconds,
  });
  useUnmountCleanup(timers, playback.stopPlayback);
  useToolArrowKeyNavigation({
    onNext: navigation.handleNext,
    onPrevious: navigation.handlePrevious,
  });

  const onVolumeChange = (nextVolume: number) => {
    setVolumeLevel(nextVolume);
    playback.playbackRef.current?.setVolume(nextVolume);
  };

  return {
    ...furigana,
    ...filters,
    card: navigation.card,
    isRevealed: navigation.isRevealed,
    isNextLedActive: navigation.isNextLedActive,
    handleNext: navigation.handleNext,
    playbackHint: playback.playbackHint,
    isPowerOn,
    onPowerToggle: () => setIsPowerOn((current) => !current),
    volumeLevel,
    onVolumeChange,
    pauseSeconds,
    setPauseSeconds,
    countdownSeconds,
    statusText: statusTextFor(isPowerOn, navigation.isRevealed, countdownSeconds),
  };
};

export default useVerbPracticeController;
