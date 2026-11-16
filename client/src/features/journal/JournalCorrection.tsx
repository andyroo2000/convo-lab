import useCorrectionArrow from './useCorrectionArrow';
import JournalRuby from './JournalRuby';
import type { JournalSegment } from './types';

const JournalCorrection = ({ segment }: { segment: JournalSegment }) => {
  const layout = useCorrectionArrow();
  if (segment.replacement == null) return null;
  return (
    <div
      ref={layout.container}
      className="journal-correction"
      role="group"
      aria-label="Suggested edit"
    >
      {segment.text ? (
        <span ref={layout.original} lang="ja">
          <span className="journal-correction-original">
            <JournalRuby text={segment.reading} />
          </span>
        </span>
      ) : (
        <span ref={layout.original} className="journal-correction-label">
          Insert
        </span>
      )}
      <span ref={layout.target} className="journal-correction-target">
        <span ref={layout.arrow} className="journal-correction-arrow" aria-hidden="true">
          →
        </span>
        {segment.replacement ? (
          <span className="journal-correction-replacement" lang="ja">
            <JournalRuby text={segment.replacementReading ?? segment.replacement} />
          </span>
        ) : (
          <span className="journal-correction-label">Remove</span>
        )}
      </span>
    </div>
  );
};

export default JournalCorrection;
