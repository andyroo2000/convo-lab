import { createEmptyCard } from 'ts-fsrs';
import { beforeEach, describe, expect, it } from 'vitest';

import { createInitialFsrsSessionState } from '../fsrsSession';
import {
  TIME_PRACTICE_STORAGE_KEY,
  loadTimePracticeLocalState,
  saveTimePracticeLocalState,
} from '../localStorageState';
import { createTimeCard } from '../types';

describe('localStorageState', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('saves and loads persisted state including FSRS dates', () => {
    const now = new Date('2026-02-10T12:00:00.000Z');
    const state = createInitialFsrsSessionState();
    const card = createTimeCard(9, 15);
    const fsrsCard = createEmptyCard(now);
    fsrsCard.last_review = now;
    state.cardsById[card.id] = fsrsCard;
    state.seenById[card.id] = true;
    state.newCardsByLocalDate['2026-02-10'] = 3;

    saveTimePracticeLocalState({
      mode: 'fsrs',
      currentCard: card,
      fsrsState: state,
      settings: {
        revealDelaySeconds: 8,
        showFurigana: false,
        autoPlayAudio: false,
        displayMode: 'digital',
        maxNewCardsPerDay: 30,
        randomAutoLoop: false,
      },
      ui: {
        pauseSeconds: 8,
        volumeLevel: 0.42,
        isPowerOn: true,
      },
    });

    const loaded = loadTimePracticeLocalState();

    expect(loaded).not.toBeNull();
    expect(loaded?.mode).toBe('fsrs');
    expect(loaded?.currentCard.id).toBe(card.id);
    expect(loaded?.settings.showFurigana).toBe(false);
    expect(loaded?.settings.displayMode).toBe('digital');
    expect(loaded?.ui.volumeLevel).toBe(0.42);
    expect(loaded?.fsrsState.newCardsByLocalDate['2026-02-10']).toBe(3);

    const loadedFsrsCard = loaded?.fsrsState.cardsById[card.id];
    expect(loadedFsrsCard?.due).toBeInstanceOf(Date);
    expect(loadedFsrsCard?.last_review).toBeInstanceOf(Date);
    expect(loadedFsrsCard?.due.toISOString()).toBe(now.toISOString());
  });

  it('returns null for unsupported version payloads', () => {
    window.localStorage.setItem(
      TIME_PRACTICE_STORAGE_KEY,
      JSON.stringify({
        version: 99,
        mode: 'random',
      })
    );

    expect(loadTimePracticeLocalState()).toBeNull();
  });

  it('sanitizes malformed persisted values', () => {
    window.localStorage.setItem(
      TIME_PRACTICE_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        updatedAt: '2026-02-10T12:00:00.000Z',
        mode: 'random',
        currentCard: { hour24: 77, minute: -3 },
        fsrsState: {
          cardsById: {},
          seenById: {},
          newCardsByLocalDate: {},
        },
        settings: {
          revealDelaySeconds: 999,
          showFurigana: 'nope',
          autoPlayAudio: true,
          displayMode: 'digital',
          maxNewCardsPerDay: -5,
          randomAutoLoop: true,
        },
        ui: {
          pauseSeconds: -10,
          volumeLevel: 5,
          isPowerOn: 'yes',
        },
      })
    );

    const loaded = loadTimePracticeLocalState();
    expect(loaded).not.toBeNull();
    expect(loaded?.currentCard.hour24).toBe(23);
    expect(loaded?.currentCard.minute).toBe(0);
    expect(loaded?.settings.revealDelaySeconds).toBe(30);
    expect(loaded?.settings.maxNewCardsPerDay).toBe(1);
    expect(loaded?.ui.pauseSeconds).toBe(3);
    expect(loaded?.ui.volumeLevel).toBe(1);
    expect(loaded?.ui.isPowerOn).toBe(false);
  });
});
