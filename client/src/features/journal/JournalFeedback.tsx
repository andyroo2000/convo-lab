import JournalCopyButton from './JournalCopyButton';
import JournalAudioPlayer from './JournalAudioPlayer';
import JournalHighlight from './JournalHighlight';
import JournalFollowUp from './JournalFollowUp';
import JournalRuby from './JournalRuby';
import type { JournalAnalysis, JournalSegment } from './types';

interface FeedbackProps {
  ownerId: string;
  entryId: string;
  analysis: JournalAnalysis;
}

function keyedSegments(segments: JournalSegment[]) {
  let offset = 0;
  return segments.map((segment) => {
    const key = `span-${offset}`;
    offset += segment.text.length;
    return { ...segment, key };
  });
}

const JournalFeedback = ({ ownerId, entryId, analysis }: FeedbackProps) => {
  const feedback = analysis.result;
  const addition = analysis.currentReply?.result;
  if (!feedback) return null;
  const correctedText = addition?.entryText ?? feedback.correctedText;
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
        <div lang="ja" className="whitespace-pre-wrap text-xl leading-[2.7] text-navy">
          {keyedSegments(feedback.segments).map((segment) =>
            ['plain', 'keep'].includes(segment.kind) ? (
              <JournalRuby key={segment.key} text={segment.reading} />
            ) : (
              <JournalHighlight key={segment.key} segment={segment} />
            )
          )}
        </div>
      </div>
      <section aria-label="Corrected Version" className="space-y-4 border-t border-gray-200 pt-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-navy">Corrected Version</h2>
          <JournalCopyButton key={correctedText} text={correctedText} />
        </div>
        <JournalAudioPlayer
          key={`${analysis.id}:${analysis.updatedAt}:${analysis.replyRevision}`}
          ownerId={ownerId}
          entryId={entryId}
          analysisId={analysis.id}
          expectedReplyRevision={analysis.replyRevision ?? 0}
        />
        <p lang="ja" className="whitespace-pre-wrap text-xl leading-[2.7] text-navy">
          {addition ? (
            <>
              <JournalRuby text={addition.previousReading} />
              {'\n\n'}
              <mark className="rounded bg-indigo/10 text-inherit">
                <JournalRuby text={addition.correctedReading} />
              </mark>
            </>
          ) : (
            <JournalRuby text={feedback.correctedReading} />
          )}
        </p>
      </section>
      <JournalFollowUp key={analysis.id} ownerId={ownerId} entryId={entryId} analysis={analysis} />
    </div>
  );
};

export default JournalFeedback;
