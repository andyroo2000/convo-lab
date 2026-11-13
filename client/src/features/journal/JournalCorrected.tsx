import { correctedContent } from './journalVersionText';
import { journalTextStyle } from './journalTypography';
import JournalAudioPlayer from './JournalAudioPlayer';
import JournalRuby from './JournalRuby';
import type { JournalAnalysis } from './types';
import type { JournalDocumentControls } from './useJournalDocument';

interface Props {
  ownerId: string;
  entryId: string;
  analysis: JournalAnalysis;
  controls: JournalDocumentControls;
}
const JournalCorrected = ({ ownerId, entryId, analysis, controls }: Props) => {
  const { reading } = correctedContent(analysis);
  return (
    <section aria-label="Corrected Version" className="space-y-4">
      <JournalAudioPlayer
        key={`${analysis.id}:${analysis.replyRevision}`}
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
        <JournalRuby text={reading} />
      </p>
      {controls.error && (
        <p role="alert" className="text-sm text-rose-700">
          {controls.error}
        </p>
      )}
    </section>
  );
};
export default JournalCorrected;
