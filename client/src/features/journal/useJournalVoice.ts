import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getJournalAudioState, getJournalVoices, type JournalVoice } from './journalAudio';

export interface JournalAudioProps {
  ownerId: string;
  entryId: string;
  analysisId: string;
  expectedReplyRevision?: number;
}

function currentVoice(
  options: JournalVoice[],
  chosen: string,
  saved?: { data: { voiceId: string } }
) {
  const preferred = chosen || saved?.data.voiceId;
  return options.find((voice) => voice.id === preferred)?.id ?? '';
}

export default function useJournalVoice({
  ownerId,
  entryId,
  analysisId,
  expectedReplyRevision = 0,
}: JournalAudioProps) {
  const client = useQueryClient();
  const [chosen, choose] = useState('');
  const voices = useQuery({
    queryKey: ['journal-voices', ownerId],
    queryFn: getJournalVoices,
    select: (response) => response.data,
    refetchOnMount: 'always',
    retry: false,
  });
  const saved = useQuery({
    queryKey: ['journal-audio-state', ownerId, entryId, analysisId, expectedReplyRevision],
    queryFn: ({ signal }) =>
      getJournalAudioState({ entryId, analysisId, expectedReplyRevision, signal }),
    refetchOnMount: 'always',
    retry: false,
  });
  const options = voices.data ?? [];
  const voiceId = currentVoice(options, chosen, saved.data);
  const loading = voices.isFetching || saved.isFetching;
  const error = saved.isError || voices.isError;
  const ready = Boolean(voiceId) && saved.isSuccess && !loading && !error;

  function refreshAfterAudio() {
    client
      .invalidateQueries({ queryKey: ['journal-audio-state', ownerId], refetchType: 'none' })
      .catch(() => undefined);
  }

  function retry() {
    Promise.all([voices.refetch(), saved.refetch()]).catch(() => undefined);
  }

  return {
    voices: options,
    voiceId,
    ready,
    loading,
    error,
    choose,
    retry,
    refreshAfterAudio,
  };
}
