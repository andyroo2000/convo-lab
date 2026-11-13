import JournalRuby from './JournalRuby';
import type { JournalSegment } from './types';

// Keep analysis anchored to the user's words, independent of Apply/Reject state.
// An insertion has no source text, so give it a visible, tappable anchor.
const JournalEditText = ({ segment }: { segment: JournalSegment }) => {
  if (segment.text === '' && segment.replacement) return <span aria-hidden="true">＋</span>;
  return <JournalRuby text={segment.reading} />;
};

export default JournalEditText;
