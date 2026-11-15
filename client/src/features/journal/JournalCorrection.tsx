import JournalRuby from './JournalRuby';
import type { JournalSegment } from './types';

const JournalCorrection = ({ segment }: { segment: JournalSegment }) => {
  if (segment.replacement == null) return null;
  return (
    <div className="journal-correction" aria-label="Suggested edit">
      {segment.text ? (
        <span className="journal-correction-original" lang="ja">
          <JournalRuby text={segment.reading} />
        </span>
      ) : (
        <span className="journal-correction-label">Insert</span>
      )}
      <span className="journal-correction-arrow" aria-hidden="true">
        →
      </span>
      {segment.replacement ? (
        <span className="journal-correction-replacement" lang="ja">
          <JournalRuby text={segment.replacementReading ?? segment.replacement} />
        </span>
      ) : (
        <span className="journal-correction-label">Remove</span>
      )}
    </div>
  );
};

export default JournalCorrection;
