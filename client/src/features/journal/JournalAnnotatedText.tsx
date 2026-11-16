import type { ReactNode } from 'react';
import JournalPaper from './JournalPaper';
import JournalHighlight from './JournalHighlight';
import type { JournalFeedback } from './types';

interface Props {
  sourceId: string;
  feedback: JournalFeedback;
  heading?: ReactNode;
}
const JournalAnnotatedText = ({ sourceId, feedback, heading }: Props) => (
  <JournalPaper heading={heading}>
    {feedback.segments.map((segment, index) => {
      // Notes are identified by their stable position in this saved analysis.
      const id = `${sourceId}:${index}`;
      return <JournalHighlight key={id} segment={segment} />;
    })}
  </JournalPaper>
);
export default JournalAnnotatedText;
