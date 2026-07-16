import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { KnownKanjiProvider } from '../KnownKanjiContext';

const { mutateMock, useKnownKanjiMock } = vi.hoisted(() => ({
  mutateMock: vi.fn(),
  useKnownKanjiMock: vi.fn(),
}));

const syncMutation = { mutate: mutateMock };

vi.mock('../../hooks/useFeatureFlags', () => ({
  useFeatureFlags: () => ({ flags: { studyApiSettingsWrite: true } }),
}));

vi.mock('../../hooks/useKnownKanji', () => ({
  useKnownKanji: () => useKnownKanjiMock(),
  useSyncWaniKani: () => syncMutation,
}));

describe('KnownKanjiProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-16T12:30:00.000Z'));
    mutateMock.mockReset();
    useKnownKanjiMock.mockReturnValue({
      data: {
        kanji: ['私'],
        wanikani: {
          connected: true,
          lastSyncedAt: '2026-07-16T12:00:00.000Z',
        },
      },
      enabled: true,
      isSuccess: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('retries a failed stale sync after the auto-sync interval', async () => {
    mutateMock.mockImplementation((_variables: undefined, options: { onError?: () => void }) =>
      options.onError?.()
    );

    render(
      <KnownKanjiProvider>
        <div />
      </KnownKanjiProvider>
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(mutateMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15 * 60 * 1000 - 1);
    });
    expect(mutateMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(mutateMock).toHaveBeenCalledTimes(2);
  });

  it('schedules the first sync for a connected account that has never synced', async () => {
    useKnownKanjiMock.mockReturnValue({
      data: {
        kanji: [],
        wanikani: { connected: true, lastSyncedAt: null },
      },
      enabled: true,
      isSuccess: true,
    });

    render(
      <KnownKanjiProvider>
        <div />
      </KnownKanjiProvider>
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15 * 60 * 1000 - 1);
    });
    expect(mutateMock).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(mutateMock).toHaveBeenCalledTimes(1);
  });
});
