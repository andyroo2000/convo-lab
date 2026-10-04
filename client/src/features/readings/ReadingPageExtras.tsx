import type { ReadingPage } from './types';
import ReadingSegments, { type ReadingSelectionProps } from './ReadingSegments';

const ReadingPageExtras = ({
  page,
  ...selection
}: ReadingSelectionProps & { page: ReadingPage }) => (
  <>
    {page.notes && (
      <aside
        className="book-notes"
        style={{ left: `${page.notesLeft ?? 3}%` }}
        aria-label="Printed vocabulary notes"
      >
        {page.notes.map((segment) => (
          <div key={segment[0]}>
            <ReadingSegments {...selection} segments={[segment]} />
          </div>
        ))}
      </aside>
    )}
    {page.biography && (
      <aside className="book-biography" aria-label="Author note">
        <ReadingSegments {...selection} segments={[page.biography]} />
      </aside>
    )}
    {page.source && <p className="book-source">{page.source}</p>}
  </>
);

export default ReadingPageExtras;
