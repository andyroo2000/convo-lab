import { getReadingPosition, saveReadingPosition } from './readingsApi';
import {
  acknowledgePosition,
  readPending,
  restorePosition,
  sentenceOnPage,
} from './readingPosition';
import type { ReadingDetail } from './types';

export type ReaderPosition = { pageIndex: number; selected: number | null };

export default class ReadingPositionSync {
  private controller = new AbortController();

  private edited = false;

  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private reading: ReadingDetail,
    private key: string,
    private update: (position: ReaderPosition) => void,
    private report: (error: string | null) => void
  ) {}

  async restore() {
    try {
      const pending = readPending(this.key);
      if (pending) this.update(restorePosition(this.reading, pending));
      await this.flush();
      const result = await getReadingPosition(this.reading.id, this.controller.signal);
      if (this.controller.signal.aborted) return;
      if (this.edited || readPending(this.key)) return;
      this.update(restorePosition(this.reading, result.position));
    } catch {
      this.reportError('Could not sync your reading position. You can keep reading.');
    }
  }

  async flush() {
    if (this.controller.signal.aborted) return;
    try {
      const pending = readPending(this.key);
      if (!pending) return;
      const result = await saveReadingPosition(this.reading.id, pending, this.controller.signal);
      if (this.controller.signal.aborted) return;
      if (!result.position) throw new Error('Position was not acknowledged.');
      acknowledgePosition(this.key, pending.eventId);
      this.report(null);
    } catch {
      this.reportError('Your position is saved on this browser but has not synced yet.');
    }
  }

  record(position: ReaderPosition) {
    this.edited = true;
    try {
      localStorage.setItem(
        this.key,
        JSON.stringify({
          readingId: this.reading.id,
          readingRevision: this.reading.revision ?? 1,
          pageNumber: this.reading.document.pages[position.pageIndex].number,
          sentenceIndex: sentenceOnPage(this.reading, position.pageIndex, position.selected),
          eventId: crypto.randomUUID(),
          readAt: new Date().toISOString(),
        })
      );
      clearTimeout(this.timer);
      this.timer = setTimeout(() => {
        this.flush();
      }, 500);
    } catch {
      this.reportError('Your position could not be saved on this browser.');
    }
  }

  async flushOnExit() {
    if (this.controller.signal.aborted) return;
    try {
      const pending = readPending(this.key);
      if (!pending) return;
      const result = await saveReadingPosition(this.reading.id, pending, undefined, true);
      if (result.position) acknowledgePosition(this.key, pending.eventId);
    } catch {
      /* The durable outbox retries when the reader is reopened. */
    }
  }

  dispose() {
    this.controller.abort();
    clearTimeout(this.timer);
  }

  private reportError(message: string) {
    if (!this.controller.signal.aborted) this.report(message);
  }
}
