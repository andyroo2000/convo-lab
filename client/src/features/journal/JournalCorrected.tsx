import { correctedContent } from './journalVersionText';
import { journalTextStyle } from './journalTypography';
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
}
const JournalCorrected = ({ ownerId, entryId, analysis, controls, toolbarTarget }: Props) => {
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
        <p
          style={journalTextStyle}
          lang="ja"
          className="whitespace-pre-wrap text-xl leading-[2.7] text-navy"
        >
          <JournalSentenceText text={reading} />
        </p>
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
