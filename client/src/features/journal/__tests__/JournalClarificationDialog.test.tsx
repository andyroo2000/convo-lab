import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { expect, it, vi } from 'vitest';
import JournalClarificationDialog from '../JournalClarificationDialog';
import useJournalClarification from '../useJournalClarification';
import {
  startClarification,
  answerClarification,
  type JournalClarification,
} from '../journalClarification';

vi.mock('../journalTutor', () => ({
  getTutorPreferences: async () => ({ data: { selectedId: null, tutors: [] } }),
  tutorAvatar: () => undefined,
}));
vi.mock('../journalClarification', async (original) => ({
  ...(await original<typeof import('../journalClarification')>()),
  startClarification: vi.fn(),
  answerClarification: vi.fn(),
}));
const waiting: JournalClarification = {
  id: 'meaning',
  sourceVersion: 2,
  revision: 0,
  status: 'waiting',
  question: {
    id: 'drive',
    prompt: 'Who was driving?',
    choices: ['I was driving', 'Molly was driving'],
  },
  error: null,
  updatedAt: '',
};
const Harness = ({ complete }: { complete: (id: string | undefined) => void }) => {
  const workflow = useJournalClarification('owner:entry');
  return workflow.active ? (
    <JournalClarificationDialog ownerId="owner" workflow={workflow} />
  ) : (
    <button
      type="button"
      onClick={() => {
        workflow.begin({ id: 'entry', version: 2 }).then(complete);
      }}
    >
      Submit draft
    </button>
  );
};
function show(complete = vi.fn()) {
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <Harness complete={complete} />
    </QueryClientProvider>
  );
  fireEvent.click(screen.getByRole('button', { name: 'Submit draft' }));
  return complete;
}
it('replaces questions, resets selection, and disappears only after resolution', async () => {
  vi.mocked(startClarification).mockResolvedValue(waiting);
  vi.mocked(answerClarification)
    .mockResolvedValueOnce({
      ...waiting,
      revision: 1,
      question: {
        id: 'search',
        prompt: 'Who looked up the movie?',
        choices: ['I did', 'Molly did'],
      },
    })
    .mockResolvedValueOnce({ ...waiting, status: 'resolved', question: null });
  const complete = show();
  await screen.findByText('Who was driving?');
  expect(screen.getByText('Who was driving?')).toHaveFocus();
  expect(screen.getByRole('button', { name: 'Answer' })).toBeDisabled();
  fireEvent.click(screen.getByRole('radio', { name: 'I was driving' }));
  fireEvent.click(screen.getByRole('button', { name: 'Answer' }));
  await screen.findByText('Who looked up the movie?');
  expect(screen.queryByText('Who was driving?')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Answer' })).toBeDisabled();
  expect(complete).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('radio', { name: 'Something else' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Your answer' }), {
    target: { value: 'Molly searched while I drove' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Answer' }));
  await waitFor(() => expect(complete).toHaveBeenCalledWith('meaning'));
  expect(answerClarification).toHaveBeenLastCalledWith(
    expect.anything(),
    expect.anything(),
    'Molly searched while I drove',
    expect.any(AbortSignal)
  );
  expect(screen.queryByRole('region', { name: 'Clarify your meaning' })).not.toBeInTheDocument();
});
it('allows returning to the draft without authorizing feedback', async () => {
  vi.mocked(startClarification).mockResolvedValue(waiting);
  const complete = show();
  await screen.findByText('Who was driving?');
  fireEvent.click(screen.getByRole('button', { name: 'Back to draft' }));
  await waitFor(() => expect(complete).toHaveBeenCalledWith(undefined));
  expect(screen.getByRole('button', { name: 'Submit draft' })).toBeInTheDocument();
});
