import { useState } from 'react';
import { journalTextStyle } from './journalTypography';
import JournalRuby from './JournalRuby';
import type { JournalFeedback } from './types';

const JournalQuestion = ({ feedback }: { feedback: JournalFeedback }) => {
  const [showEnglish, setShowEnglish] = useState(false);
  return (
    <div className="space-y-3">
      <p style={journalTextStyle} lang="ja" className="text-xl leading-loose text-navy">
        <JournalRuby text={feedback.questionReading} />
      </p>
      <button
        type="button"
        className="min-h-11 min-w-11 rounded-lg px-2 text-xs font-semibold tracking-wide text-indigo hover:bg-white/70"
        aria-label={showEnglish ? 'Hide English' : 'Show English'}
        aria-expanded={showEnglish}
        onClick={() => setShowEnglish(!showEnglish)}
      >
        EN
      </button>
      {showEnglish && <p className="text-sm text-gray-600">{feedback.questionTranslation}</p>}
    </div>
  );
};
export default JournalQuestion;
