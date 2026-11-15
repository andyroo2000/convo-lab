import './journalTutorText.css';
import JournalSentenceText from './JournalSentenceText';
import type { JournalFeedback } from './types';

const JournalQuestion = ({ feedback }: { feedback: JournalFeedback }) => (
  <p lang="ja" className="journal-tutor-question text-navy">
    <JournalSentenceText text={feedback.questionReading} />
  </p>
);
export default JournalQuestion;
