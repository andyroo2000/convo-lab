import { Fragment } from 'react';
import { parseRubySegments } from '../../components/study/studyTextUtils';

const ReadingRuby = ({ text }: { text: string }) => (
  <>
    {parseRubySegments(text).map((part) =>
      part.kind === 'text' ? (
        <Fragment key={part.key}>{part.text}</Fragment>
      ) : (
        <ruby key={part.key}>
          {part.base}
          <rt>{part.reading}</rt>
        </ruby>
      )
    )}
  </>
);

export default ReadingRuby;
