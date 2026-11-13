import JournalTeacher from './JournalTeacher';
import JournalAnswerForm from './JournalAnswerForm';
import useJournalReplies from './useJournalReplies';
import type { JournalAnalysis } from './types';

interface FollowUpProps {
  ownerId: string;
  entryId: string;
  analysis: JournalAnalysis;
}
const JournalFollowUp = ({ ownerId, entryId, analysis }: FollowUpProps) => {
  const reply = useJournalReplies({ ownerId, entryId, analysis });
  const feedback = analysis.currentReply?.result ?? analysis.result;
  if (!feedback) return null;
  const disabled = reply.busy || reply.processing || reply.waiting;
  return (
    <section className="space-y-4 border-t border-gray-200 pt-6" aria-label="Continue your entry">
      {analysis.currentReply && (
        <div className="flex gap-4 text-sm text-indigo">
          <button type="button" disabled={disabled} onClick={reply.editLast}>
            Edit last answer
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              reply.undo().catch(() => undefined);
            }}
          >
            Undo last addition
          </button>
        </div>
      )}
      {!reply.draft.replace && (
        <JournalTeacher
          key={analysis.currentReply?.id ?? analysis.id}
          ownerId={ownerId}
          entryId={entryId}
          analysis={analysis}
        />
      )}
      <JournalAnswerForm reply={reply} />
    </section>
  );
};
export default JournalFollowUp;
