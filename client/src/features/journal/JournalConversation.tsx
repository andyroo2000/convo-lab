import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import JournalEditor from './JournalEditor';
import JournalFeedback from './JournalFeedback';
import JournalTeacher from './JournalTeacher';
import JournalConversationComposer from './JournalConversationComposer';
import { getJournalConversation, type JournalConversationNode } from './journalConversationApi';
import type { JournalAnalysis } from './types';

interface Props {
  ownerId: string;
  entryId: string;
  analysis: JournalAnalysis;
  onOpen: (id: string) => void;
}
const ConversationReply = ({
  node,
  ownerId,
  entryId,
  analysis,
  last,
  refresh,
  onOpen,
}: Props & { node: JournalConversationNode; last: boolean; refresh: () => Promise<void> }) => (
  <section
    key={node.entry.id}
    className="space-y-6 border-t border-gray-200 pt-6"
    aria-label="Conversation reply"
  >
    {node.question && node.parentEntryId && (
      <JournalTeacher
        ownerId={ownerId}
        entryId={node.parentEntryId}
        analysis={analysis}
        savedQuestion={node.question}
      />
    )}
    <JournalEditor
      ownerId={ownerId}
      entryId={node.entry.id}
      nested
      onSaved={() => {
        refresh().catch(() => undefined);
      }}
      onOpen={onOpen}
      initial={node}
      renderFeedback={(childAnalysis) => (
        <>
          <JournalFeedback
            key={childAnalysis.id}
            ownerId={ownerId}
            entryId={node.entry.id}
            analysis={childAnalysis}
            followUp={false}
          />
          {last && (
            <JournalConversationComposer
              ownerId={ownerId}
              rootId={entryId}
              entryId={node.entry.id}
              analysis={childAnalysis}
              onSaved={refresh}
            />
          )}
        </>
      )}
    />
  </section>
);

const JournalConversation = ({ ownerId, entryId, analysis, onOpen }: Props) => {
  const thread = useQuery({
    queryKey: ['journal-conversation', ownerId, entryId],
    queryFn: ({ signal }) => getJournalConversation(entryId, signal),
    retry: false,
  });
  const nodes = thread.data?.data ?? [];
  const { refetch } = thread;
  const refresh = useCallback(async () => {
    await refetch({ throwOnError: true });
  }, [refetch]);
  return (
    <div className="space-y-8">
      <JournalFeedback ownerId={ownerId} entryId={entryId} analysis={analysis} followUp={false} />
      {thread.isPending && (
        <p role="status" className="text-sm text-gray-500">
          Loading conversation…
        </p>
      )}
      {thread.error && (
        <p role="alert">
          Conversation could not be loaded.{' '}
          <button
            type="button"
            className="text-indigo underline"
            onClick={() => {
              refresh().catch(() => undefined);
            }}
          >
            Retry
          </button>
        </p>
      )}
      {nodes.map((node, index) => (
        <ConversationReply
          key={node.entry.id}
          node={node}
          ownerId={ownerId}
          entryId={entryId}
          analysis={analysis}
          last={index === nodes.length - 1}
          refresh={refresh}
          onOpen={onOpen}
        />
      ))}
      {thread.isSuccess && nodes.length === 0 && (
        <JournalConversationComposer
          key={analysis.id}
          ownerId={ownerId}
          rootId={entryId}
          entryId={entryId}
          analysis={analysis}
          onSaved={refresh}
        />
      )}
    </div>
  );
};

export default JournalConversation;
