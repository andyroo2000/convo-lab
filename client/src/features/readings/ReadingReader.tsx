import { useCallback, useState } from 'react';
import type { ReadingDetail } from './types';
import ReadingBookPage from './ReadingBookPage';
import ReadingSidebar from './ReadingSidebar';
import useReadingAudio from './useReadingAudio';
import useReadingKeyboard from './useReadingKeyboard';

const ReadingReader = ({ reading }: { reading: ReadingDetail }) => {
  const [pageIndex, setPageIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const audio = useReadingAudio(reading.id, selected);
  const { pages } = reading.document;
  const turnPage = useCallback(
    (direction: number) => {
      const next = pageIndex + direction;
      if (next < 0 || next >= pages.length) return;
      setPageIndex(next);
      setSelected(null);
      setHovered(null);
    },
    [pageIndex, pages.length]
  );
  useReadingKeyboard({ selected, toggleAudio: audio.toggle, turnPage });
  const sentence = selected === null ? null : reading.document.sentences[selected];

  return (
    <div className="reading-reader">
      <div className="reading-layout">
        <ReadingBookPage
          reading={reading}
          page={pages[pageIndex]}
          selected={selected}
          hovered={hovered}
          onSelect={setSelected}
          onHover={setHovered}
        />
        <ReadingSidebar sentence={sentence} voice={reading.voiceName} audio={audio} />
      </div>
      <footer className="reader-footer">
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
      </footer>
    </div>
  );
};

export default ReadingReader;
