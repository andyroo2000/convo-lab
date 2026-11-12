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
  return { ...view, refresh };
}
it('sends exact suggestion state and refreshes the saved analysis', async () => {
  vi.mocked(requestJson).mockResolvedValue({ data: analysis });
  const { result, refresh } = setup();
  await act(async () => {
    await result.current.change({ suggestionId: 'a:1', applied: false });
  });
  expect(requestJson).toHaveBeenCalledWith('/api/journal/entries/entry/suggestion', {
    method: 'PUT',
    body: JSON.stringify({
      analysisId: 'a',
      expectedRevision: 2,
      suggestionId: 'a:1',
      applied: false,
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
