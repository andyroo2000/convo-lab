import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { getJournalAnalysis } from './journalApi';
import type { JournalAnalysis, JournalEntry } from './types';

interface AnalysisOptions {
  ownerId: string;
  entryId: string;
  enabled: boolean;
  submitted: number;
  initial?: { data: JournalAnalysis | null; entry: JournalEntry };
  submission?: { data: JournalAnalysis; entry: JournalEntry };
  onEntry: (entry: JournalEntry) => void;
}

function shouldPoll(analysis: JournalAnalysis | null | undefined) {
  return (
    analysis?.pendingReplyId || analysis?.status === 'queued' || analysis?.status === 'processing'
  );
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
    initialData: options.submission ?? options.initial,
    staleTime: options.initial ? 30000 : 0,
    retry: false,
    refetchInterval: (state) => (shouldPoll(state.state.data?.data) ? 2000 : false),
  });
  useEffect(() => {
    if (query.data?.entry) onEntryRef.current(query.data.entry);
  }, [query.data]);
  return query;
}
