import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ReadingPositionSync from './ReadingPositionSync';
import { getReadingPosition, saveReadingPosition } from './readingsApi';
import { positionKey, readPending, restorePosition, type ReadingPosition } from './readingPosition';
import type { ReadingDetail } from './types';

vi.mock('./readingsApi', () => ({ getReadingPosition: vi.fn(), saveReadingPosition: vi.fn() }));
const reading: ReadingDetail = {
  id: 'story',
  title: 'Story',
  author: 'Author',
  pageCount: 2,
  revision: 3,
  illustrationUrl: null,
  voiceName: 'Narrator',
  document: {
    title: 'Story',
    author: 'Author',
    sentences: [],
    pages: [
      { number: 24, kind: 'text', columns: [[[0, '犬。']]] },
      { number: 25, kind: 'text', columns: [[[1, '猫。']]] },
    ],
  },
};
const remote: ReadingPosition = {
  readingId: 'story',
  readingRevision: 3,
  pageNumber: 25,
  sentenceIndex: 1,
  eventId: 'remote',
  readAt: '2026-10-17T12:00:00Z',
};
const key = positionKey('owner', reading.id);
const sessions: ReadingPositionSync[] = [];
function session() {
  const update = vi.fn();
  const report = vi.fn();
  const sync = new ReadingPositionSync(reading, key, update, report);
  sessions.push(sync);
  return { sync, update, report };
}
beforeEach(() => {
  localStorage.clear();
  vi.mocked(getReadingPosition).mockResolvedValue({ position: remote });
  vi.mocked(saveReadingPosition).mockImplementation(async (_id, position) => ({ position }));
});
afterEach(() => {
  sessions.splice(0).forEach((sync) => sync.dispose());
  vi.resetAllMocks();
});

describe('reading position synchronization', () => {
  it('restores server page and sentence without creating a new activity event', async () => {
    const { sync, update } = session();
    await sync.restore();
    expect(update).toHaveBeenLastCalledWith({ pageIndex: 1, selected: 1 });
    expect(saveReadingPosition).not.toHaveBeenCalled();
    expect(localStorage.getItem(key)).toBeNull();
  });

  it('keeps failed saves through reopening and retries without losing local position', async () => {
    const first = session();
    first.sync.record({ pageIndex: 0, selected: 0 });
    const pending = readPending(key);
    first.sync.dispose();
    vi.mocked(saveReadingPosition).mockRejectedValue(new Error('Offline'));
    const reopened = session();
    await reopened.sync.restore();
    expect(reopened.update).toHaveBeenLastCalledWith({ pageIndex: 0, selected: 0 });
    expect(readPending(key)).toEqual(pending);
    expect(reopened.report).toHaveBeenCalledWith(expect.stringContaining('not synced'));
    vi.mocked(saveReadingPosition).mockResolvedValue({ position: pending });
    await reopened.sync.flush();
    expect(readPending(key)).toBeNull();
  });

  it('does not remove a newer local event when an older save finishes', async () => {
    const { sync } = session();
    sync.record({ pageIndex: 0, selected: null });
    vi.mocked(saveReadingPosition).mockImplementation(async (_id, position) => {
      sync.record({ pageIndex: 1, selected: 1 });
      return { position };
    });
    await sync.flush();
    expect(readPending(key)?.pageNumber).toBe(25);
  });

  it('does not move the reader when a late server restore follows interaction', async () => {
    const { sync, update } = session();
    vi.mocked(getReadingPosition).mockImplementation(async () => {
      sync.record({ pageIndex: 0, selected: 0 });
      return { position: remote };
    });
    await sync.restore();
    expect(update).not.toHaveBeenCalled();
  });

  it('keeps pending positions separate between accounts', async () => {
    localStorage.setItem(positionKey('other', reading.id), JSON.stringify(remote));
    const { sync } = session();
    await sync.flush();
    expect(saveReadingPosition).not.toHaveBeenCalled();
    expect(readPending(positionKey('other', reading.id))).toEqual(remote);
  });

  it('ignores responses after disposal and rejects missing acknowledgement', async () => {
    const { sync, report } = session();
    sync.record({ pageIndex: 0, selected: null });
    vi.mocked(saveReadingPosition).mockResolvedValue({ position: null });
    await sync.flush();
    expect(readPending(key)).not.toBeNull();
    expect(report).toHaveBeenCalledWith(expect.stringContaining('not synced'));
    vi.mocked(saveReadingPosition).mockImplementation(async (_id, position) => {
      sync.dispose();
      return { position };
    });
    await sync.flush();
    expect(readPending(key)).not.toBeNull();
  });

  it('drops a sentence selection that no longer belongs to the restored page', () => {
    expect(restorePosition(reading, { ...remote, sentenceIndex: 0 })).toEqual({
      pageIndex: 1,
      selected: null,
    });
    expect(restorePosition(reading, { ...remote, pageNumber: 99 })).toEqual({
      pageIndex: 0,
      selected: null,
    });
  });
});
