import { useState } from 'react';
import type { ReadingDetail } from './types';
import ReadingBookPage from './ReadingBookPage';
import ReadingSidebar from './ReadingSidebar';
import useReadingAudio from './useReadingAudio';
import useReadingKeyboard from './useReadingKeyboard';
import useReadingPosition from './useReadingPosition';

const ReadingReader = ({ reading, userId }: { reading: ReadingDetail; userId?: string }) => {
  const {
    pageIndex,
    selected,
    select: setSelected,
    turnPage: changePage,
    error,
  } = useReadingPosition(reading, userId);
  const [hovered, setHovered] = useState<number | null>(null);
  const audio = useReadingAudio(reading.id, selected);
  const { pages } = reading.document;
  const turnPage = (direction: number) => {
    changePage(direction);
    setHovered(null);
  };
  useReadingKeyboard({ selected, toggleAudio: audio.toggle, turnPage });
  const sentence = selected === null ? null : reading.document.sentences[selected];

  return (
    <div className="reading-reader">
      {error && <p role="status">{error}</p>}
      <div className="reading-layout">
        <ReadingBookPage
          reading={reading}
          page={pages[pageIndex]}
          selected={selected}
          hovered={hovered}
          onSelect={setSelected}
          onHover={setHovered}
        />
        <ReadingSidebar sentence={sentence} voice={reading.voiceName} audio={audio}>
          <nav className="reader-pagination" aria-label="Reading pages">
            <button
              type="button"
              onClick={() => turnPage(1)}
              disabled={pageIndex === pages.length - 1}
              aria-keyshortcuts="ArrowLeft"
            >
              ← Next
            </button>
            <span aria-live="polite">
              Page {pages[pageIndex].number} · {pageIndex + 1} of {pages.length}
            </span>
            <button
              type="button"
              onClick={() => turnPage(-1)}
              disabled={pageIndex === 0}
              aria-keyshortcuts="ArrowRight"
            >
              Previous →
            </button>
          </nav>
        </ReadingSidebar>
      </div>
    </div>
  );
};

export default ReadingReader;
