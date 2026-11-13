import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, expect, it, vi } from 'vitest';
import JournalConversation from '../JournalConversation';
import useConversationAnswer from '../useConversationAnswer';
import { JsonRequestError } from '../../../lib/apiClient';
import { createConversationAnswer, getJournalConversation } from '../journalConversationApi';
import { getJournalEntry, submitJournalEntry } from '../journalApi';
import { removeJournalDeviceData } from '../journalDeviceCleanup';
import { draftFromEntry, JournalDraftStore } from '../journalDrafts';
import type { JournalAnalysis, JournalEntry } from '../types';

vi.mock('../journalConversationApi', () => ({
  createConversationAnswer: vi.fn(),
  getJournalConversation: vi.fn(),
}));
vi.mock('../journalApi', () => ({ getJournalEntry: vi.fn(), submitJournalEntry: vi.fn() }));
vi.mock('../JournalTeacher', () => ({ default: () => <p>Saved tutor question</p> }));
vi.mock('../JournalConversationComposer', () => ({ default: () => <div>Answer composer</div> }));
vi.mock('../JournalAudioPlayer', () => ({ default: () => <div>Audio</div> }));
const entry: JournalEntry = {
  id: '01m78r7b8rv4c2719e742qp1me',
  rootEntryId: 'root',
  title: null,
  body: '友達と見た。',
  version: 1,
  entryDate: '2026-11-13',
  createdAt: '',
  updatedAt: '',
};
const feedback = (text: string): JournalAnalysis => ({
  id: text,
  sourceVersion: 1,
  status: 'ready',
  error: null,
  updatedAt: '',
  result: {
    title: 'Movie',
    correctedText: text,
    correctedReading: text,
    question: 'どうでしたか。',
    questionReading: 'どうでしたか。',
    questionTranslation: 'How was it?',
    segments: [],
  },
});
function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
});
it('keeps independent Draft/Final controls without appending the child to the root', async () => {
  vi.mocked(getJournalConversation).mockResolvedValue({
    data: [
      {
        entry,
        analysis: feedback('友達と見ました。'),
        parentEntryId: 'root',
        question: {
          id: 'question',
          text: '誰と？',
          reading: '誰[だれ]と？',
          translation: 'With whom?',
          tutor: null,
        },
      },
    ],
  });
  render(
    <JournalConversation
      onOpen={vi.fn()}
      ownerId="a"
      entryId="root"
      analysis={feedback('映画を見ました。')}
    />,
    { wrapper }
  );
  await screen.findByText('Your reply');
  expect(screen.getAllByRole('button', { name: 'Draft' })).toHaveLength(2);
  expect(screen.getAllByRole('button', { name: 'Final' })[1]).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  expect(screen.getAllByRole('region', { name: 'Corrected Version' })[1]).toHaveTextContent(
    '友達と見ました。'
  );
  expect(screen.getAllByRole('button', { name: 'Final' })[0]).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  const root = screen.getAllByRole('region', { name: 'Corrected Version' })[0];
  expect(root).toHaveTextContent('映画を見ました。');
  expect(root).not.toHaveTextContent('友達');
  fireEvent.click(screen.getAllByRole('button', { name: 'Draft' })[1]);
  expect(screen.getAllByRole('region', { name: 'Corrected Version' })).toEqual([root]);
  fireEvent.click(screen.getAllByRole('button', { name: 'Final' })[1]);
  expect(screen.getAllByRole('region', { name: 'Corrected Version' })).toHaveLength(2);
  expect(getJournalEntry).not.toHaveBeenCalled();
  expect(screen.getAllByText('Answer composer')).toHaveLength(1);
});
it('retries the exact saved request after an uncertain network failure', async () => {
  vi.mocked(createConversationAnswer)
    .mockRejectedValueOnce(new Error('Offline'))
    .mockResolvedValue({ data: entry });
  const saved = vi.fn().mockResolvedValue(undefined);
  const { result } = renderHook(() =>
    useConversationAnswer('draft-key', 'root', 'question', saved)
  );
  act(() => result.current.change(entry.body));
  await act(() => result.current.submit());
  const original = vi.mocked(createConversationAnswer).mock.calls[0][1];
  expect(result.current.error).toBe('Offline');
  expect(JSON.parse(localStorage.getItem('draft-key')!).request).toEqual(original);
  await act(() => result.current.submit());
  expect(createConversationAnswer).toHaveBeenLastCalledWith('root', original);
  expect(submitJournalEntry).toHaveBeenCalledWith(entry);
  expect(saved).toHaveBeenCalledOnce();
  expect(localStorage.getItem('draft-key')).toBeNull();
});
it('shows the saved answer when feedback submission fails', async () => {
  vi.mocked(createConversationAnswer).mockResolvedValue({ data: entry });
  vi.mocked(submitJournalEntry).mockRejectedValue(new Error('Queue unavailable'));
  const saved = vi.fn().mockResolvedValue(undefined);
  const { result } = renderHook(() =>
    useConversationAnswer('draft-key', 'root', 'question', saved)
  );
  act(() => result.current.change(entry.body));
  await act(() => result.current.submit());
  expect(saved).toHaveBeenCalledOnce();
});
it('preserves the root link in device drafts so replies stay unlisted', () => {
  const store = new JournalDraftStore('a');
  store.put(draftFromEntry(entry));
  expect(store.get(entry.id)?.rootEntryId).toBe('root');
});

it('root deletion also clears its locally edited replies', () => {
  const store = new JournalDraftStore('a');
  store.put(draftFromEntry(entry));
  removeJournalDeviceData('a', 'root');
  expect(store.get(entry.id)).toBeNull();
});

it('distinguishes a saved answer from a failed conversation reload', async () => {
  vi.mocked(createConversationAnswer).mockResolvedValue({ data: entry });
  const saved = vi.fn().mockRejectedValue(new Error('Offline'));
  const { result } = renderHook(() =>
    useConversationAnswer('draft-key', 'root', 'question', saved)
  );
  act(() => result.current.change(entry.body));
  await act(() => result.current.submit());
  expect(result.current.error).toBe('Your answer is saved. Reload the conversation to see it.');
  expect(result.current.draft.request).toEqual(
    JSON.parse(localStorage.getItem('draft-key')!).request
  );
});

it.each([404, 409, 422])('keeps rejected answers editable after HTTP %s', async (status) => {
  vi.mocked(createConversationAnswer).mockRejectedValue(
    new JsonRequestError('Rejected', status, null)
  );
  const { result } = renderHook(() =>
    useConversationAnswer('draft-key', 'root', 'question', vi.fn())
  );
  act(() => result.current.change(entry.body));
  await act(() => result.current.submit());
  expect(result.current.draft.request).toBeUndefined();
  expect(result.current.draft.body).toBe(entry.body);
});
