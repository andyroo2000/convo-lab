import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import useJournalAnalysis from '../useJournalAnalysis';
import { getJournalAnalysis } from '../journalApi';
import type { JournalAnalysis, JournalEntry } from '../types';

vi.mock('../journalApi', () => ({ getJournalAnalysis: vi.fn() }));
afterEach(() => {
  vi.useRealTimers();
  vi.resetAllMocks();
});

it.each(['ready', 'failed'] as const)(
  'polls pending furigana and stops when it is %s',
  async (status) => {
    vi.useFakeTimers();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const entry: JournalEntry = {
      id: 'entry',
      title: null,
      body: '文',
      entryDate: '2026-11-20',
      version: 1,
      createdAt: '',
      updatedAt: '',
    };
    const analysis: JournalAnalysis = {
      id: 'analysis',
      sourceVersion: 1,
      status: 'ready',
      error: null,
      result: null,
      updatedAt: '',
      correctedDocument: { text: '文', reading: '文', suggestions: [], readingStatus: 'pending' },
    };
    vi.mocked(getJournalAnalysis).mockResolvedValue({
      entry,
      data: {
        ...analysis,
        correctedDocument: { ...analysis.correctedDocument!, readingStatus: status },
      },
    });
    const { result, unmount } = renderHook(
      () =>
        useJournalAnalysis({
          ownerId: 'owner',
          entryId: entry.id,
          enabled: true,
          submitted: 0,
          initial: { data: analysis, entry },
          onEntry: vi.fn(),
        }),
      {
        wrapper: ({ children }: { children: ReactNode }) => (
          <QueryClientProvider client={client}>{children}</QueryClientProvider>
        ),
      }
    );
    expect(getJournalAnalysis).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2100);
    });
    expect(getJournalAnalysis).toHaveBeenCalledOnce();
    expect(result.current.data?.data?.correctedDocument?.readingStatus).toBe(status);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6000);
    });
    expect(getJournalAnalysis).toHaveBeenCalledOnce();
    unmount();
    client.clear();
  }
);
