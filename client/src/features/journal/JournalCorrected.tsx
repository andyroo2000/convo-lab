import type { ReactNode } from 'react';
import { correctedContent } from './journalVersionText';
import JournalPaper from './JournalPaper';
import JournalAudioPlayer from './JournalAudioPlayer';
import JournalSentenceText from './JournalSentenceText';
import JournalPlaybackProvider from './JournalPlaybackContext';
import type { JournalAnalysis } from './types';
import type { JournalDocumentControls } from './useJournalDocument';

interface Props {
  ownerId: string;
  entryId: string;
  analysis: JournalAnalysis;
  controls: JournalDocumentControls;
  toolbarTarget?: HTMLElement | null;
  heading?: ReactNode;
}
const JournalCorrected = ({
  ownerId,
  entryId,
  analysis,
  controls,
  toolbarTarget,
  heading,
}: Props) => {
  const { reading } = correctedContent(analysis);
  return (
    <JournalPlaybackProvider key={`${ownerId}:${entryId}:${analysis.id}:${analysis.replyRevision}`}>
      <section aria-label="Corrected Version" className="space-y-4">
        <JournalAudioPlayer
          key={`${analysis.id}:${analysis.replyRevision}`}
          toolbarTarget={toolbarTarget}
          ownerId={ownerId}
          entryId={entryId}
          analysisId={analysis.id}
          expectedReplyRevision={analysis.replyRevision ?? 0}
        />
        <JournalPaper heading={heading}>
          <JournalSentenceText text={reading} />
        </JournalPaper>
        {controls.error && (
          <p role="alert" className="text-sm text-rose-700">
            {controls.error}
          </p>
        )}
      </section>
    </JournalPlaybackProvider>
  );
};
export default JournalCorrected;
