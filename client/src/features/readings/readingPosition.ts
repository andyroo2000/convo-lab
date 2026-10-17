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

function validPosition(value: Partial<ReadingPosition>) {
  const sentenceValid = value.sentenceIndex === null || Number.isInteger(value.sentenceIndex);
  return [
    typeof value.readingId === 'string',
    typeof value.eventId === 'string',
    Boolean(value.eventId),
    Number.isInteger(value.readingRevision),
    Number(value.readingRevision) > 0,
    Number.isInteger(value.pageNumber),
    Number.isFinite(Date.parse(value.readAt ?? '')),
    sentenceValid,
  ].every(Boolean);
}

export function readPending(key: string): ReadingPosition | null {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as ReadingPosition;
    if (!validPosition(value)) throw new Error('Invalid saved position');
    return value;
  } catch {
    // Keep the unreadable bytes for recovery without blocking the server restore.
    try {
      localStorage.setItem(`${key}:recovery:${Date.now()}`, raw);
      localStorage.removeItem(key);
    } catch {
      /* A full browser store must not prevent reading. */
    }
    return null;
  }
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
    selected: sentenceOnPage(
      reading,
      pageIndex,
      position?.readingRevision === (reading.revision ?? 1)
        ? (position?.sentenceIndex ?? null)
        : null
    ),
  };
}
