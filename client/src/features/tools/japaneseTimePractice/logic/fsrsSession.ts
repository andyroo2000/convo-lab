import type { Card } from 'ts-fsrs';

export interface FsrsSessionState {
  cardsById: Record<string, Card>;
  seenById: Record<string, true>;
  newCardsByLocalDate: Record<string, number>;
}

export function createInitialFsrsSessionState(): FsrsSessionState {
  return {
    cardsById: {},
    seenById: {},
    newCardsByLocalDate: {},
  };
}
