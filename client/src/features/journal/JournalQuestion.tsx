import type { ReactNode } from 'react';
import { journalTextStyle } from './journalTypography';
import JournalSentenceText from './JournalSentenceText';
import JournalEnglish from './JournalEnglish';
import type { JournalFeedback } from './types';

const JournalQuestion = ({
  feedback,
  controls,
}: {
  feedback: JournalFeedback;
  controls?: ReactNode;
}) => (
  <div className="flow-root">
    <div className="relative z-10 -mr-1 -mt-1 ml-2 flex float-right">
      <JournalEnglish translation={feedback.questionTranslation} />
      {controls}
    </div>
    <p style={journalTextStyle} lang="ja" className="text-xl leading-[2.05] text-navy">
      <JournalSentenceText text={feedback.questionReading} />
    </p>
  </div>
);
export default JournalQuestion;
