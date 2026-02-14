import { createEmptyCard, fsrs, Rating, type Card } from 'ts-fsrs';

import { FULL_DAY_TIME_CARD_POOL, type TimePracticeCard } from './types';

export type FsrsGrade = 'again' | 'hard' | 'good' | 'easy';

export interface FsrsSessionState {
  cardsById: Record<string, Card>;
  seenById: Record<string, true>;
  newCardsByLocalDate: Record<string, number>;
}

const scheduler = fsrs();

const GRADE_TO_RATING: Record<FsrsGrade, Rating> = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
};

const EMPTY_SESSION: FsrsSessionState = {
  cardsById: {},
  seenById: {},
  newCardsByLocalDate: {},
};

function toLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDailyNewCount(state: FsrsSessionState, now: Date): number {
  return state.newCardsByLocalDate[toLocalDateKey(now)] ?? 0;
}

function increaseDailyNewCount(state: FsrsSessionState, now: Date): Record<string, number> {
  const key = toLocalDateKey(now);
  return {
    ...state.newCardsByLocalDate,
    [key]: (state.newCardsByLocalDate[key] ?? 0) + 1,
  };
}

function dueTimeOf(state: FsrsSessionState, card: TimePracticeCard): Date {
  return state.cardsById[card.id]?.due ?? new Date(0);
}

export function createInitialFsrsSessionState(): FsrsSessionState {
  return EMPTY_SESSION;
}

export function pickNextFsrsCard(
  state: FsrsSessionState,
  now: Date,
  maxNewCardsPerDay: number
): TimePracticeCard {
  const dueCards = FULL_DAY_TIME_CARD_POOL.filter((candidate) => {
    const scheduled = state.cardsById[candidate.id];
    return scheduled && scheduled.due <= now;
  });

  if (dueCards.length > 0) {
    dueCards.sort((a, b) => dueTimeOf(state, a).getTime() - dueTimeOf(state, b).getTime());
    return dueCards[0];
  }

  const canShowNew = getDailyNewCount(state, now) < maxNewCardsPerDay;
  if (canShowNew) {
    const unseen = FULL_DAY_TIME_CARD_POOL.filter((candidate) => !state.seenById[candidate.id]);
    if (unseen.length > 0) {
      return unseen[Math.floor(Math.random() * unseen.length)];
    }
  }

  const scheduled = FULL_DAY_TIME_CARD_POOL.filter((candidate) =>
    Boolean(state.cardsById[candidate.id])
  );
  if (scheduled.length > 0) {
    scheduled.sort((a, b) => dueTimeOf(state, a).getTime() - dueTimeOf(state, b).getTime());
    return scheduled[0];
  }

  return FULL_DAY_TIME_CARD_POOL[Math.floor(Math.random() * FULL_DAY_TIME_CARD_POOL.length)];
}

export function reviewFsrsCard(
  state: FsrsSessionState,
  card: TimePracticeCard,
  grade: FsrsGrade,
  now: Date
): FsrsSessionState {
  const rating = GRADE_TO_RATING[grade];
  const currentCard = state.cardsById[card.id] ?? createEmptyCard(now);
  const next = scheduler.next(currentCard, now, rating).card;
  const isFirstSeen = !state.seenById[card.id];

  return {
    cardsById: {
      ...state.cardsById,
      [card.id]: next,
    },
    seenById: isFirstSeen
      ? {
          ...state.seenById,
          [card.id]: true,
        }
      : state.seenById,
    newCardsByLocalDate: isFirstSeen
      ? increaseDailyNewCount(state, now)
      : state.newCardsByLocalDate,
  };
}
