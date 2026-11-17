import { beforeEach, expect, it, vi } from 'vitest';
import { requestJson } from '../../../lib/apiClient';
import findUnfinishedJournal from '../findUnfinishedJournal';

vi.mock('../../../lib/apiClient', () => ({ requestJson: vi.fn() }));
beforeEach(() => vi.resetAllMocks());

it('requests one unfinished entry directly and forwards cancellation without scanning analysis', async () => {
  vi.mocked(requestJson).mockResolvedValue({ data: [{ id: 'older-draft' }], nextCursor: 'more' });
  const { signal } = new AbortController();
  expect(await findUnfinishedJournal(signal)).toBe('older-draft');
  expect(requestJson).toHaveBeenCalledExactlyOnceWith('/api/journal/entries?unfinished=1&limit=1', {
    signal,
  });
});

it('returns no draft for an empty result and surfaces an unavailable archive for retry', async () => {
  vi.mocked(requestJson)
    .mockResolvedValueOnce({ data: [], nextCursor: null })
    .mockRejectedValueOnce(new Error('Offline'));
  const { signal } = new AbortController();
  expect(await findUnfinishedJournal(signal)).toBeNull();
  await expect(findUnfinishedJournal(signal)).rejects.toThrow('Offline');
});
