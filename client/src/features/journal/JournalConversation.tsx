import { useCallback, type ReactNode } from 'react';
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
  onClose?: () => void;
}
const ConversationReply = ({
  node,
  ownerId,
  entryId,
  analysis,
  last,
  refresh,
  onOpen,
  onClose,
}: Props & { node: JournalConversationNode; last: boolean; refresh: () => Promise<void> }) => {
  const teacher = node.question && node.parentEntryId && (
    <JournalTeacher
      ownerId={ownerId}
      entryId={node.parentEntryId}
      analysis={analysis}
      savedQuestion={node.question}
    />
  );
  return (
    <JournalEditor
      ownerId={ownerId}
      entryId={node.entry.id}
      nested
      onSaved={() => {
        refresh().catch(() => undefined);
      }}
      onOpen={onOpen}
      onClose={onClose}
      initial={node}
      pendingHeader={teacher}
      renderFeedback={(childAnalysis) => (
        <>
          <section
            className="rounded-2xl border border-[#dce5ef] bg-[#fafcff] p-3 sm:p-5"
            aria-label="Conversation reply"
          >
            {teacher}
            <div className="mt-7 border-t border-[#e0e7ee] pt-6">
              <JournalFeedback
                key={childAnalysis.id}
                ownerId={ownerId}
                entryId={node.entry.id}
                analysis={childAnalysis}
                followUp={false}
              />
            </div>
          </section>
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
  );
};

const JournalConversation = ({
  ownerId,
  entryId,
  analysis,
  onOpen,
  onClose,
  heading,
}: Props & { heading?: ReactNode }) => {
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
      <JournalFeedback
        ownerId={ownerId}
        entryId={entryId}
        analysis={analysis}
        heading={heading}
        followUp={false}
      />
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
          onClose={onClose}
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
