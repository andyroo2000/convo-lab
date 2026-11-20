import { useQuery } from '@tanstack/react-query';
import JournalTeacher from './JournalTeacher';
import JournalClarificationDialog from './JournalClarificationDialog';
import { prepareTutorQuestion } from './journalTutor';
import JournalPaper from './JournalPaper';
import JournalWritingField from './JournalWritingField';
import useConversationAnswer from './useConversationAnswer';
import type { JournalAnalysis } from './types';
import './journalDraftActions.css';

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
  if (reply.clarification.active)
    return <JournalClarificationDialog ownerId={ownerId} workflow={reply.clarification} />;
  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        reply.submit().catch(() => undefined);
      }}
    >
      <JournalPaper>
        <JournalWritingField
          aria-label="Your answer"
          lang="ja"
          className="journal-writing-field--paper"
          placeholder="返事を書く…"
          rows={4}
          maxLength={20000}
          value={reply.draft.body}
          readOnly={reply.busy || Boolean(reply.draft.request)}
          onChange={(event) => reply.change(event.target.value)}
        />
      </JournalPaper>
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
        className="journal-draft-button journal-draft-button--sage"
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
      className="space-y-6 rounded-2xl border border-[#dce5ef] bg-[#fafcff] p-3 sm:p-5"
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
