import JournalRuby from './JournalRuby';
import type { JournalSegment } from './types';

const JournalEditText = ({ segment }: { segment: JournalSegment }) => {
  if (segment.replacement == null) return <JournalRuby text={segment.reading} />;
  return (
    <>
      {segment.text !== '' && (
        <del className="text-gray-500 decoration-1 dark:text-gray-400">
          <JournalRuby text={segment.reading} />
        </del>
      )}
      {segment.replacement !== '' && (
        <ins className="rounded bg-emerald-100 px-0.5 text-inherit underline decoration-1 underline-offset-4 dark:bg-emerald-900/50">
          <JournalRuby text={segment.replacementReading ?? segment.replacement} />
        </ins>
      )}
    </>
  );
};

export default JournalEditText;
