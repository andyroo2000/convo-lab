import JournalAnnotatedText from './JournalAnnotatedText';
import JournalCorrected from './JournalCorrected';
import JournalFollowUp from './JournalFollowUp';
import useJournalDocument from './useJournalDocument';
import type { JournalAnalysis } from './types';

interface FeedbackProps {
  ownerId: string;
  entryId: string;
  analysis: JournalAnalysis;
}
const JournalFeedback = (props: FeedbackProps) => {
  const { ownerId, entryId, analysis } = props;
  const controls = useJournalDocument(props);
  const feedback = analysis.result;
  if (!feedback) return null;
  const reply = analysis.currentReply;
  return (
    <div className="space-y-8">
      <div>
        <div
          className="mb-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-gray-600"
          aria-label="Highlight meanings"
        >
          <span className="underline decoration-rose-400 decoration-2 underline-offset-4">
            Correction
          </span>
          <span className="underline decoration-dashed decoration-amber-500 decoration-2 underline-offset-4">
            Optional change
          </span>
        </div>
        <JournalAnnotatedText
          sourceId={analysis.id}
          feedback={feedback}
          analysis={analysis}
          controls={controls}
        />
      </div>
      {reply?.result && (
        <section aria-label="Your last answer" className="space-y-2">
          <h2 className="text-sm font-medium text-gray-600">Your last answer</h2>
          <JournalAnnotatedText
            sourceId={reply.id}
            feedback={reply.result}
            analysis={analysis}
            controls={controls}
          />
        </section>
      )}
      <JournalCorrected key={analysis.id} {...props} controls={controls} />
      <JournalFollowUp key={analysis.id} ownerId={ownerId} entryId={entryId} analysis={analysis} />
    </div>
  );
};
export default JournalFeedback;
