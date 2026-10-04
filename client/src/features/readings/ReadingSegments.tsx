import type { ReadingDetail, ReadingSegment } from './types';
import ReadingRuby from './ReadingRuby';

export interface ReadingSelectionProps {
  reading: ReadingDetail;
  selected: number | null;
  hovered: number | null;
  onSelect: (sentence: number) => void;
  onHover: (sentence: number | null) => void;
}

const ReadingSegments = ({
  reading,
  segments,
  selected,
  hovered,
  onSelect,
  onHover,
}: ReadingSelectionProps & { segments: ReadingSegment[] }) => (
  <>
    {segments.map(([id, text]) => (
      <button
        type="button"
        key={`${id}:${text}`}
        className={`reading-segment ${id === selected || id === hovered ? 'is-highlighted' : ''}`}
        aria-label={reading.document.sentences[id].text}
        aria-pressed={id === selected}
        onClick={() => onSelect(id)}
        onMouseEnter={() => onHover(id)}
        onMouseLeave={() => onHover(null)}
        onFocus={() => onHover(id)}
        onBlur={() => onHover(null)}
      >
        <ReadingRuby text={text} />
      </button>
    ))}
  </>
);

export default ReadingSegments;
