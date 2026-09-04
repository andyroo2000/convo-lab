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

const FSRS_NUMBER_FIELDS = [
  'stability',
  'difficulty',
  'elapsed_days',
  'scheduled_days',
  'reps',
  'lapses',
  'learning_steps',
  'state',
] as const;

type FsrsNumberField = (typeof FSRS_NUMBER_FIELDS)[number];

function readFsrsNumbers(raw: Record<string, unknown>): Record<FsrsNumberField, number> | null {
  const entries = FSRS_NUMBER_FIELDS.map((field) => [field, toFiniteNumber(raw[field])] as const);
  if (entries.some(([, value]) => value === null)) return null;
  return Object.fromEntries(entries) as Record<FsrsNumberField, number>;
}

function readRequiredDate(value: unknown): Date | null {
  return typeof value === 'string' ? toDate(value) : null;
}

function readOptionalDate(value: unknown): Date | null | undefined {
  if (typeof value === 'undefined' || value === null) return undefined;
  return readRequiredDate(value);
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
  const due = readRequiredDate(raw.due);
  const numbers = readFsrsNumbers(raw);
  const lastReview = readOptionalDate(raw.last_review);
  if (!due) return null;
  if (!numbers) return null;
  if (lastReview === null) return null;

  return {
    due,
    stability: numbers.stability,
    difficulty: numbers.difficulty,
    elapsed_days: Math.max(0, Math.trunc(numbers.elapsed_days)),
    scheduled_days: Math.max(0, Math.trunc(numbers.scheduled_days)),
    reps: Math.max(0, Math.trunc(numbers.reps)),
    lapses: Math.max(0, Math.trunc(numbers.lapses)),
    learning_steps: Math.max(0, Math.trunc(numbers.learning_steps)),
    state: Math.max(0, Math.trunc(numbers.state)),
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

function deserializeRecord<T>(
  raw: unknown,
  deserializeValue: (value: unknown) => T | null
): Record<string, T> | null {
  if (!isRecord(raw)) return null;

  const entries = Object.entries(raw).map(
    ([key, serializedValue]) => [key, deserializeValue(serializedValue)] as const
  );
  if (entries.some(([, value]) => value === null)) return null;
  return Object.fromEntries(entries) as Record<string, T>;
}

function deserializeSeen(value: unknown): true | null {
  return value === true ? true : null;
}

function deserializeCount(value: unknown): number | null {
  const count = toFiniteNumber(value);
  return count === null ? null : Math.max(0, Math.trunc(count));
}

function deserializeFsrsState(raw: unknown): FsrsSessionState | null {
  if (!isRecord(raw)) return null;

  const cardsById = deserializeRecord(raw.cardsById, deserializeFsrsCard);
  const seenById = deserializeRecord(raw.seenById, deserializeSeen);
  const newCardsByLocalDate = deserializeRecord(raw.newCardsByLocalDate, deserializeCount);
  if (!cardsById) return null;
  if (!seenById) return null;
  if (!newCardsByLocalDate) return null;

  return {
    cardsById,
    seenById,
    newCardsByLocalDate,
  };
}

function deserializeCurrentCard(raw: unknown): TimePracticeCard | null {
  if (!isRecord(raw)) return null;
  const hour24 = toFiniteNumber(raw.hour24);
  const minute = toFiniteNumber(raw.minute);
  return hour24 === null || minute === null ? null : createTimeCard(hour24, minute);
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

function deserializeLocalState(raw: unknown): TimePracticeLocalState | null {
  if (!isRecord(raw) || raw.version !== STORAGE_VERSION) return null;

  const currentCard = deserializeCurrentCard(raw.currentCard);
  if (!currentCard) return null;

  const mode: TimePracticeMode = raw.mode === 'fsrs' ? 'fsrs' : 'random';
  const settings = sanitizeSettings(raw.settings);
  return {
    mode,
    currentCard,
    fsrsState: deserializeFsrsState(raw.fsrsState) ?? createInitialFsrsSessionState(),
    settings,
    ui: sanitizeUi(raw.ui, settings.revealDelaySeconds),
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

    return deserializeLocalState(JSON.parse(raw) as unknown);
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
