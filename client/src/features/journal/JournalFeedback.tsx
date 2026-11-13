import { useState } from 'react';
import JournalVersionPicker from './JournalVersionPicker';
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
  const [version, setVersion] = useState<'draft' | 'final'>('draft');
  const controls = useJournalDocument(props);
  const feedback = analysis.result;
  if (!feedback) return null;
  const reply = analysis.currentReply;
  return (
    <div className="space-y-8">
      <JournalVersionPicker value={version} onChange={setVersion} />
      <div hidden={version !== 'draft'} className="space-y-6">
        <JournalAnnotatedText
          sourceId={analysis.id}
          feedback={feedback}
          analysis={analysis}
          controls={controls}
        />
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
      </div>
      <div hidden={version !== 'final'}>
        <JournalCorrected key={`corrected:${analysis.id}`} {...props} controls={controls} />
      </div>
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
