import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { getJournalAnalysis } from './journalApi';
import type { JournalEntry } from './types';

interface AnalysisOptions {
  ownerId: string;
  entryId: string;
  enabled: boolean;
  submitted: number;
  onEntry: (entry: JournalEntry) => void;
}

export default function useJournalAnalysis(options: AnalysisOptions) {
  const { ownerId, entryId, enabled, submitted, onEntry } = options;
  const onEntryRef = useRef(onEntry);
  useEffect(() => {
    onEntryRef.current = onEntry;
  }, [onEntry]);
  const query = useQuery({
    queryKey: ['journal-analysis', ownerId, entryId, submitted],
    queryFn: ({ signal }) => getJournalAnalysis({ id: entryId, signal }),
    enabled,
    retry: false,
    refetchInterval: (state) => {
      const status = state.state.data?.data?.status;
      return status === 'queued' || status === 'processing' ? 2000 : false;
    },
  });
  useEffect(() => {
    if (query.data?.entry) onEntryRef.current(query.data.entry);
  }, [query.data]);
  return query;
}
