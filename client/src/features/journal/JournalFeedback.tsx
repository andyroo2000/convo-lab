import JournalAnnotatedText from './JournalAnnotatedText';
import JournalHighlightLegend from './JournalHighlightLegend';
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
      {[...feedback.segments, ...(reply?.result?.segments ?? [])].some(
        (segment) => segment.kind === 'correction' || segment.kind === 'optional'
      ) && <JournalHighlightLegend />}
      <JournalCorrected key={`corrected:${analysis.id}`} {...props} controls={controls} />
      <JournalFollowUp
        key={`follow-up:${analysis.id}`}
        ownerId={ownerId}
        entryId={entryId}
        analysis={analysis}
      />
    </div>
  );
};
export default JournalFeedback;
