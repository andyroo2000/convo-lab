import { Fragment } from 'react';
import { useKnownKanjiContext } from '../../contexts/KnownKanjiContext';

function readingParts(text: string) {
  const parts: { key: number; text: string; reading?: string }[] = [];
  let offset = 0;
  Array.from(text.matchAll(/([\p{Unified_Ideograph}々〆]+)\[([^\]]+)\]/gu)).forEach((match) => {
    if (match.index > offset) parts.push({ key: offset, text: text.slice(offset, match.index) });
    parts.push({ key: match.index, text: match[1], reading: match[2] });
    offset = match.index + match[0].length;
  });
  if (offset < text.length) parts.push({ key: offset, text: text.slice(offset) });
  return parts;
}

const JournalRuby = ({ text }: { text: string }) => {
  const { active, knownKanji } = useKnownKanjiContext();
  return (
    <>
      {readingParts(text).map((part) => {
        if (part.reading === undefined) return <Fragment key={part.key}>{part.text}</Fragment>;
        const kanji = Array.from(part.text).filter((char) => /\p{Unified_Ideograph}/u.test(char));
        const known = active && kanji.length > 0 && kanji.every((char) => knownKanji.has(char));
        return (
          <ruby key={part.key}>
            {part.text}
            <rt className={known ? 'invisible' : ''} aria-hidden={known}>
              {part.reading}
            </rt>
          </ruby>
        );
      })}
    </>
  );
};

export default JournalRuby;
