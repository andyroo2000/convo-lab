import { act, render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import JournalSyncProvider from '../JournalSyncProvider';
import { saveJournalDraft } from '../journalApi';
import { JournalDraftStore, newJournalDraft } from '../journalDrafts';
import type { JournalDraft } from '../types';

vi.mock('../journalApi', () => ({ saveJournalDraft: vi.fn() }));
const send = vi.mocked(saveJournalDraft);
const response = (draft: JournalDraft) => ({
  ...draft,
  version: 1,
  createdAt: 'now',
  updatedAt: 'now',
});
beforeEach(() => {
  localStorage.clear();
  send.mockReset();
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});
function savedDraft(owner = 'owner') {
  const draft = { ...newJournalDraft(), body: 'Locally saved writing' };
  new JournalDraftStore(owner).put(draft);
  return draft;
}
function screen(client: QueryClient, ownerId: string) {
  return (
    <QueryClientProvider client={client}>
      <JournalSyncProvider ownerId={ownerId}>
        <div>Journal</div>
      </JournalSyncProvider>
    </QueryClientProvider>
  );
}

it('drains on mount, invalidates Contents after acknowledgement, and stops on unmount', async () => {
  const draft = savedDraft();
  send.mockResolvedValue(response(draft));
  const client = new QueryClient();
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  const view = render(screen(client, 'owner'));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
  expect(send).toHaveBeenCalledWith(draft, expect.any(AbortSignal), 'owner');
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['journal-archive', 'owner'] });
  expect(new JournalDraftStore('owner').get(draft.id)).toBeNull();
  view.unmount();
  savedDraft();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(10000);
  });
  expect(send).toHaveBeenCalledTimes(1);
});

it('focus respects failure backoff while reconnect retries immediately', async () => {
  savedDraft();
  send.mockRejectedValue(new Error('offline'));
  const view = render(screen(new QueryClient(), 'owner'));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
  expect(send).toHaveBeenCalledTimes(1);
  await act(async () => {
    window.dispatchEvent(new Event('focus'));
  });
  expect(send).toHaveBeenCalledTimes(1);
  await act(async () => {
    window.dispatchEvent(new Event('online'));
  });
  expect(send).toHaveBeenCalledTimes(2);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(3000);
  });
  expect(send).toHaveBeenCalledTimes(2);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(3000);
  });
  expect(send).toHaveBeenCalledTimes(3);
  view.unmount();
});

it('switching accounts aborts the old request and never uploads its draft as the new owner', async () => {
  const draft = savedDraft('first');
  let signal: AbortSignal | undefined;
  send.mockImplementation((_draft, activeSignal) => {
    signal = activeSignal;
    return new Promise(() => {});
  });
  const client = new QueryClient();
  const view = render(screen(client, 'first'));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
  expect(signal?.aborted).toBe(false);
  view.rerender(screen(client, 'second'));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
  expect(signal?.aborted).toBe(true);
  expect(send).toHaveBeenCalledTimes(1);
  expect(send.mock.calls[0]?.[2]).toBe('first');
  expect(new JournalDraftStore('first').get(draft.id)).toEqual(draft);
  expect(new JournalDraftStore('second').list()).toEqual([]);
});
