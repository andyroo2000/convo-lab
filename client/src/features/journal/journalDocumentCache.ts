import type { QueryClient } from '@tanstack/react-query';
import type { JournalAnalysis, JournalEntry } from './types';
import type { JournalConversationNode } from './journalConversationApi';

function updatedAnalysis(current: JournalAnalysis | null, saved: JournalAnalysis) {
  if (current?.id !== saved.id) return current;
  return (current.replyRevision ?? 0) > (saved.replyRevision ?? 0) ? current : saved;
}

export default async function publishJournalDocument(
  client: QueryClient,
  ownerId: string,
  entryId: string,
  saved: JournalAnalysis
) {
  const analysisKey = ['journal-analysis', ownerId, entryId];
  const conversationKey = ['journal-conversation', ownerId];
  // Cancel older reads before publishing the acknowledged revision and its audio identity.
  await Promise.all([
    client.cancelQueries({ queryKey: analysisKey }),
    client.cancelQueries({ queryKey: conversationKey }),
  ]);
  client.setQueriesData<{ data: JournalAnalysis | null; entry: JournalEntry }>(
    { queryKey: analysisKey },
    (current) => current && { ...current, data: updatedAnalysis(current.data, saved) }
  );
  client.setQueriesData<{ data: JournalConversationNode[] }>(
    { queryKey: conversationKey },
    (current) =>
      current && {
        ...current,
        data: current.data.map((node) => ({
          ...node,
          analysis: updatedAnalysis(node.analysis, saved),
        })),
      }
  );
  client.invalidateQueries({ queryKey: analysisKey }).catch(() => undefined);
  client.invalidateQueries({ queryKey: conversationKey }).catch(() => undefined);
}
