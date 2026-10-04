import type { CSSProperties } from 'react';
import type { ReadingDetail, ReadingPage } from './types';
import ReadingRuby from './ReadingRuby';
import ReadingSegments, { type ReadingSelectionProps } from './ReadingSegments';
import ReadingPageExtras from './ReadingPageExtras';
import ReadingPageIllustration from './ReadingPageIllustration';

const TitleIllustration = ({ reading }: { reading: ReadingDetail }) => {
  const book = reading.document;
  return (
    <div className="book-top">
      <div className="kicker">{book.category}</div>
      <div className="tagline">
        <ReadingRuby text={book.tagline ?? ''} />
      </div>
      <div className="title-frame" />
      <div className="book-title">{book.title}</div>
      <div className="author">
        作・
        <ReadingRuby text={book.authorReading ?? book.author} />
      </div>
      {reading.illustrationUrl && (
        <div className="illustration">
          <img src={reading.illustrationUrl} alt={`${book.title}の挿絵`} />
        </div>
      )}
      <div className="credit">
        絵・
        <ReadingRuby text={book.illustrator ?? ''} />
      </div>
    </div>
  );
};

interface Props extends ReadingSelectionProps {
  page: ReadingPage;
}

function pageAspectRatio(page: ReadingPage) {
  if (!page.imageCrop) return page.imageAspectRatio;
  return ((page.imageAspectRatio ?? 0.707) * page.imageCrop.width) / page.imageCrop.height;
}

const ReadingBookPage = ({ reading, page, ...selection }: Props) => (
  <article
    className="paper"
    data-kind={page.kind}
    lang="ja"
    aria-label={`${reading.title} — ${page.number}`}
    style={{ aspectRatio: pageAspectRatio(page) }}
  >
    {page.kind === 'title' && <TitleIllustration reading={reading} />}
    {page.imageUrl && <ReadingPageIllustration page={page} />}
    <div className="book-columns">
      {page.columns.map((column, index) => (
        <div
          className="book-column"
          key={JSON.stringify(column)}
          style={{ '--column-index': index } as CSSProperties}
        >
          <ReadingSegments reading={reading} {...selection} segments={column} />
        </div>
      ))}
    </div>
    <ReadingPageExtras reading={reading} page={page} {...selection} />
    <span className="folio">{page.number}</span>
  </article>
);

export default ReadingBookPage;
