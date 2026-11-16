import { Fragment, type ReactNode } from 'react';
import JournalRuby from './JournalRuby';
import type { JournalSegment } from './types';

function sentenceSpacing(text: string) {
  // A half-em space separates mixed-language sentences without changing their punctuation.
  return text
    .replace(
      /((?:[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}々〆ー]|\[[ぁ-ゖァ-ヺー]+\])\*{0,3}\.)[ \t]+(?=\S)/gu,
      '$1\u2002'
    )
    .replace(
      /\.[ \t]+(?=\*{0,3}[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}])/gu,
      '.\u2002'
    );
}

function explanationText(segment: JournalSegment) {
  const text = sentenceSpacing(segment.explanationReading ?? segment.explanation ?? '');
  if (segment.replacement == null) return text;
  // Match the full annotation: the same kanji with another reading still needs ruby.
  const displayed = new Set(
    [
      ...`${segment.reading} ${segment.replacementReading ?? ''}`.matchAll(
        /[\p{Unified_Ideograph}々〆]+\[[^\]]+\]/gu
      ),
    ].map(([annotation]) => annotation)
  );
  return text.replace(/([\p{Unified_Ideograph}々〆]+)\[[^\]]+\]/gu, (annotation, kanji: string) =>
    displayed.has(annotation) ? kanji : annotation
  );
}

function splitParts(text: string, pattern: RegExp) {
  let offset = 0;
  return text
    .split(pattern)
    .map((part, index) => {
      const key = offset;
      offset += part.length;
      return { text: part, key, matched: index % 2 === 1 };
    })
    .filter((part) => part.text !== '');
}

const JapaneseTerms = ({ text, replacement }: { text: string; replacement: string }) => (
  <>
    {splitParts(
      text,
      /((?:[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}々〆ー]+(?:\[[ぁ-ゖァ-ヺー]+\])?)+)/gu
    ).map((part) =>
      part.matched ? (
        <span
          lang="ja"
          key={part.key}
          className={
            replacement === part.text.replace(/\[[^\]]+\]/gu, '')
              ? 'journal-corrected-term'
              : undefined
          }
        >
          <JournalRuby text={part.text} />
        </span>
      ) : (
        <Fragment key={part.key}>{part.text}</Fragment>
      )
    )}
  </>
);

function emphasized(text: string, replacement: string): ReactNode {
  const marker = text.match(/^\*{1,3}/)?.[0] ?? '';
  const content = (
    <JapaneseTerms text={text.slice(marker.length, -marker.length)} replacement={replacement} />
  );
  if (marker === '***')
    return (
      <strong>
        <em>{content}</em>
      </strong>
    );
  if (marker === '**') return <strong>{content}</strong>;
  return <em>{content}</em>;
}

// Only inline emphasis is interpreted. HTML, links, images and other markup stay text.
const JournalExplanation = ({ segment }: { segment: JournalSegment }) => (
  <p className="journal-explanation">
    {splitParts(explanationText(segment), /(\*+[^*]+\*+)/g).map((part) => (
      <Fragment key={part.key}>
        {part.matched && /^(\*{1,3})[^*]+\1$/.test(part.text) ? (
          emphasized(part.text, segment.replacement ?? '')
        ) : (
          <JapaneseTerms text={part.text} replacement={segment.replacement ?? ''} />
        )}
      </Fragment>
    ))}
  </p>
);

export default JournalExplanation;
