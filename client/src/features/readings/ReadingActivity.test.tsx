import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  StudyActivityProvider,
  useStudyActivityActions,
} from '../../contexts/StudyActivityContext';
import { fetchWithCsrf } from '../../lib/csrf';
import type { StudyActivitySessionInput } from '../../types/studyActivity';
import ReadingReader from './ReadingReader';
import type { ReadingDetail } from './types';

const categories = { reading: 'immerse', daily_audio: 'listen' };
let capabilitiesAvailable = true;

vi.mock('../../hooks/useStudyCapabilities', () => ({
  useStudyCapabilities: () => ({
    data: capabilitiesAvailable
      ? { studyActivity: { categoriesByActivity: categories } }
      : undefined,
  }),
}));
vi.mock('../../lib/csrf', () => ({ fetchWithCsrf: vi.fn() }));
vi.mock('./readingsApi', () => ({
  getReadingPosition: vi.fn(async () => ({ position: null })),
  saveReadingPosition: vi.fn(async (_id, position) => ({ position })),
  getReadingAudio: vi.fn(async () => new Blob(['audio'])),
}));

const activeKey = 'convolab.studyActivity.active.v1.42';
const pendingKey = 'convolab.studyActivity.pending.v1.42';
const initialTime = new Date('2026-10-19T15:00:00.000Z');
const reading: ReadingDetail = {
  id: 'first',
  title: 'Story',
  author: 'Author',
  pageCount: 2,
  voiceName: 'Narrator',
  illustrationUrl: null,
  document: {
    title: 'Story',
    author: 'Author',
    pages: [
      { number: 1, kind: 'text', columns: [[[0, '犬です。']]] },
      { number: 2, kind: 'text', columns: [[[0, '犬です。']]] },
    ],
    sentences: [{ text: '犬です。', translation: 'It is a dog.' }],
  },
};

const Controls = () => {
  const { start } = useStudyActivityActions();
  return (
    <button
      type="button"
      onClick={() => start({ activity: 'reading', source: 'manual', name: 'Story' })}
    >
      Manual reading
    </button>
  );
};

function renderReaders(ids = ['first'], title = 'Story', strict = false) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const content = (nextIds: string[], userId = '42') => (
    <QueryClientProvider client={queryClient}>
      <StudyActivityProvider key={userId} userId={userId}>
        <Controls />
        {nextIds.map((id) => (
          <ReadingReader key={id} reading={{ ...reading, id, title }} userId={userId} />
        ))}
      </StudyActivityProvider>
    </QueryClientProvider>
  );
  const tree = (nextIds: string[], userId = '42') =>
    strict ? <StrictMode>{content(nextIds, userId)}</StrictMode> : content(nextIds, userId);
  const view = render(tree(ids));
  return {
    ...view,
    show: (nextIds: string[], userId = '42') => view.rerender(tree(nextIds, userId)),
  };
}

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

async function visibility(state: DocumentVisibilityState) {
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue(state);
  await act(async () => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
}

function saved() {
  return vi
    .mocked(fetchWithCsrf)
    .mock.calls.flatMap(
      ([, init]) => JSON.parse(String(init?.body)).sessions as StudyActivitySessionInput[]
    );
}

function active() {
  return JSON.parse(localStorage.getItem(activeKey) ?? 'null');
}

beforeEach(() => {
  capabilitiesAvailable = true;
  localStorage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(initialTime);
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  vi.mocked(fetchWithCsrf)
    .mockReset()
    .mockImplementation(
      async (_url, init) =>
        new Response(JSON.stringify(JSON.parse(String(init?.body)).sessions), { status: 200 })
    );
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:narration');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('reading time persistence', () => {
  it('counts twelve minutes of quiet reading and sends the existing web activity contract', async () => {
    const view = renderReaders();
    await advance(720_000);
    expect(saved()).toEqual([]);
    view.show([]);
    await advance(0);
    expect(saved()).toEqual([
      expect.objectContaining({
        activity: 'reading',
        source: 'automatic',
        origin: 'web',
        name: 'Story',
        startedAt: initialTime.toISOString(),
        endedAt: '2026-10-19T15:12:00.000Z',
        durationMs: 720_000,
        audioPlaybackMs: null,
      }),
    ]);
    expect(localStorage.getItem(pendingKey)).toBeNull();
    expect(active()).toBeNull();
  });

  it('excludes hidden time, resumes once, and keeps page changes in the same interval', async () => {
    const view = renderReaders();
    await advance(60_000);
    fireEvent.click(screen.getByRole('button', { name: '← Next' }));
    await advance(60_000);
    await visibility('hidden');
    await advance(600_000);
    await visibility('visible');
    await visibility('visible');
    await advance(30_000);
    view.show([]);
    expect(saved().map((session) => session.durationMs)).toEqual([120_000, 30_000]);
    expect(new Set(saved().map((session) => session.clientSessionId)).size).toBe(2);
  });

  it('starts only when a reader is visible and handles pagehide/pageshow without duplicate saves', async () => {
    const view = renderReaders([]);
    await advance(60_000);
    await visibility('hidden');
    view.show(['first']);
    await advance(60_000);
    expect(active()).toBeNull();
    await visibility('visible');
    await advance(15_000);
    fireEvent(window, new Event('pagehide'));
    await advance(60_000);
    fireEvent(window, new Event('pageshow'));
    await advance(25_000);
    view.unmount();
    expect(saved().map((session) => session.durationMs)).toEqual([15_000, 25_000]);
  });

  it('counts sentence narration in the same reading interval', async () => {
    const view = renderReaders();
    await advance(10_000);
    fireEvent.click(screen.getByRole('button', { name: '犬です。' }));
    fireEvent.click(screen.getByRole('button', { name: 'Play sentence' }));
    await advance(20_000);
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledOnce();
    view.unmount();
    expect(saved()).toEqual([
      expect.objectContaining({ activity: 'reading', durationMs: 30_000, audioPlaybackMs: null }),
    ]);
  });

  it('keeps failed saves in the existing offline queue and retries the same identity online', async () => {
    vi.mocked(fetchWithCsrf).mockRejectedValueOnce(new Error('offline'));
    const view = renderReaders();
    await advance(45_000);
    view.show([]);
    await advance(0);
    const queued = JSON.parse(localStorage.getItem(pendingKey) ?? '[]');
    expect(queued).toEqual([
      expect.objectContaining({ durationMs: 45_000, activity: 'reading', category: 'immerse' }),
    ]);
    fireEvent(window, new Event('online'));
    await advance(0);
    expect(saved()).toHaveLength(2);
    expect(saved()[1].clientSessionId).toBe(saved()[0].clientSessionId);
    expect(localStorage.getItem(pendingKey)).toBeNull();
  });

  it('truncates long titles to the API limit without splitting Unicode characters', async () => {
    const view = renderReaders(['first'], '📚'.repeat(125));
    await advance(10_000);
    view.unmount();
    expect(saved()[0].name).toBe('📚'.repeat(120));
  });
});

describe('reading session ownership', () => {
  it('does not stop an existing manual reading session when leaving the reader', async () => {
    const view = renderReaders([]);
    fireEvent.click(screen.getByRole('button', { name: 'Manual reading' }));
    const manualId = active().clientSessionId;
    view.show(['first']);
    await advance(60_000);
    view.show([]);
    expect(active()).toMatchObject({ source: 'manual', clientSessionId: manualId });
    expect(saved()).toEqual([]);
  });

  it('does not stop a replacement manual reading with the same title', async () => {
    const view = renderReaders();
    await advance(60_000);
    fireEvent.click(screen.getByRole('button', { name: 'Manual reading' }));
    await advance(30_000);
    view.show([]);
    expect(active()).toMatchObject({ source: 'manual', name: 'Story' });
    expect(saved()).toEqual([expect.objectContaining({ source: 'automatic', durationMs: 60_000 })]);
  });

  it('keeps the new same-title reading active when an older reader cleans up later', async () => {
    const view = renderReaders();
    await advance(60_000);
    view.show(['first', 'second']);
    const replacementId = active().clientSessionId;
    await advance(10_000);
    view.show(['second']);
    expect(active().clientSessionId).toBe(replacementId);
    await advance(20_000);
    view.show([]);
    expect(saved().map((session) => session.durationMs)).toEqual([60_000, 30_000]);
  });

  it('finishes the old account interval before starting the next account reader', async () => {
    const view = renderReaders();
    await advance(60_000);
    view.show(['first'], '43');
    expect(active()).toBeNull();
    expect(localStorage.getItem('convolab.studyActivity.active.v1.43')).not.toBeNull();
    await advance(20_000);
    view.show([], '43');
    expect(saved().map((session) => session.durationMs)).toEqual([60_000, 20_000]);
    expect(new Set(saved().map((session) => session.clientSessionId)).size).toBe(2);
  });
});

describe('reading recovery and other tabs', () => {
  function storeReading(startedAt: string) {
    localStorage.setItem(
      activeKey,
      JSON.stringify({
        clientSessionId: 'recovered',
        activity: 'reading',
        source: 'automatic',
        name: 'Story',
        startedAt,
        cardsCreated: 0,
      })
    );
  }

  it('caps an abandoned reading at five minutes and starts a fresh visible interval', async () => {
    storeReading('2026-10-19T14:00:00.000Z');
    const view = renderReaders();
    await advance(720_000);
    view.show([]);
    expect(saved().map((session) => session.durationMs)).toEqual([300_000, 720_000]);
    expect(saved()[0].endedAt).toBe('2026-10-19T14:05:00.000Z');
  });

  it('finalizes a recently abandoned reading even if the reader is not reopened', async () => {
    storeReading('2026-10-19T14:59:00.000Z');
    renderReaders([]);
    await advance(720_000);
    expect(active()).toBeNull();
    expect(saved()).toEqual([expect.objectContaining({ durationMs: 60_000 })]);
  });

  it('preserves live reading when another tab opens after twelve minutes', async () => {
    const { show } = renderReaders();
    await advance(720_000);
    const { unmount } = renderReaders([]);
    await advance(720_000);
    expect(saved()).toEqual([]);
    show([]);
    expect(saved()).toEqual([expect.objectContaining({ durationMs: 1_440_000 })]);
    unmount();
  });

  it('recovers only through the last heartbeat after another reading tab crashes', async () => {
    storeReading('2026-10-19T14:48:00.000Z');
    localStorage.setItem(
      `${activeKey}.reading-heartbeat`,
      JSON.stringify({
        sessionId: 'recovered',
        seenAt: initialTime.getTime(),
      })
    );
    renderReaders([]);
    await advance(299_000);
    expect(saved()).toEqual([]);
    await advance(1_000);
    expect(saved()).toEqual([
      expect.objectContaining({
        durationMs: 720_000,
        endedAt: initialTime.toISOString(),
      }),
    ]);
    expect(active()).toBeNull();
  });

  it('preserves a replacement before the old tab receives its storage event', async () => {
    const view = renderReaders();
    await advance(29_000);
    storeReading(initialTime.toISOString());
    const heartbeat = { sessionId: 'recovered', seenAt: Date.now() };
    localStorage.setItem(`${activeKey}.reading-heartbeat`, JSON.stringify(heartbeat));
    await advance(1_000);
    expect(JSON.parse(localStorage.getItem(`${activeKey}.reading-heartbeat`) ?? 'null')).toEqual(
      heartbeat
    );
    view.show([]);
    expect(active()).toMatchObject({ clientSessionId: 'recovered' });
    expect(saved()).toEqual([]);
  });

  it('leaves safely if the shared active-session value becomes malformed', async () => {
    const view = renderReaders();
    await advance(10_000);
    localStorage.setItem(activeKey, '{broken');
    view.show([]);
    expect(screen.queryByRole('button', { name: '犬です。' })).not.toBeInTheDocument();
    expect(localStorage.getItem(activeKey)).toBeNull();
    expect(saved()).toEqual([expect.objectContaining({ durationMs: 10_000 })]);
  });

  it.each(['setItem', 'removeItem'] as const)(
    'keeps reading usable if heartbeat %s throws',
    async (operation) => {
      const original = Storage.prototype[operation];
      vi.spyOn(Storage.prototype, operation).mockImplementation(function storageOperation(
        this: Storage,
        key: string,
        value?: string
      ) {
        if (key.endsWith('.reading-heartbeat')) throw new Error('Storage unavailable');
        return original.call(this, key, value!);
      });
      const view = renderReaders();
      await advance(720_000);
      view.show([]);
      expect(saved()).toEqual([expect.objectContaining({ durationMs: 720_000 })]);
    }
  );

  it('preserves elapsed time when capabilities arrive during reading', async () => {
    capabilitiesAvailable = false;
    const view = renderReaders();
    await advance(120_000);
    capabilitiesAvailable = true;
    view.show(['first']);
    await advance(600_000);
    view.show([]);
    await advance(0);
    expect(saved().map((session) => session.durationMs)).toEqual([120_000, 600_000]);
    expect(localStorage.getItem(pendingKey)).toBeNull();
  });

  it('finishes its owned interval when reading the active storage key throws', async () => {
    const view = renderReaders();
    const original = Storage.prototype.getItem;
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function readStorage(
      this: Storage,
      key: string
    ) {
      if (key === activeKey) throw new Error('Storage unavailable');
      return original.call(this, key);
    });
    await advance(720_000);
    view.show([]);
    await advance(0);
    expect(saved()).toEqual([expect.objectContaining({ durationMs: 720_000 })]);
    expect(localStorage.getItem(pendingKey)).toBeNull();
  });

  it('acknowledges StrictMode’s zero-duration probe without duplicating reading time', async () => {
    const view = renderReaders(['first'], 'Story', true);
    await advance(30_000);
    view.show([]);
    await advance(0);
    expect(saved().map((session) => session.durationMs)).toEqual([0, 30_000]);
    expect(localStorage.getItem(pendingKey)).toBeNull();
  });

  it('does not treat a future heartbeat as a live reader', async () => {
    storeReading('2026-10-19T14:48:00.000Z');
    localStorage.setItem(
      `${activeKey}.reading-heartbeat`,
      JSON.stringify({
        sessionId: 'recovered',
        seenAt: initialTime.getTime() + 3_600_000,
      })
    );
    renderReaders([]);
    await advance(0);
    expect(saved()).toEqual([
      expect.objectContaining({ durationMs: 720_000, endedAt: initialTime.toISOString() }),
    ]);
    expect(active()).toBeNull();
  });

  it('excludes a one-hour stall and resumes an interval that still stops when hidden', async () => {
    const view = renderReaders();
    await advance(120_000);
    vi.setSystemTime(new Date(initialTime.getTime() + 3_720_000));
    await advance(1_000);
    await advance(30_000);
    await visibility('hidden');
    view.unmount();
    expect(saved().map((session) => session.durationMs)).toEqual([120_000, 30_000]);
    expect(saved()[0].endedAt).toBe('2026-10-19T15:02:00.000Z');
    expect(saved()[1].startedAt).toBe('2026-10-19T16:02:01.000Z');
    expect(new Set(saved().map((session) => session.clientSessionId)).size).toBe(2);
    expect(active()).toBeNull();
  });

  it('resumes the owning reader when an observer recovers the stalled interval first', async () => {
    const { unmount: unmountObserver } = renderReaders([]);
    const { unmount: unmountOwner } = renderReaders();
    window.dispatchEvent(new StorageEvent('storage', { key: activeKey }));
    await advance(120_000);
    vi.setSystemTime(new Date(initialTime.getTime() + 3_720_000));
    await advance(1_000);
    expect(active()).toBeNull();
    await act(async () => {
      window.dispatchEvent(new StorageEvent('storage', { key: activeKey }));
    });
    await advance(1_000);
    await advance(30_000);
    unmountOwner();
    unmountObserver();
    expect(saved().map((session) => session.durationMs)).toEqual([120_000, 30_000]);
    expect(saved()[1].startedAt).toBe('2026-10-19T16:02:02.000Z');
    expect(active()).toBeNull();
  });

  it('excludes a stalled hour when the reader hides before its next heartbeat tick', async () => {
    const view = renderReaders();
    await advance(120_000);
    vi.setSystemTime(new Date(initialTime.getTime() + 3_720_000));
    await visibility('hidden');
    view.unmount();
    expect(saved()).toEqual([
      expect.objectContaining({ durationMs: 120_000, endedAt: '2026-10-19T15:02:00.000Z' }),
    ]);
    expect(active()).toBeNull();
  });
});
