import { journalTextStyle } from './journalTypography';
import JournalSentenceText from './JournalSentenceText';
import type { JournalFeedback } from './types';

const JournalQuestion = ({ feedback }: { feedback: JournalFeedback }) => (
  <p style={journalTextStyle} lang="ja" className="text-xl leading-[2.05] text-navy">
    <JournalSentenceText text={feedback.questionReading} />
  </p>
);
export default JournalQuestion;
