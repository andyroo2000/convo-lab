import { requestJson } from '../../lib/apiClient';
import type { JournalPage } from './types';

export default async function findUnfinishedJournal(signal: AbortSignal): Promise<string | null> {
  const page = await requestJson<JournalPage>('/api/journal/entries?unfinished=1&limit=1', {
    signal,
  });
  return page.data[0]?.id ?? null;
}
