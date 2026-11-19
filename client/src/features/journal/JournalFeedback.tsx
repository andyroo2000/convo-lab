import { useState, type ReactNode } from 'react';
import JournalOverflow from './JournalOverflow';
import JournalVersionPicker from './JournalVersionPicker';
import JournalAnnotatedText from './JournalAnnotatedText';
import JournalCorrected from './JournalCorrected';
import { versionText } from './journalVersionText';
import JournalCopyButton from './JournalCopyButton';
import JournalFollowUp from './JournalFollowUp';
import useJournalDocument from './useJournalDocument';
import useJournalVersion from './useJournalVersion';
import type { JournalAnalysis } from './types';

interface FeedbackProps {
  ownerId: string;
  entryId: string;
  analysis: JournalAnalysis;
  followUp?: boolean;
  heading?: ReactNode;
}
const JournalFeedback = (props: FeedbackProps) => {
  const { ownerId, entryId, analysis, followUp = true, heading } = props;
  const [version, setVersion] = useJournalVersion(
    ownerId,
    entryId,
    Boolean(analysis.result && versionText(analysis, 'final').trim())
  );
  const [toolbarTarget, setToolbarTarget] = useState<HTMLSpanElement | null>(null);
  const controls = useJournalDocument(props);
  const feedback = analysis.result;
  if (!feedback) return null;
  const reply = analysis.currentReply;
  const copyText = versionText(analysis, version);
  const toolbar = (
    <div className="journal-feedback-toolbar" role="group" aria-label="Entry controls">
      <JournalVersionPicker value={version} onChange={setVersion} />
      <JournalOverflow>
        <JournalCopyButton
          key={`${version}:${copyText}`}
          menu
          text={copyText}
          label={`Copy ${version} text`}
        />
        <span ref={setToolbarTarget} className={version === 'final' ? 'contents' : 'hidden'} />
      </JournalOverflow>
    </div>
  );
  return (
    <div className="journal-entry-feedback">
      {toolbar}
      <div hidden={version !== 'draft'} className="space-y-6">
        <JournalAnnotatedText sourceId={analysis.id} feedback={feedback} heading={heading} />
        {reply?.result && (
          <section aria-label="Your last answer" className="space-y-2">
            <h2 className="text-sm font-medium text-gray-600">Your last answer</h2>
            <JournalAnnotatedText sourceId={reply.id} feedback={reply.result} />
          </section>
        )}
      </div>
      <div hidden={version !== 'final'}>
        <JournalCorrected
          key={`corrected:${analysis.id}`}
          {...props}
          controls={controls}
          toolbarTarget={toolbarTarget}
          active={version === 'final'}
        />
      </div>
      {followUp && (
        <JournalFollowUp
          key={`follow-up:${analysis.id}`}
          ownerId={ownerId}
          entryId={entryId}
          analysis={analysis}
        />
      )}
    </div>
  );
};
export default JournalFeedback;
