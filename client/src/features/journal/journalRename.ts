import { ulid } from 'ulid';
import { getJournalEntry, saveJournalDraft } from './journalApi';
import { draftFromEntry, type JournalDraftStore } from './journalDrafts';
import type { JournalEntry } from './types';

type EntryVersion = Pick<JournalEntry, 'id' | 'version'>;

function reconcileLocalTitle(
  store: JournalDraftStore,
  entry: EntryVersion,
  previousTitle: string | null | undefined,
  saved: JournalEntry
) {
  const current = store.get(entry.id);
  if (!current) return;
  store.put({
    ...current,
    title: current.title === previousTitle ? saved.title : current.title,
    expectedVersion:
      current.expectedVersion === entry.version ? saved.version : current.expectedVersion,
    editId: ulid().toLowerCase(),
  });
}

async function saveRemoteTitle(entry: EntryVersion, title: string) {
  // Send the saved body, never publish unsaved writing as a side effect of renaming.
  const server = await getJournalEntry({ id: entry.id });
  if (server.version !== entry.version && server.title !== title) {
    throw new Error('This entry changed elsewhere. Refresh the journal and try again.');
  }
  const saved =
    server.title === title ? server : await saveJournalDraft({ ...draftFromEntry(server), title });
  return { saved, previousVersion: server.version };
}

function validatedTitle(input: string) {
  const title = input.trim();
  if (!title || [...title].length > 255) throw new Error('Enter a title of 1–255 characters.');
  return title;
}

export default async function renameJournalEntry(
  store: JournalDraftStore,
  entry: EntryVersion,
  input: string
) {
  const title = validatedTitle(input);
  const local = store.get(entry.id);
  if (entry.version === 0 && local?.expectedVersion === 0) {
    store.put({ ...local, title, editId: ulid().toLowerCase() });
    return;
  }
  const { saved, previousVersion } = await saveRemoteTitle(entry, title);
  try {
    reconcileLocalTitle(store, { id: entry.id, version: previousVersion }, local?.title, saved);
  } catch {
    throw new Error(
      'The title was saved online, but the device draft could not be updated. Try Save again.'
    );
  }
}
