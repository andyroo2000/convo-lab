import { useState } from 'react';
import JournalRuby from './JournalRuby';
import type { JournalFeedback } from './types';

const JournalQuestion = ({ feedback }: { feedback: JournalFeedback }) => {
  const [showEnglish, setShowEnglish] = useState(false);
  return (
    <div className="space-y-3">
      <p lang="ja" className="text-xl leading-loose text-navy">
        <JournalRuby text={feedback.questionReading} />
      </p>
      <button
        type="button"
        className="text-sm text-indigo"
        aria-expanded={showEnglish}
        onClick={() => setShowEnglish(!showEnglish)}
      >
        {showEnglish ? 'Hide English' : 'Show English'}
      </button>
      {showEnglish && <p className="text-sm text-gray-600">{feedback.questionTranslation}</p>}
    </div>
  );
};
export default JournalQuestion;
