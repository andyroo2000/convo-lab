import type { ReactNode } from 'react';
import JournalPaper from './JournalPaper';
import JournalHighlight from './JournalHighlight';
import type { JournalAnalysis, JournalFeedback } from './types';
import type { JournalDocumentControls } from './useJournalDocument';

interface Props {
  sourceId: string;
  feedback: JournalFeedback;
  analysis: JournalAnalysis;
  controls: JournalDocumentControls;
  heading?: ReactNode;
}
const JournalAnnotatedText = ({ sourceId, feedback, analysis, controls, heading }: Props) => (
  <JournalPaper heading={heading}>
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
  </JournalPaper>
);
export default JournalAnnotatedText;
