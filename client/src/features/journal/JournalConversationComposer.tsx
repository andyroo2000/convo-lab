import { useQuery } from '@tanstack/react-query';
import JournalTeacher from './JournalTeacher';
import { prepareTutorQuestion } from './journalTutor';
import { journalTextStyle } from './journalTypography';
import useConversationAnswer from './useConversationAnswer';
import type { JournalAnalysis } from './types';

interface Props {
  ownerId: string;
  rootId: string;
  entryId: string;
  analysis: JournalAnalysis;
  onSaved: () => Promise<unknown>;
}
const Answer = ({
  ownerId,
  rootId,
  entryId,
  analysis,
  onSaved,
  questionId,
}: Props & { questionId: string }) => {
  const key = `convolab:journal-answer:${ownerId}:${rootId}:${analysis.id}:conversation`;
  const reply = useConversationAnswer(key, entryId, questionId, onSaved);
  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        reply.submit().catch(() => undefined);
      }}
    >
      <textarea
        aria-label="Your answer"
        lang="ja"
        style={journalTextStyle}
        rows={4}
        maxLength={20000}
        value={reply.draft.body}
        readOnly={reply.busy || Boolean(reply.draft.request)}
        onChange={(event) => reply.change(event.target.value)}
        className="w-full rounded-xl border border-gray-200 p-4 text-navy focus:border-indigo focus:outline-none"
      />
      {reply.error && (
        <div>
          <p role="alert" className="text-sm text-rose-700">
            {reply.error}
          </p>
          <button
            type="button"
            className="text-sm text-indigo underline"
            onClick={() => {
              onSaved().catch(() => undefined);
            }}
          >
            Reload conversation
          </button>
        </div>
      )}
      <button
        type="submit"
        disabled={reply.busy || !reply.draft.body.trim()}
        className="rounded-xl bg-indigo px-5 py-3 text-white disabled:opacity-40"
      >
        {reply.busy ? 'Submitting…' : 'Submit'}
      </button>
    </form>
  );
};
const JournalConversationComposer = (props: Props) => {
  const { ownerId, entryId, analysis } = props;
  const replyId = analysis.currentReply?.id;
  const question = useQuery({
    queryKey: ['journal-question', ownerId, entryId, analysis.id, replyId],
    queryFn: () => prepareTutorQuestion(entryId, analysis.id, replyId),
    enabled: !analysis.pendingReplyId,
    retry: false,
    staleTime: Infinity,
  });
  return (
    <section
      className="space-y-4 border-t border-gray-200 pt-6"
      aria-label="Continue the conversation"
    >
      <JournalTeacher ownerId={ownerId} entryId={entryId} analysis={analysis} />
      {question.data?.data.tutor && !analysis.pendingReplyId && (
        <Answer key={question.data.data.id} {...props} questionId={question.data.data.id} />
      )}
    </section>
  );
};

export default JournalConversationComposer;
