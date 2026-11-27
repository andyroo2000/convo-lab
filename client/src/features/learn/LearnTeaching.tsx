import JournalRuby from '../journal/JournalRuby';
import type { LearnPrompt } from './types';

const LearnTeaching = ({ teaching }: { teaching: LearnPrompt['teaching'] }) => {
  if (!teaching) return null;
  return (
    <>
      <h2>
        <JournalRuby text={teaching.title} />
      </h2>
      <p className="learn-english">
        <JournalRuby text={teaching.explanation} />
      </p>
      <div className="learn-paper learn-step-example">
        <p className="learn-japanese" lang="ja">
          <JournalRuby text={teaching.example.japanese} />
        </p>
        <p className="learn-english">
          <JournalRuby text={teaching.example.english} />
        </p>
      </div>
    </>
  );
};

export default LearnTeaching;
