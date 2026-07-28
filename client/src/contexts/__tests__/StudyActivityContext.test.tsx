import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { StudyActivityProvider, useStudyActivityTimer } from '../StudyActivityContext';

const { saveSessionsMock } = vi.hoisted(() => ({
  saveSessionsMock: vi.fn(),
}));

vi.mock('../../hooks/useStudyActivity', () => ({
  saveStudyActivitySessions: saveSessionsMock,
  studyActivityKeys: { all: ['study-activity'] },
}));

const Controls = () => {
  const { active, start, stop, addCreatedCards } = useStudyActivityTimer();
  return (
    <>
      <p>{active?.activity ?? 'inactive'}</p>
      <button
        type="button"
        onClick={() =>
          start({
            category: 'create',
            activity: 'card_creation',
            source: 'manual',
            name: 'Deck work',
          })
        }
      >
        Start manual
      </button>
      <button
        type="button"
        onClick={() =>
          start({
            category: 'review',
            activity: 'card_review',
            source: 'automatic',
          })
        }
      >
        Start automatic
      </button>
      <button type="button" onClick={() => stop()}>
        Stop
      </button>
      <button
        type="button"
        onClick={() =>
          start({
            category: 'review',
            activity: 'daily_audio',
            source: 'automatic',
            name: 'Drill',
          })
        }
      >
        Start audio
      </button>
      <button type="button" onClick={() => addCreatedCards(2)}>
        Add cards
      </button>
    </>
  );
};

function renderProvider() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <StudyActivityProvider userId={42}>
        <Controls />
      </StudyActivityProvider>
    </QueryClientProvider>
  );
}

describe('StudyActivityProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-28T15:00:00.000Z'));
    saveSessionsMock.mockReset().mockResolvedValue([]);
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(
      '018f22d2-6d38-7000-8000-000000000001'
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('keeps a manual session primary when automatic tracking engages', () => {
    renderProvider();

    fireEvent.click(screen.getByRole('button', { name: 'Start manual' }));
    fireEvent.click(screen.getByRole('button', { name: 'Start automatic' }));

    expect(screen.getByText('card_creation')).toBeInTheDocument();
    expect(saveSessionsMock).not.toHaveBeenCalled();
  });

  it('caps a stale recovered automatic timer at five minutes', async () => {
    localStorage.setItem(
      'convolab.studyActivity.active.v1.42',
      JSON.stringify({
        clientSessionId: '018f22d2-6d38-7000-8000-000000000002',
        category: 'review',
        activity: 'card_review',
        source: 'automatic',
        startedAt: '2026-07-28T14:00:00.000Z',
        cardsCreated: 0,
      })
    );

    renderProvider();

    await act(async () => {
      await Promise.resolve();
    });
    expect(saveSessionsMock).toHaveBeenCalledTimes(1);
    expect(saveSessionsMock).toHaveBeenCalledWith([
      expect.objectContaining({
        durationMs: 300_000,
        endedAt: '2026-07-28T14:05:00.000Z',
      }),
    ]);
    expect(screen.getByText('inactive')).toBeInTheDocument();
  });

  it('caps a stale recovered manual timer at six hours', async () => {
    localStorage.setItem(
      'convolab.studyActivity.active.v1.42',
      JSON.stringify({
        clientSessionId: '018f22d2-6d38-7000-8000-000000000003',
        category: 'immerse',
        activity: 'reading',
        source: 'manual',
        startedAt: '2026-07-27T15:00:00.000Z',
        cardsCreated: 0,
      })
    );

    renderProvider();
    await act(async () => {
      await Promise.resolve();
    });

    expect(saveSessionsMock).toHaveBeenCalledWith([
      expect.objectContaining({
        durationMs: 21_600_000,
        endedAt: '2026-07-27T21:00:00.000Z',
      }),
    ]);
  });

  it('caps a manual timer that becomes stale while the app remains open', async () => {
    renderProvider();
    fireEvent.click(screen.getByRole('button', { name: 'Start manual' }));

    vi.setSystemTime(new Date('2026-07-28T21:00:01.000Z'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(saveSessionsMock).toHaveBeenCalledWith([
      expect.objectContaining({
        durationMs: 21_600_000,
        endedAt: '2026-07-28T21:00:00.000Z',
      }),
    ]);
    expect(screen.getByText('inactive')).toBeInTheDocument();
  });

  it('records audio playback duration and one-off card output', async () => {
    renderProvider();

    fireEvent.click(screen.getByRole('button', { name: 'Start audio' }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(120_000);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }));

    expect(saveSessionsMock).toHaveBeenCalledWith([
      expect.objectContaining({
        activity: 'daily_audio',
        durationMs: 120_000,
        audioPlaybackMs: 120_000,
      }),
    ]);

    fireEvent.click(screen.getByRole('button', { name: 'Add cards' }));
    expect(saveSessionsMock).toHaveBeenCalledWith([
      expect.objectContaining({
        activity: 'card_creation',
        durationMs: 0,
        cardsCreated: 2,
      }),
    ]);
  });
});
