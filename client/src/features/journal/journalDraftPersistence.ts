import type { JournalDraft } from './types';

export default function isUnwrittenJournalDraft(draft: JournalDraft | null, saved: boolean) {
  return Boolean(draft && !saved && draft.expectedVersion === 0 && !draft.body.trim());
}
