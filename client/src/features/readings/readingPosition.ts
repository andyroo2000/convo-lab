import type { ReadingDetail } from './types';

export interface ReadingPosition {
  readingId: string;
  readingRevision: number;
  pageNumber: number;
  sentenceIndex: number | null;
  eventId: string;
  readAt: string;
}

export function positionKey(userId: string, readingId: string) {
  return `reading-position:${userId}:${readingId}`;
}

export function readPending(key: string): ReadingPosition | null {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  const value = JSON.parse(raw) as ReadingPosition;
  if (
    [
      !value.eventId,
      !Number.isInteger(value.pageNumber),
      !Number.isFinite(Date.parse(value.readAt)),
    ].some(Boolean)
  ) {
    throw new Error('The saved reading position could not be read.');
  }
  return value;
}

export function acknowledgePosition(key: string, eventId: string) {
  if (readPending(key)?.eventId === eventId) localStorage.removeItem(key);
}

export function sentenceOnPage(reading: ReadingDetail, pageIndex: number, selected: number | null) {
  const page = reading.document.pages[pageIndex];
  const parts = [...page.columns.flat(), ...(page.notes ?? [])];
  if (page.biography) parts.push(page.biography);
  return parts.some(([index]) => index === selected) ? selected : null;
}

export function restorePosition(reading: ReadingDetail, position: ReadingPosition | null) {
  const found = reading.document.pages.findIndex((page) => page.number === position?.pageNumber);
  const pageIndex = Math.max(0, found);
  return {
    pageIndex,
    selected: sentenceOnPage(reading, pageIndex, position?.sentenceIndex ?? null),
  };
}
