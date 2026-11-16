import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, expect, it, vi } from 'vitest';
import JournalEditor from '../JournalEditor';
import { waitingPhrases } from '../journalThinkingContent';
import { saveJournalDraft, submitJournalEntry } from '../journalApi';
import {
  startClarification,
  answerClarification,
  type JournalClarification,
} from '../journalClarification';
import { newJournalDraft, JournalDraftStore } from '../journalDrafts';
import type { JournalAnalysis } from '../types';

vi.mock('../journalApi', () => ({
  getJournalEntry: vi.fn(),
  saveJournalDraft: vi.fn(),
  submitJournalEntry: vi.fn(),
  getJournalAnalysis: vi.fn(() => new Promise(() => {})),
}));
vi.mock('../journalClarification', async (original) => ({
  ...(await original<typeof import('../journalClarification')>()),
  startClarification: vi.fn(),
  answerClarification: vi.fn(),
}));
vi.mock('../journalTutor', () => ({
  getTutorPreferences: async () => ({ data: { tutors: [] } }),
  tutorAvatar: () => undefined,
}));
vi.mock('../JournalEditorForm', () => ({
  default: ({ editor }: { editor: { save: (submit: boolean) => Promise<boolean> } }) => (
    <button
      type="button"
      onClick={() => {
        editor.save(true);
      }}
    >
      Submit draft
    </button>
  ),
}));
const meaning: JournalClarification = {
  id: 'meaning',
  sourceVersion: 1,
  revision: 0,
  status: 'waiting',
  question: { id: 'drive', prompt: 'Who drove?', choices: ['私です。', '友達です。'] },
  error: null,
  updatedAt: '',
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}
function setup() {
  const draft = { ...newJournalDraft(), body: '映画を見ました。' };
  new JournalDraftStore('owner').put(draft);
  const entry = { ...draft, version: 1, createdAt: 'now', updatedAt: 'now' };
  vi.mocked(saveJournalDraft).mockResolvedValue(entry);
  vi.mocked(startClarification).mockResolvedValue(meaning);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <JournalEditor
        ownerId="owner"
        entryId={entry.id}
        onOpen={vi.fn()}
        onSaved={vi.fn()}
        renderFeedback={() => <p>Feedback ready</p>}
      />
    </QueryClientProvider>
  );
  fireEvent.click(screen.getByRole('button', { name: 'Submit draft' }));
  return { entry, client, ...view };
}
async function answer() {
  fireEvent.click(await screen.findByRole('radio', { name: '私です。' }));
  fireEvent.click(screen.getByRole('button', { name: 'Answer' }));
}
const thinking = () => screen.getByRole('region', { name: 'Your tutor is thinking' });
beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

it('retains the same tutor screen through answer, submission and processing until feedback is ready', async () => {
  const clarification = deferred<JournalClarification>();
  const submission = deferred<JournalAnalysis>();
  vi.mocked(answerClarification).mockReturnValue(clarification.promise);
  vi.mocked(submitJournalEntry).mockReturnValue(submission.promise);
  const { client, entry } = setup();
  await answer();
  const panel = thinking();
  expect(screen.queryByRole('button', { name: 'Back to draft' })).not.toBeInTheDocument();
  const phrase = screen.getByText(
    new RegExp(waitingPhrases.map((item) => item.japanese).join('|'))
  );
  expect(screen.getByText('私です。')).toBeInTheDocument();
  await act(async () => clarification.resolve({ ...meaning, status: 'resolved', question: null }));
  await waitFor(() => expect(submitJournalEntry).toHaveBeenCalled());
  expect(thinking()).toBe(panel);
  expect(screen.queryByRole('button', { name: 'Submit draft' })).not.toBeInTheDocument();
  await act(async () =>
    submission.resolve({ id: 'analysis', status: 'queued' } as JournalAnalysis)
  );
  expect(thinking()).toBe(panel);
  expect(phrase).toBeInTheDocument();
  act(() =>
    client.setQueryData(['journal-analysis', 'owner', entry.id, 1], {
      entry,
      data: { id: 'analysis', status: 'ready' },
    })
  );
  await screen.findByText('Feedback ready');
  expect(screen.queryByRole('region', { name: 'Your tutor is thinking' })).not.toBeInTheDocument();
});

it('returns to the saved draft if submission fails instead of leaving the tutor waiting', async () => {
  vi.mocked(answerClarification).mockResolvedValue({
    ...meaning,
    status: 'resolved',
    question: null,
  });
  vi.mocked(submitJournalEntry).mockRejectedValue(new Error('Offline'));
  setup();
  await answer();
  await screen.findByText('Saved, but feedback could not be requested. Try Submit again.');
  expect(screen.getByRole('button', { name: 'Submit draft' })).toBeInTheDocument();
  expect(screen.queryByRole('region', { name: 'Your tutor is thinking' })).not.toBeInTheDocument();
});

it('keeps a retry available when feedback polling fails', async () => {
  vi.mocked(answerClarification).mockResolvedValue({
    ...meaning,
    status: 'resolved',
    question: null,
  });
  vi.mocked(submitJournalEntry).mockResolvedValue({ status: 'queued' } as JournalAnalysis);
  const { client, entry } = setup();
  await answer();
  await waitFor(() => expect(submitJournalEntry).toHaveBeenCalled());
  await waitFor(() =>
    expect(client.getQueryData(['journal-analysis', 'owner', entry.id, 1])).toBeDefined()
  );
  act(() =>
    client
      .getQueryCache()
      .find({ queryKey: ['journal-analysis', 'owner', entry.id, 1] })
      ?.setState({ error: new Error('Offline'), status: 'error' })
  );
  await screen.findByRole('button', { name: 'Retry' });
  expect(thinking()).toBeInTheDocument();
});

it('ignores an answer that arrives after leaving the waiting screen', async () => {
  const clarification = deferred<JournalClarification>();
  vi.mocked(answerClarification).mockReturnValue(clarification.promise);
  const { unmount } = setup();
  await answer();
  const signal = vi.mocked(answerClarification).mock.calls[0][3];
  unmount();
  await act(async () => clarification.resolve({ ...meaning, status: 'resolved', question: null }));
  expect(signal.aborted).toBe(true);
  expect(submitJournalEntry).not.toHaveBeenCalled();
  expect(screen.queryByRole('region', { name: 'Your tutor is thinking' })).not.toBeInTheDocument();
});
