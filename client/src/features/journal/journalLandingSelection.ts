import type { JournalEntry, JournalPage } from './types';

type Entry = Pick<JournalEntry, 'id' | 'entryDate' | 'body' | 'version'>;

export default function todayJournalEntry(
  entries: Entry[],
  today: string,
  onlinePages?: JournalPage[]
) {
  const onlineIds =
    onlinePages && new Set(onlinePages.flatMap((page) => page.data.map((entry) => entry.id)));
  return entries
    .filter((entry) => entry.entryDate === today && entry.body.trim())
    .filter((entry) => !onlineIds || entry.version === 0 || onlineIds.has(entry.id))
    .sort((a, b) => b.id.localeCompare(a.id))[0];
}
