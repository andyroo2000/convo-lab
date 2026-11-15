import { beforeEach, expect, it, vi } from 'vitest';
import { requestJson } from '../../../lib/apiClient';
import {
  answerClarification,
  readClarification,
  startClarification,
  type JournalClarification,
} from '../journalClarification';

vi.mock('../../../lib/apiClient', () => ({ requestJson: vi.fn() }));
beforeEach(() => vi.resetAllMocks());
it('sends versioned questions and preserves abort signals', async () => {
  const { signal } = new AbortController();
  const entry = { id: 'entry/one', version: 3 };
  const state: JournalClarification = {
    id: 'check',
    sourceVersion: 3,
    revision: 0,
    status: 'waiting',
    question: { id: 'who', prompt: 'Who?', choices: ['Me', 'Molly'] },
    error: null,
    updatedAt: '',
  };
  vi.mocked(requestJson).mockResolvedValue({ data: state });
  expect(await startClarification(entry, signal)).toBe(state);
  expect(requestJson).toHaveBeenLastCalledWith('/api/journal/entries/entry%2Fone/clarification', {
    method: 'POST',
    body: '{"expectedVersion":3}',
    signal,
  });
  await answerClarification(entry, state, 'Me', signal);
  expect(requestJson).toHaveBeenLastCalledWith(
    '/api/journal/entries/entry%2Fone/clarification/check/answer',
    {
      method: 'POST',
      body: '{"expectedVersion":3,"questionId":"who","answer":"Me"}',
      signal,
    }
  );
  expect(await readClarification(entry, signal)).toBe(state);
  vi.mocked(requestJson).mockResolvedValue({ data: null });
  await expect(readClarification(entry, signal)).rejects.toThrow('draft changed');
});
