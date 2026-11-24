import type { ReactNode } from 'react';
import JournalPaper from './JournalPaper';
import JournalHighlight from './JournalHighlight';
import type { JournalFeedback, JournalSegment } from './types';

const highlighted = (segment?: JournalSegment) =>
  segment?.kind === 'correction' || segment?.kind === 'optional';

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
      const separate = highlighted(segment) && highlighted(feedback.segments[index - 1]);
      return <JournalHighlight key={id} segment={segment} separate={separate} />;
    })}
  </JournalPaper>
);
export default JournalAnnotatedText;
