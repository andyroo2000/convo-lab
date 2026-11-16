import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import { JsonRequestError, requestJson } from '../../../lib/apiClient';
import useJournalDocument from '../useJournalDocument';
import type { JournalAnalysis } from '../types';

vi.mock('../../../lib/apiClient', async (original) => ({
  ...(await original<typeof import('../../../lib/apiClient')>()),
  requestJson: vi.fn(),
}));
const analysis: JournalAnalysis = {
  id: 'a',
  sourceVersion: 1,
  status: 'ready',
  result: null,
  error: null,
  updatedAt: '',
  replyRevision: 2,
};
beforeEach(() => {
  vi.mocked(requestJson).mockReset();
});
function setup() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const refresh = vi.spyOn(client, 'invalidateQueries');
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const view = renderHook(
    () => useJournalDocument({ ownerId: 'owner', entryId: 'entry', analysis }),
    { wrapper }
  );
  return { ...view, refresh, client };
}
it('saves exact final text and refreshes the saved analysis', async () => {
  vi.mocked(requestJson).mockResolvedValue({ data: analysis });
  const { result, refresh } = setup();
  await act(async () => {
    await result.current.change({ text: '新しい文章。' });
  });
  expect(requestJson).toHaveBeenCalledWith('/api/journal/entries/entry/corrected', {
    method: 'PUT',
    body: JSON.stringify({
      analysisId: 'a',
      expectedRevision: 2,
      text: '新しい文章。',
    }),
  });
  expect(refresh).toHaveBeenCalledWith({ queryKey: ['journal-analysis', 'owner', 'entry'] });
});
it('refetches a conflict without retrying or replacing the editor revision', async () => {
  vi.mocked(requestJson).mockRejectedValue(new JsonRequestError('Changed', 409, null));
  const { result, refresh } = setup();
  await act(async () => {
    expect(await result.current.change({ text: '編集' }, 1)).toBe(false);
  });
  expect(requestJson).toHaveBeenCalledTimes(1);
  expect(refresh).toHaveBeenCalled();
  await waitFor(() => expect(result.current.error).toContain('Your edits are still here'));
});

it('publishes saved text and its audio revision to entry and conversation caches even if refresh fails', async () => {
  const saved = {
    ...analysis,
    replyRevision: 3,
    correctedDocument: { text: '編集', reading: '編集[へんしゅう]', suggestions: [] },
  };
  vi.mocked(requestJson).mockResolvedValue({ data: saved });
  const { result, client, refresh } = setup();
  const key = ['journal-analysis', 'owner', 'entry', 0];
  client.setQueryData(key, { data: analysis, entry: { id: 'entry', body: 'Original draft' } });
  client.setQueryData(['journal-conversation', 'owner', 'root'], {
    data: [{ entry: { id: 'entry' }, analysis }],
  });
  client.setQueryData(['journal-analysis', 'other', 'entry', 0], { data: analysis });
  refresh.mockRejectedValue(new Error('Offline'));
  await act(async () => {
    expect(await result.current.change({ text: '編集' })).toBe(true);
  });
  expect(client.getQueryData(key)).toEqual({
    data: saved,
    entry: { id: 'entry', body: 'Original draft' },
  });
  expect(client.getQueryData(['journal-conversation', 'owner', 'root'])).toEqual({
    data: [{ entry: { id: 'entry' }, analysis: saved }],
  });
  expect(client.getQueryData(['journal-analysis', 'other', 'entry', 0])).toEqual({
    data: analysis,
  });
});
it('does not replace a newer revision with an older acknowledgement', async () => {
  vi.mocked(requestJson).mockResolvedValue({ data: { ...analysis, replyRevision: 3 } });
  const { result, client } = setup();
  const key = ['journal-analysis', 'owner', 'entry', 0];
  const newer = { data: { ...analysis, replyRevision: 4 } };
  client.setQueryData(key, newer);
  await act(async () => result.current.change({ text: '編集' }));
  expect(client.getQueryData(key)).toEqual(newer);
});
