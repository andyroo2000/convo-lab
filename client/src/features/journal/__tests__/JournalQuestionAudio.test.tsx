import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import JournalQuestionAudio from '../JournalQuestionAudio';
import { requestJson } from '../../../lib/apiClient';
import { fetchWithCsrf } from '../../../lib/csrf';
import type { TutorQuestion } from '../journalTutor';

vi.mock('../../../lib/apiClient', () => ({ requestJson: vi.fn() }));
vi.mock('../../../lib/csrf', () => ({ fetchWithCsrf: vi.fn() }));
vi.mock('../../../lib/authSession', () => ({ notifyAuthSessionExpired: vi.fn() }));
const question: TutorQuestion = {
  id: 'q',
  text: 'どうでしたか。',
  reading: 'どうでしたか。',
  translation: 'How was it?',
  tutor: { id: 'hana', name: 'Hana', gender: 'F', avatar: 'hana-v1' },
  audio: { status: 'ready', error: null },
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:question');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
  vi.mocked(requestJson).mockResolvedValue({ data: question });
  vi.mocked(fetchWithCsrf).mockResolvedValue(
    new Response(new Blob(['ID3question']), { status: 200 })
  );
});
afterEach(() => {
  vi.restoreAllMocks();
});
function mount(value = question, prepare = vi.fn().mockResolvedValue(undefined)) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return {
    ...render(
      <QueryClientProvider client={client}>
        <JournalQuestionAudio ownerId="a" entryId="e" question={value} prepare={prepare} />
      </QueryClientProvider>
    ),
    prepare,
  };
}
it('loads saved audio without autoplay or another generation and releases the recording on exit', async () => {
  const view = mount();
  const audio = await screen.findByLabelText("Hana's question");
  expect(audio).toHaveAttribute('src', 'blob:question');
  expect(audio).not.toHaveAttribute('autoplay');
  expect(view.prepare).not.toHaveBeenCalled();
  expect(fetchWithCsrf).toHaveBeenCalledWith(
    '/api/journal/entries/e/questions/q/audio',
    expect.objectContaining({ method: 'GET' })
  );
  view.unmount();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:question');
});
it('shows preparation progress without downloading audio before it is ready', async () => {
  const queued = { ...question, audio: { status: 'queued', error: null } };
  vi.mocked(requestJson).mockResolvedValue({ data: queued });
  mount(queued);
  expect(await screen.findByRole('status')).toHaveTextContent('Preparing question audio');
  expect(fetchWithCsrf).not.toHaveBeenCalled();
});
it('re-prepares missing recordings after a download failure', async () => {
  vi.mocked(fetchWithCsrf).mockResolvedValueOnce(new Response('', { status: 409 }));
  const view = mount();
  fireEvent.click(await screen.findByRole('button', { name: 'Retry audio' }));
  await screen.findByLabelText("Hana's question");
  await waitFor(() => expect(view.prepare).toHaveBeenCalledOnce());
  expect(fetchWithCsrf).toHaveBeenCalledTimes(2);
});

it('pauses the diary recording when the question starts playing', async () => {
  const other = document.createElement('audio');
  other.dataset.journalAudio = '';
  other.pause = vi.fn();
  document.body.append(other);
  const view = mount();
  fireEvent.play(await screen.findByLabelText("Hana's question"));
  expect(other.pause).toHaveBeenCalledOnce();
  view.unmount();
  other.remove();
});

it('offers retry for failed status without an error message', async () => {
  const failed = { ...question, audio: { status: 'failed', error: null } };
  vi.mocked(requestJson).mockResolvedValue({ data: failed });
  mount(failed);
  expect(await screen.findByRole('button', { name: 'Retry audio' })).toBeEnabled();
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});
it('ignores a stale server error after audio becomes ready', async () => {
  const ready = { ...question, audio: { status: 'ready', error: 'Previous attempt failed' } };
  vi.mocked(requestJson).mockResolvedValue({ data: ready });
  mount(ready);
  await screen.findByLabelText("Hana's question");
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
