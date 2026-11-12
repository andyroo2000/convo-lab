import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import JournalFollowUp from '../JournalFollowUp';
import useJournalReplies from '../useJournalReplies';
import { getJournalReply, sendJournalAnswer, undoJournalAnswer } from '../journalReplies';
import type { JournalAnalysis } from '../types';

vi.mock('../journalReplies', () => ({
  getJournalReply: vi.fn(),
  sendJournalAnswer: vi.fn(),
  undoJournalAnswer: vi.fn(),
}));
const analysis: JournalAnalysis = {
  id: 'analysis',
  sourceVersion: 1,
  status: 'ready',
  error: null,
  updatedAt: 'now',
  replyRevision: 0,
  result: {
    title: 'Movie',
    correctedText: '映画を見た。',
    correctedReading: '映画[えいが]を見[み]た。',
    question: '誰と見ましたか。',
    questionReading: '誰[だれ]と見[み]ましたか。',
    questionTranslation: 'Who did you watch it with?',
    segments: [],
  },
};
beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
});
function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return Wrapper;
}

it('hides English until requested and saves an optional answer locally', () => {
  const Wrapper = wrapper();
  render(
    <Wrapper>
      <JournalFollowUp ownerId="a" entryId="entry" analysis={analysis} />
    </Wrapper>
  );
  expect(screen.queryByText('Who did you watch it with?')).not.toBeInTheDocument();
  expect(screen.getByText('だれ')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Show English' }));
  expect(screen.getByText('Who did you watch it with?')).toBeInTheDocument();
  fireEvent.change(screen.getByRole('textbox'), { target: { value: '友達と見た。' } });
  expect(localStorage.getItem('convolab:journal-answer:a:entry:analysis')).toContain(
    '友達と見た。'
  );
  expect(sendJournalAnswer).not.toHaveBeenCalled();
});

it('reuses the client request after a lost response instead of appending twice', async () => {
  vi.mocked(sendJournalAnswer).mockRejectedValue(new Error('Offline'));
  vi.mocked(getJournalReply).mockRejectedValue(new Error('Not found'));
  const { result } = renderHook(
    () => useJournalReplies({ ownerId: 'a', entryId: 'entry', analysis }),
    { wrapper: wrapper() }
  );
  act(() => result.current.change('友達と。'));
  await act(() => result.current.submit());
  const first = vi.mocked(sendJournalAnswer).mock.calls[0][1];
  await act(() => result.current.submit());
  expect(vi.mocked(sendJournalAnswer).mock.calls[1][1]).toEqual(first);
  expect(result.current.draft.answer).toBe('友達と。');
  expect(result.current.waiting).toBe(true);
});

it('clears a submitted answer only after the analysis confirms its application', async () => {
  const request = {
    id: 'reply',
    analysisId: analysis.id,
    answer: '友達と。',
    expectedRevision: 0,
    replace: false,
  };
  localStorage.setItem(
    'convolab:journal-answer:a:entry:analysis',
    JSON.stringify({ answer: request.answer, replace: false, request })
  );
  const reply = {
    id: 'reply',
    parentId: null,
    answer: request.answer,
    status: 'ready' as const,
    result: null,
    error: null,
  };
  vi.mocked(getJournalReply).mockResolvedValue({ data: reply });
  const { result, rerender } = renderHook(
    ({ current }) => useJournalReplies({ ownerId: 'a', entryId: 'entry', analysis: current }),
    { wrapper: wrapper(), initialProps: { current: analysis } }
  );
  await waitFor(() => expect(getJournalReply).toHaveBeenCalled());
  expect(result.current.draft.answer).toBe(request.answer);
  rerender({ current: { ...analysis, currentReply: reply, replyRevision: 1 } });
  await waitFor(() => expect(result.current.draft.answer).toBe(''));
  expect(localStorage.getItem('convolab:journal-answer:a:entry:analysis')).toBeNull();
});

it('edits the last answer using replace and the current revision', async () => {
  const current = {
    ...analysis,
    replyRevision: 4,
    currentReply: {
      id: 'old',
      parentId: null,
      answer: '友達と。',
      status: 'ready' as const,
      result: null,
      error: null,
    },
  };
  vi.mocked(sendJournalAnswer).mockResolvedValue({
    data: { ...current.currentReply, id: 'new', status: 'queued' },
  });
  const { result } = renderHook(
    () => useJournalReplies({ ownerId: 'a', entryId: 'entry', analysis: current }),
    { wrapper: wrapper() }
  );
  act(() => result.current.editLast());
  act(() => result.current.change('妹と。'));
  await act(() => result.current.submit());
  expect(sendJournalAnswer).toHaveBeenCalledWith(
    'entry',
    expect.objectContaining({ replace: true, expectedRevision: 4, answer: '妹と。' })
  );
});

it('uses the shown revision for undo and refreshes after an ambiguous failure', async () => {
  vi.mocked(undoJournalAnswer).mockRejectedValue(new Error('Lost response'));
  const current = { ...analysis, replyRevision: 4 };
  const { result } = renderHook(
    () => useJournalReplies({ ownerId: 'a', entryId: 'entry', analysis: current }),
    { wrapper: wrapper() }
  );
  await act(() => result.current.undo());
  expect(undoJournalAnswer).toHaveBeenCalledWith('entry', current);
  expect(result.current.error).toContain('refreshed');
});
