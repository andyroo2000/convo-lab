import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, expect, it, vi } from 'vitest';
import JournalEditorForm from '../JournalEditorForm';
import useJournalEditor from '../useJournalEditor';
import { JournalDraftStore, newJournalDraft } from '../journalDrafts';
import { deleteJournalEntry, saveJournalDraft, submitJournalEntry } from '../journalApi';
import { startClarification } from '../journalClarification';
import { JsonRequestError } from '../../../lib/apiClient';
import type { JournalEntry } from '../types';

vi.mock('../journalApi', () => ({
  getJournalEntry: vi.fn(),
  saveJournalDraft: vi.fn(),
  deleteJournalEntry: vi.fn(),
  submitJournalEntry: vi.fn(),
}));
vi.mock('../journalClarification', async (original) => ({
  ...(await original<typeof import('../journalClarification')>()),
  startClarification: vi.fn(),
}));
vi.mock('../journalTutor', () => ({
  getTutorPreferences: async () => ({
    data: {
      selectedId: 'ren',
      tutors: [
        { id: 'hana', avatarUrl: '/hana.png' },
        { id: 'ren', avatarUrl: '/ren.png' },
      ],
    },
  }),
  tutorAvatar: (tutor: { avatarUrl: string }) => tutor.avatarUrl,
}));

beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function closeDialog() {
    this.removeAttribute('open');
  };
  vi.mocked(startClarification).mockImplementation(async (entry) => ({
    id: 'meaning',
    sourceVersion: entry.version,
    revision: 0,
    status: 'resolved',
    question: null,
    error: null,
    updatedAt: '',
  }));
});

const Harness = ({ entryId, close }: { entryId: string; close: () => void }) => {
  const editor = useJournalEditor({ ownerId: 'owner', entryId, onSaved: () => undefined });
  return <JournalEditorForm ownerId="owner" editor={editor} processing={false} onClose={close} />;
};

function setup(expectedVersion = 0) {
  const draft = { ...newJournalDraft(), body: '今日は映画を見ました。', expectedVersion };
  const store = new JournalDraftStore('owner');
  store.put(draft);
  const close = vi.fn();
  const entry: JournalEntry = {
    ...draft,
    version: expectedVersion + 1,
    createdAt: '',
    updatedAt: '',
  };
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <Harness entryId={draft.id} close={close} />
    </QueryClientProvider>
  );
  return { ...view, draft, store, close, entry };
}

function openDialog() {
  screen.getByRole('button', { name: 'Close' }).focus();
  fireEvent.click(screen.getByRole('button', { name: 'Close' }));
  return screen.getByRole('dialog', { name: 'Keep this draft?' });
}

it('autosaves edits and dismisses the modal without saving online or losing writing', async () => {
  const { store, draft, close } = setup();
  expect(screen.queryByRole('button', { name: 'Save draft' })).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole('textbox', { name: 'Journal entry in Japanese' }), {
    target: { value: '新しい文章。' },
  });
  expect(store.get(draft.id)?.body).toBe('新しい文章。');
  const dialog = openDialog();
  await waitFor(() => expect(within(dialog).getByAltText('')).toHaveAttribute('src', '/ren.png'));
  expect(screen.queryByText('Deleting a draft cannot be undone.')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Continue writing' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();
  expect(saveJournalDraft).not.toHaveBeenCalled();
  expect(close).not.toHaveBeenCalled();
});

it('keeps the modal open while saving, blocks dismissal, and closes only after saving online', async () => {
  const { close, entry, store, draft } = setup();
  let finish!: (entry: JournalEntry) => void;
  vi.mocked(saveJournalDraft).mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      })
  );
  const dialog = openDialog();
  fireEvent.click(screen.getByRole('button', { name: 'Keep draft & close' }));
  fireEvent.click(within(dialog).getByRole('button', { name: 'Saving…' }));
  fireEvent(dialog, new Event('cancel', { cancelable: true }));
  expect(dialog).toBeInTheDocument();
  expect(close).not.toHaveBeenCalled();
  expect(saveJournalDraft).toHaveBeenCalledTimes(1);
  await act(async () => finish(entry));
  expect(close).toHaveBeenCalledOnce();
  expect(store.get(draft.id)).toBeNull();
  expect(submitJournalEntry).not.toHaveBeenCalled();
});

it('closes after an offline save while keeping the durable draft queued', async () => {
  const { close, store, draft } = setup();
  vi.mocked(saveJournalDraft).mockRejectedValue(new Error('Offline'));
  openDialog();
  fireEvent.click(screen.getByRole('button', { name: 'Keep draft & close' }));
  await waitFor(() => expect(close).toHaveBeenCalledOnce());
  expect(store.get(draft.id)?.body).toBe(draft.body);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it('deletes a device-only draft without requiring an online request', async () => {
  const { close, store, draft } = setup();
  openDialog();
  fireEvent.click(screen.getByRole('button', { name: 'Delete draft' }));
  await waitFor(() => expect(close).toHaveBeenCalledOnce());
  expect(store.get(draft.id)).toBeNull();
  expect(deleteJournalEntry).not.toHaveBeenCalled();
});

it('preserves a saved draft when deletion conflicts, then retries with the same version', async () => {
  const { close, store, draft } = setup(3);
  vi.mocked(deleteJournalEntry)
    .mockRejectedValueOnce(new JsonRequestError('Changed elsewhere', 409, {}))
    .mockResolvedValueOnce(undefined);
  openDialog();
  fireEvent.click(screen.getByRole('button', { name: 'Delete draft' }));
  await screen.findByRole('alert');
  expect(close).not.toHaveBeenCalled();
  expect(store.get(draft.id)).not.toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Delete draft' }));
  await waitFor(() => expect(close).toHaveBeenCalledOnce());
  expect(deleteJournalEntry).toHaveBeenLastCalledWith({ id: draft.id, version: 3 });
  expect(store.get(draft.id)).toBeNull();
});

it('can finish device cleanup when the online draft is already deleted', async () => {
  const { close, store, draft } = setup(2);
  vi.mocked(deleteJournalEntry).mockRejectedValue(new JsonRequestError('Not found', 404, {}));
  openDialog();
  fireEvent.click(screen.getByRole('button', { name: 'Delete draft' }));
  await waitFor(() => expect(close).toHaveBeenCalledOnce());
  expect(store.get(draft.id)).toBeNull();
});

it('does not navigate away from a different entry when a deletion finishes late', async () => {
  const { close, unmount } = setup(1);
  let finish!: () => void;
  vi.mocked(deleteJournalEntry).mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      })
  );
  openDialog();
  fireEvent.click(screen.getByRole('button', { name: 'Delete draft' }));
  unmount();
  await act(async () => finish());
  expect(close).not.toHaveBeenCalled();
});

it('keeps Submit saving and requesting feedback without opening the close modal', async () => {
  const { entry, close } = setup();
  vi.mocked(saveJournalDraft).mockResolvedValue(entry);
  fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
  await waitFor(() => expect(submitJournalEntry).toHaveBeenCalledWith(entry, 'meaning'));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(close).not.toHaveBeenCalled();
});
