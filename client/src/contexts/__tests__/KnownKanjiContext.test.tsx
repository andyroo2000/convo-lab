import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { decodeKnownKanjiResponse } from '../../lib/learningOsContractDecoders';
import { knownKanjiCompatibilityFixture } from '../../test/fixtures/learningOsCompatibility';
import { KnownKanjiProvider, useKnownKanjiContext } from '../KnownKanjiContext';

const { mutateMock, useKnownKanjiMock } = vi.hoisted(() => ({
  mutateMock: vi.fn(),
  useKnownKanjiMock: vi.fn(),
}));

const syncMutation = { mutate: mutateMock };

const ContextProbe = () => {
  const context = useKnownKanjiContext();
  return (
    <div>
      <span data-testid="known-kanji-active">{String(context.active)}</span>
      <span data-testid="transfer-bridge">
        {context.transferBridge ? JSON.stringify(context.transferBridge) : 'absent'}
      </span>
    </div>
  );
};

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

  it('keeps the context active for a legacy snapshot without inventing bridge state', () => {
    useKnownKanjiMock.mockReturnValue({
      data: decodeKnownKanjiResponse(knownKanjiCompatibilityFixture.cases[0].payload),
      isSuccess: true,
    });

    render(
      <KnownKanjiProvider>
        <ContextProbe />
      </KnownKanjiProvider>
    );

    expect(screen.getByTestId('known-kanji-active')).toHaveTextContent('true');
    expect(screen.getByTestId('transfer-bridge')).toHaveTextContent('absent');
  });

  it('publishes the canonical v2 bridge status to context consumers', () => {
    useKnownKanjiMock.mockReturnValue({
      data: decodeKnownKanjiResponse(knownKanjiCompatibilityFixture.cases[1].payload),
      isSuccess: true,
    });

    render(
      <KnownKanjiProvider>
        <ContextProbe />
      </KnownKanjiProvider>
    );

    expect(JSON.parse(screen.getByTestId('transfer-bridge').textContent ?? '')).toEqual({
      enabled: true,
      importedVocabularyCount: 1,
      pendingVocabularyCount: 1,
      failedVocabularyCount: 1,
      lastImportedAt: '2026-08-25T11:00:00.000000Z',
    });
  });
});
