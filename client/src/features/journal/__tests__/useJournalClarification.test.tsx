import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import useJournalClarification from '../useJournalClarification';
import {
  answerClarification,
  readClarification,
  startClarification,
  type JournalClarification,
} from '../journalClarification';

vi.mock('../journalClarification', async (original) => ({
  ...(await original<typeof import('../journalClarification')>()),
  startClarification: vi.fn(),
  readClarification: vi.fn(),
  answerClarification: vi.fn(),
}));
const entry = { id: 'entry', version: 4 };
const question = {
  id: 'drive',
  prompt: 'Who was driving?',
  choices: ['I was driving', 'Molly was driving'],
};
const waiting: JournalClarification = {
  id: 'session',
  sourceVersion: 4,
  revision: 0,
  status: 'waiting',
  question,
  error: null,
  updatedAt: '',
};
const resolved: JournalClarification = { ...waiting, status: 'resolved', question: null };
beforeEach(() => vi.resetAllMocks());

it('replaces each question and resolves only after the final meaning check', async () => {
  vi.mocked(startClarification).mockResolvedValue(waiting);
  vi.mocked(answerClarification)
    .mockResolvedValueOnce({
      ...waiting,
      revision: 1,
      question: { ...question, id: 'clarify', prompt: 'Were you driving, or was Molly?' },
    })
    .mockResolvedValueOnce({
      ...waiting,
      revision: 2,
      question: { ...question, id: 'scene', prompt: 'Which scene was unclear?' },
    })
    .mockResolvedValueOnce(resolved);
  const complete = vi.fn();
  const { result } = renderHook(() => useJournalClarification('owner:entry'));
  act(() => {
    result.current.begin(entry).then(complete);
  });
  await waitFor(() => expect(result.current.state?.question?.id).toBe('drive'));
  await act(() => result.current.answer('yes'));
  expect(result.current.state?.question?.id).toBe('clarify');
  expect(complete).not.toHaveBeenCalled();
  await act(() => result.current.answer('I was driving'));
  expect(result.current.state?.question?.id).toBe('scene');
  expect(complete).not.toHaveBeenCalled();
  await act(() => result.current.answer('The last scene'));
  expect(complete).toHaveBeenCalledWith('session');
  expect(result.current.active).toBe(false);
  expect(result.current.state).toBeNull();
});

it('polls queued checks before showing a question', async () => {
  vi.mocked(startClarification).mockResolvedValue({ ...waiting, status: 'queued', question: null });
  vi.mocked(readClarification).mockResolvedValue(waiting);
  const { result, unmount } = renderHook(() => useJournalClarification('owner:entry'));
  act(() => {
    result.current.begin(entry);
  });
  await waitFor(() => expect(result.current.state?.question).toEqual(question), { timeout: 2500 });
  expect(result.current.busy).toBe(false);
  unmount();
});

it('keeps failures blocked and retries the same saved version', async () => {
  vi.mocked(startClarification)
    .mockRejectedValueOnce(new Error('Offline'))
    .mockResolvedValueOnce(resolved);
  const complete = vi.fn();
  const { result } = renderHook(() => useJournalClarification('owner:entry'));
  act(() => {
    result.current.begin(entry).then(complete);
  });
  await waitFor(() => expect(result.current.error).toBe('Offline'));
  expect(complete).not.toHaveBeenCalled();
  expect(result.current.active).toBe(true);
  await act(() => result.current.retry());
  expect(startClarification).toHaveBeenLastCalledWith(entry, expect.any(AbortSignal));
  expect(complete).toHaveBeenCalledWith('session');
});

it('cancels on owner or entry changes and ignores late responses', async () => {
  let finish: (value: JournalClarification) => void = () => undefined;
  vi.mocked(startClarification).mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      })
  );
  const complete = vi.fn();
  const { result, rerender } = renderHook(({ scope }) => useJournalClarification(scope), {
    initialProps: { scope: 'first:entry' },
  });
  act(() => {
    result.current.begin(entry).then(complete);
  });
  const signal = vi.mocked(startClarification).mock.calls[0][1];
  rerender({ scope: 'other:entry' });
  await act(async () => {
    finish(resolved);
  });
  expect(signal.aborted).toBe(true);
  expect(complete).toHaveBeenCalledWith(undefined);
  expect(result.current.active).toBe(false);
  expect(result.current.state).toBeNull();
});

it('rejects a resolved response for another draft version', async () => {
  vi.mocked(startClarification).mockResolvedValue({ ...resolved, sourceVersion: 3 });
  const complete = vi.fn();
  const { result, unmount } = renderHook(() => useJournalClarification('owner:entry'));
  act(() => {
    result.current.begin(entry).then(complete);
  });
  await waitFor(() => expect(result.current.error).toContain('draft changed'));
  expect(complete).not.toHaveBeenCalled();
  unmount();
});

it('retries the exact unanswered question and text after a failed answer request', async () => {
  vi.mocked(startClarification).mockResolvedValue(waiting);
  vi.mocked(answerClarification)
    .mockRejectedValueOnce(new Error('Offline'))
    .mockResolvedValueOnce(resolved);
  const complete = vi.fn();
  const { result } = renderHook(() => useJournalClarification('owner:entry'));
  act(() => {
    result.current.begin(entry).then(complete);
  });
  await waitFor(() => expect(result.current.state?.question).toEqual(question));
  await act(() => result.current.answer('Molly searched while I drove'));
  expect(result.current.error).toBe('Offline');
  expect(complete).not.toHaveBeenCalled();
  await act(() => result.current.retry());
  expect(answerClarification).toHaveBeenLastCalledWith(
    entry,
    waiting,
    'Molly searched while I drove',
    expect.any(AbortSignal)
  );
  expect(startClarification).toHaveBeenCalledOnce();
  expect(complete).toHaveBeenCalledWith('session');
});
