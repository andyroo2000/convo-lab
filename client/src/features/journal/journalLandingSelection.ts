import type { JournalDraft, JournalEntry } from './types';

type Entry = Pick<JournalEntry, 'id' | 'entryDate' | 'body'>;

export function todayJournalEntry(entries: Entry[], today: string) {
  return entries
    .filter((entry) => entry.entryDate === today && entry.body.trim())
    .sort((a, b) => b.id.localeCompare(a.id))[0];
}

export function unfinishedDeviceDraft(drafts: JournalDraft[]) {
  return drafts
    .filter((draft) => !draft.rootEntryId && draft.body.trim())
    .sort((a, b) => b.entryDate.localeCompare(a.entryDate) || b.id.localeCompare(a.id))[0];
}
