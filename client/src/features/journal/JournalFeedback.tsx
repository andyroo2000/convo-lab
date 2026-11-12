import { useState } from 'react';
import JournalAudioPlayer from './JournalAudioPlayer';
import JournalHighlight from './JournalHighlight';
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
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const feedback = analysis.result;
  if (!feedback) return null;
  async function copy() {
    try {
      await navigator.clipboard.writeText(feedback!.correctedText);
      setCopied(true);
      setCopyError(false);
    } catch {
      setCopyError(true);
    }
  }
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
          <span className="underline decoration-dotted decoration-emerald-500 decoration-2 underline-offset-4">
            Worth keeping
          </span>
        </div>
        <div lang="ja" className="whitespace-pre-wrap text-xl leading-loose text-navy">
          {keyedSegments(feedback.segments).map((segment) =>
            segment.kind === 'plain' ? (
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
          <button
            type="button"
            className="text-sm text-indigo"
            onClick={() => {
              copy().catch(() => undefined);
            }}
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <JournalAudioPlayer
          key={`${analysis.id}:${analysis.updatedAt}`}
          ownerId={ownerId}
          entryId={entryId}
          analysisId={analysis.id}
        />
        <p lang="ja" className="whitespace-pre-wrap text-xl leading-loose text-navy">
          <JournalRuby text={feedback.correctedReading} />
        </p>
        {copyError && (
          <p role="alert" className="text-sm text-rose-700">
            Could not copy. Select the corrected text to copy it.
          </p>
        )}
      </section>
    </div>
  );
};

export default JournalFeedback;
