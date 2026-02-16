import type { Card } from 'ts-fsrs';

import { createInitialFsrsSessionState, type FsrsSessionState } from './fsrsSession';
import {
  createTimeCard,
  DEFAULT_TIME_PRACTICE_SETTINGS,
  type TimePracticeCard,
  type TimePracticeMode,
  type TimePracticeSettings,
} from './types';

export const TIME_PRACTICE_STORAGE_KEY = 'convolab:japanese-time-practice:v1';

const STORAGE_VERSION = 1;

interface PersistedFsrsCardV1 {
  due: string;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  reps: number;
  lapses: number;
  learning_steps: number;
  state: number;
  last_review: string | null;
}

interface PersistedFsrsStateV1 {
  cardsById: Record<string, PersistedFsrsCardV1>;
  seenById: Record<string, true>;
  newCardsByLocalDate: Record<string, number>;
}

interface PersistedTimePracticeStateV1 {
  version: 1;
  updatedAt: string;
  mode: TimePracticeMode;
  currentCard: {
    hour24: number;
    minute: number;
  };
  fsrsState: PersistedFsrsStateV1;
  settings: TimePracticeSettings;
  ui: {
    pauseSeconds: number;
    volumeLevel: number;
    isPowerOn: boolean;
  };
}

export interface TimePracticeLocalState {
  mode: TimePracticeMode;
  currentCard: TimePracticeCard;
  fsrsState: FsrsSessionState;
  settings: TimePracticeSettings;
  ui: {
    pauseSeconds: number;
    volumeLevel: number;
    isPowerOn: boolean;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }
  return value;
}

function toBoolean(value: unknown): boolean | null {
  if (typeof value !== 'boolean') {
    return null;
  }
  return value;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function toDate(value: string): Date | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
}

function serializeFsrsCard(card: Card): PersistedFsrsCardV1 {
  return {
    due: card.due.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    reps: card.reps,
    lapses: card.lapses,
    learning_steps: card.learning_steps,
    state: card.state,
    last_review: card.last_review ? card.last_review.toISOString() : null,
  };
}

function deserializeFsrsCard(raw: unknown): Card | null {
  if (!isRecord(raw)) return null;

  const dueRaw = raw.due;
  if (typeof dueRaw !== 'string') return null;
  const due = toDate(dueRaw);
  if (!due) return null;

  const stability = toFiniteNumber(raw.stability);
  const difficulty = toFiniteNumber(raw.difficulty);
  const elapsedDays = toFiniteNumber(raw.elapsed_days);
  const scheduledDays = toFiniteNumber(raw.scheduled_days);
  const reps = toFiniteNumber(raw.reps);
  const lapses = toFiniteNumber(raw.lapses);
  const learningSteps = toFiniteNumber(raw.learning_steps);
  const state = toFiniteNumber(raw.state);

  if (
    stability === null ||
    difficulty === null ||
    elapsedDays === null ||
    scheduledDays === null ||
    reps === null ||
    lapses === null ||
    learningSteps === null ||
    state === null
  ) {
    return null;
  }

  const lastReviewRaw = raw.last_review;
  let lastReview: Date | undefined;
  if (typeof lastReviewRaw === 'string') {
    const parsed = toDate(lastReviewRaw);
    if (!parsed) return null;
    lastReview = parsed;
  } else if (lastReviewRaw !== null && typeof lastReviewRaw !== 'undefined') {
    return null;
  }

  return {
    due,
    stability,
    difficulty,
    elapsed_days: Math.max(0, Math.trunc(elapsedDays)),
    scheduled_days: Math.max(0, Math.trunc(scheduledDays)),
    reps: Math.max(0, Math.trunc(reps)),
    lapses: Math.max(0, Math.trunc(lapses)),
    learning_steps: Math.max(0, Math.trunc(learningSteps)),
    state: Math.max(0, Math.trunc(state)),
    last_review: lastReview,
  };
}

function serializeFsrsState(state: FsrsSessionState): PersistedFsrsStateV1 {
  const cardsById = Object.fromEntries(
    Object.entries(state.cardsById).map(([cardId, card]) => [cardId, serializeFsrsCard(card)])
  );

  return {
    cardsById,
    seenById: state.seenById,
    newCardsByLocalDate: state.newCardsByLocalDate,
  };
}

function deserializeFsrsState(raw: unknown): FsrsSessionState | null {
  if (!isRecord(raw)) return null;
  if (!isRecord(raw.cardsById) || !isRecord(raw.seenById) || !isRecord(raw.newCardsByLocalDate)) {
    return null;
  }

  const cardsById = Object.entries(raw.cardsById).reduce<Record<string, Card> | null>(
    (acc, [cardId, serializedCard]) => {
      if (!acc) return null;
      const card = deserializeFsrsCard(serializedCard);
      if (!card) return null;
      acc[cardId] = card;
      return acc;
    },
    {}
  );
  if (!cardsById) return null;

  const seenById = Object.entries(raw.seenById).reduce<Record<string, true> | null>(
    (acc, [cardId, seen]) => {
      if (!acc) return null;
      if (seen !== true) return null;
      acc[cardId] = true;
      return acc;
    },
    {}
  );
  if (!seenById) return null;

  const newCardsByLocalDate = Object.entries(raw.newCardsByLocalDate).reduce<Record<
    string,
    number
  > | null>((acc, [localDate, count]) => {
    if (!acc) return null;
    const numericCount = toFiniteNumber(count);
    if (numericCount === null) return null;
    acc[localDate] = Math.max(0, Math.trunc(numericCount));
    return acc;
  }, {});
  if (!newCardsByLocalDate) return null;

  return {
    cardsById,
    seenById,
    newCardsByLocalDate,
  };
}

function sanitizeSettings(raw: unknown): TimePracticeSettings {
  if (!isRecord(raw)) {
    return DEFAULT_TIME_PRACTICE_SETTINGS;
  }

  const revealDelaySeconds = toFiniteNumber(raw.revealDelaySeconds);
  const showFurigana = toBoolean(raw.showFurigana);
  const autoPlayAudio = toBoolean(raw.autoPlayAudio);
  const displayMode = raw.displayMode === 'digital' ? 'digital' : 'script';
  const maxNewCardsPerDay = toFiniteNumber(raw.maxNewCardsPerDay);
  const randomAutoLoop = toBoolean(raw.randomAutoLoop);

  return {
    revealDelaySeconds:
      revealDelaySeconds === null
        ? DEFAULT_TIME_PRACTICE_SETTINGS.revealDelaySeconds
        : clamp(Math.trunc(revealDelaySeconds), 3, 30),
    showFurigana: showFurigana ?? DEFAULT_TIME_PRACTICE_SETTINGS.showFurigana,
    autoPlayAudio: autoPlayAudio ?? DEFAULT_TIME_PRACTICE_SETTINGS.autoPlayAudio,
    displayMode,
    maxNewCardsPerDay:
      maxNewCardsPerDay === null
        ? DEFAULT_TIME_PRACTICE_SETTINGS.maxNewCardsPerDay
        : clamp(Math.trunc(maxNewCardsPerDay), 1, 1440),
    randomAutoLoop: randomAutoLoop ?? DEFAULT_TIME_PRACTICE_SETTINGS.randomAutoLoop,
  };
}

function sanitizeUi(raw: unknown, fallbackPauseSeconds: number): TimePracticeLocalState['ui'] {
  if (!isRecord(raw)) {
    return {
      pauseSeconds: fallbackPauseSeconds,
      volumeLevel: 1,
      isPowerOn: false,
    };
  }

  const pauseSeconds = toFiniteNumber(raw.pauseSeconds);
  const volumeLevel = toFiniteNumber(raw.volumeLevel);
  const isPowerOn = toBoolean(raw.isPowerOn);

  return {
    pauseSeconds:
      pauseSeconds === null ? fallbackPauseSeconds : clamp(Math.trunc(pauseSeconds), 3, 30),
    volumeLevel: volumeLevel === null ? 1 : clamp(volumeLevel, 0, 1),
    isPowerOn: isPowerOn ?? false,
  };
}

export function loadTimePracticeLocalState(): TimePracticeLocalState | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(TIME_PRACTICE_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) {
      return null;
    }

    if (parsed.version !== STORAGE_VERSION) {
      return null;
    }

    const mode: TimePracticeMode = parsed.mode === 'fsrs' ? 'fsrs' : 'random';
    const currentCardRaw = parsed.currentCard;
    if (!isRecord(currentCardRaw)) {
      return null;
    }

    const hour24 = toFiniteNumber(currentCardRaw.hour24);
    const minute = toFiniteNumber(currentCardRaw.minute);
    if (hour24 === null || minute === null) {
      return null;
    }

    const settings = sanitizeSettings(parsed.settings);
    const fsrsState = deserializeFsrsState(parsed.fsrsState) ?? createInitialFsrsSessionState();
    const ui = sanitizeUi(parsed.ui, settings.revealDelaySeconds);

    return {
      mode,
      currentCard: createTimeCard(hour24, minute),
      fsrsState,
      settings,
      ui,
    };
  } catch {
    return null;
  }
}

export function saveTimePracticeLocalState(state: TimePracticeLocalState): void {
  if (typeof window === 'undefined') {
    return;
  }

  const payload: PersistedTimePracticeStateV1 = {
    version: STORAGE_VERSION,
    updatedAt: new Date().toISOString(),
    mode: state.mode,
    currentCard: {
      hour24: state.currentCard.hour24,
      minute: state.currentCard.minute,
    },
    fsrsState: serializeFsrsState(state.fsrsState),
    settings: state.settings,
    ui: state.ui,
  };

  try {
    window.localStorage.setItem(TIME_PRACTICE_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage write errors (quota/private mode) so practice remains usable.
  }
}
