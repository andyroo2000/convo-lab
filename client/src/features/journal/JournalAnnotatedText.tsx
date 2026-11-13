import { journalTextStyle } from './journalTypography';
import JournalHighlight from './JournalHighlight';
import type { JournalAnalysis, JournalFeedback } from './types';
import type { JournalDocumentControls } from './useJournalDocument';

interface Props {
  sourceId: string;
  feedback: JournalFeedback;
  analysis: JournalAnalysis;
  controls: JournalDocumentControls;
}
const JournalAnnotatedText = ({ sourceId, feedback, analysis, controls }: Props) => (
  <div
    style={journalTextStyle}
    lang="ja"
    className="whitespace-pre-wrap text-xl leading-[2.7] text-navy"
  >
    {feedback.segments.map((segment, index) => {
      // The API identifies replacements by their unchanged source segment index.
      const id = `${sourceId}:${index}`;
      const suggestion = analysis.correctedDocument?.suggestions.find((item) => item.id === id);
      return (
        <JournalHighlight
          key={id}
          segment={segment}
          action={
            suggestion
              ? {
                  applied: suggestion.applied,
                  disabled: controls.busy,
                  error: controls.error,
                  toggle: () => controls.change({ suggestionId: id, applied: !suggestion.applied }),
                }
              : undefined
          }
        />
      );
    })}
  </div>
);
export default JournalAnnotatedText;
