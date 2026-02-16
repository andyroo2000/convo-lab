import { createEmptyCard } from 'ts-fsrs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createInitialFsrsSessionState, pickNextFsrsCard, reviewFsrsCard } from '../fsrsSession';
import { FULL_DAY_TIME_CARD_POOL, createTimeCard } from '../types';

function toLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

describe('fsrsSession', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('picks due cards before unseen cards', () => {
    const dueCard = createTimeCard(9, 30);
    const futureCard = createTimeCard(10, 45);
    const now = new Date('2026-02-10T12:00:00.000Z');

    const state = createInitialFsrsSessionState();
    state.cardsById[dueCard.id] = createEmptyCard(new Date('2026-02-10T10:00:00.000Z'));
    state.cardsById[futureCard.id] = createEmptyCard(new Date('2026-02-10T18:00:00.000Z'));
    state.seenById[dueCard.id] = true;
    state.seenById[futureCard.id] = true;

    const next = pickNextFsrsCard(state, now, 20);
    expect(next.id).toBe(dueCard.id);
  });

  it('picks an unseen card when under max-new-per-day', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);

    const now = new Date('2026-02-10T12:00:00.000Z');
    const state = createInitialFsrsSessionState();
    const next = pickNextFsrsCard(state, now, 20);

    expect(next.id).toBe(FULL_DAY_TIME_CARD_POOL[0].id);
  });

  it('falls back to earliest scheduled card when max-new-per-day is reached', () => {
    const earliestScheduled = createTimeCard(6, 0);
    const laterScheduled = createTimeCard(8, 30);
    const now = new Date('2026-02-10T12:00:00.000Z');

    const state = createInitialFsrsSessionState();
    state.newCardsByLocalDate[toLocalDateKey(now)] = 20;
    state.cardsById[earliestScheduled.id] = createEmptyCard(new Date('2026-02-11T01:00:00.000Z'));
    state.cardsById[laterScheduled.id] = createEmptyCard(new Date('2026-02-11T06:00:00.000Z'));
    state.seenById[earliestScheduled.id] = true;
    state.seenById[laterScheduled.id] = true;

    const next = pickNextFsrsCard(state, now, 20);
    expect(next.id).toBe(earliestScheduled.id);
  });

  it('updates card scheduling and daily counter on first review only', () => {
    const now = new Date('2026-02-10T12:00:00.000Z');
    const card = createTimeCard(14, 15);
    const state = createInitialFsrsSessionState();
    const localDateKey = toLocalDateKey(now);

    const firstReview = reviewFsrsCard(state, card, 'good', now);
    expect(firstReview.cardsById[card.id]).toBeDefined();
    expect(firstReview.seenById[card.id]).toBe(true);
    expect(firstReview.newCardsByLocalDate[localDateKey]).toBe(1);

    const secondReview = reviewFsrsCard(firstReview, card, 'good', now);
    expect(secondReview.newCardsByLocalDate[localDateKey]).toBe(1);
  });
});
