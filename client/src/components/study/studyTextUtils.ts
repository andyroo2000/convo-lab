const KANJI_REGEX = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff々]/u;
const HIRAGANA_REGEX = /[\u3040-\u309f]/u;
const KATAKANA_REGEX = /[\u30a0-\u30ff]/u;
const RUBY_PATTERN =
  /([\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff々\u3040-\u309f\u30a0-\u30ff]+)(?:\[([^\]]+)\]|\(([^)]+)\))/gu;
const PARTICLE_PREFIXES = new Set([
  'は',
  'が',
  'を',
  'に',
  'へ',
  'で',
  'と',
  'も',
  'の',
  'や',
  'か',
  'ね',
  'よ',
]);
const BLOCK_LEVEL_TAGS = new Set([
  'p',
  'div',
  'blockquote',
  'section',
  'article',
  'header',
  'footer',
  'li',
  'ul',
  'ol',
]);

export interface StudyRubySegment {
  kind: 'text' | 'ruby';
  key: string;
  text?: string;
  base?: string;
  reading?: string;
}

const isKana = (char: string): boolean => HIRAGANA_REGEX.test(char) || KATAKANA_REGEX.test(char);

const normalizeKanaCharacter = (char: string) => {
  const codePoint = char.codePointAt(0);
  if (codePoint === undefined) return char;
  if (codePoint < 0x30a1) return char;
  if (codePoint > 0x30f6) return char;
  return String.fromCodePoint(codePoint - 0x60);
};

interface RubyAlignmentContext {
  baseCharacters: string[];
  readingCharacters: string[];
  memo: Map<string, boolean>;
}

interface RubyTextPair {
  base: string;
  reading: string;
}

const alignRubyKana = (
  context: RubyAlignmentContext,
  baseIndex: number,
  readingIndex: number,
  alignFrom: (baseIndex: number, readingIndex: number) => boolean
) => {
  if (readingIndex >= context.readingCharacters.length) return false;
  const baseCharacter = normalizeKanaCharacter(context.baseCharacters[baseIndex]);
  const readingCharacter = normalizeKanaCharacter(context.readingCharacters[readingIndex]);
  if (baseCharacter !== readingCharacter) return false;
  return alignFrom(baseIndex + 1, readingIndex + 1);
};

const alignRubyKanji = (
  context: RubyAlignmentContext,
  baseIndex: number,
  readingIndex: number,
  alignFrom: (baseIndex: number, readingIndex: number) => boolean
) => {
  const remainingCharactersAfterKanji = context.baseCharacters.length - baseIndex - 1;
  const latestReadingEnd = context.readingCharacters.length - remainingCharactersAfterKanji;
  for (let readingEnd = readingIndex + 1; readingEnd <= latestReadingEnd; readingEnd += 1) {
    if (alignFrom(baseIndex + 1, readingEnd)) return true;
  }
  return false;
};

// The source regex necessarily consumes adjacent Japanese text before `[reading]`.
// Use literal kana as alignment anchors while allowing each kanji one or more reading kana.
const canAlignRubyBaseToReading = ({ base, reading }: RubyTextPair) => {
  const context: RubyAlignmentContext = {
    baseCharacters: Array.from(base),
    readingCharacters: Array.from(reading),
    memo: new Map<string, boolean>(),
  };

  const alignFrom = (baseIndex: number, readingIndex: number): boolean => {
    const memoKey = `${String(baseIndex)}:${String(readingIndex)}`;
    const memoized = context.memo.get(memoKey);
    if (memoized !== undefined) return memoized;

    if (baseIndex === context.baseCharacters.length) {
      return readingIndex === context.readingCharacters.length;
    }

    const remainingBaseLength = context.baseCharacters.length - baseIndex;
    const remainingReadingLength = context.readingCharacters.length - readingIndex;
    if (remainingReadingLength < remainingBaseLength) {
      context.memo.set(memoKey, false);
      return false;
    }

    const matches = isKana(context.baseCharacters[baseIndex])
      ? alignRubyKana(context, baseIndex, readingIndex, alignFrom)
      : alignRubyKanji(context, baseIndex, readingIndex, alignFrom);
    context.memo.set(memoKey, matches);
    return matches;
  };

  return alignFrom(0, 0);
};

const splitUnannotatedRubyPrefix = ({ base, reading }: RubyTextPair) => {
  const characters = Array.from(base);
  const hasKanaBeforeLaterKanji = characters.some(
    (character, index) =>
      isKana(character) && characters.slice(index + 1).some((later) => KANJI_REGEX.test(later))
  );

  if (!hasKanaBeforeLaterKanji || canAlignRubyBaseToReading({ base, reading })) {
    return { prefix: '', base };
  }

  for (let index = 1; index < characters.length; index += 1) {
    if (KANJI_REGEX.test(characters[index])) {
      const candidate = characters.slice(index).join('');
      if (canAlignRubyBaseToReading({ base: candidate, reading })) {
        return {
          prefix: characters.slice(0, index).join(''),
          base: candidate,
        };
      }
    }
  }

  return { prefix: '', base };
};

const isKanaReading = (value: string): boolean => {
  const normalized = value.replace(/\s+/g, '');
  return normalized.length > 0 && /^[\u3040-\u309f\u30a0-\u30ffー・]+$/u.test(normalized);
};

const collapsePlainText = (value: string) =>
  value
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const decodeHtmlEntitiesWithDomParser = (value: string) => {
  const document = new DOMParser().parseFromString(value, 'text/html');
  return document.documentElement.textContent ?? value;
};

const collectNodeText = (node: Node, output: string[]) => {
  if (node.nodeType === Node.TEXT_NODE || node.nodeType === Node.CDATA_SECTION_NODE) {
    output.push(node.textContent ?? '');
    return;
  }

  if (!(node instanceof Element)) {
    return;
  }

  const tagName = node.tagName.toLowerCase();
  if (tagName === 'br') {
    output.push('\n');
    return;
  }

  node.childNodes.forEach((child) => collectNodeText(child, output));

  if (BLOCK_LEVEL_TAGS.has(tagName)) {
    output.push('\n');
  }
};

export const decodeHtmlEntities = (value: string) => {
  if (typeof DOMParser === 'undefined') {
    return value;
  }

  return decodeHtmlEntitiesWithDomParser(value);
};

export const stripHtmlToText = (value: string) => {
  if (typeof DOMParser === 'undefined') {
    return collapsePlainText(value);
  }

  const document = new DOMParser().parseFromString(value, 'text/html');
  const output: string[] = [];
  document.body.childNodes.forEach((node) => collectNodeText(node, output));
  return collapsePlainText(output.join(''));
};

export const toDisplayText = (value?: string | null) => {
  if (!value) return null;
  return decodeHtmlEntities(value).trim();
};

export const toNotesList = (value?: string | null) => {
  if (!value) return [];

  return stripHtmlToText(value)
    .split('\n')
    .map((line) => line.replace(/^[•\-\s]+/, '').trim())
    .filter(Boolean);
};

export const getHeadlineClasses = (
  value?: string | null,
  options: { compactMobile?: boolean } = {}
) => {
  const length = value?.length ?? 0;

  if (options.compactMobile) {
    if (length > 40) return 'text-xl sm:text-2xl md:text-4xl';
    if (length > 20) return 'text-2xl sm:text-3xl md:text-5xl';
    return 'text-[2rem] sm:text-4xl md:text-6xl';
  }

  if (length > 40) return 'text-2xl sm:text-3xl md:text-4xl';
  if (length > 20) return 'text-3xl sm:text-4xl md:text-5xl';
  return 'text-4xl sm:text-5xl md:text-6xl';
};

interface NormalizeRubyMatchOptions extends RubyTextPair {
  preservePrefixReading: boolean;
}

interface KanjiBounds {
  start: number;
  end: number;
}

const findKanjiBounds = ({ base }: Pick<RubyTextPair, 'base'>): KanjiBounds => {
  let start = 0;
  while (start < base.length && isKana(base[start])) start += 1;

  let end = base.length;
  while (end > start && isKana(base[end - 1])) end -= 1;
  return { start, end };
};

const hasKanjiBase = ({ base, start, end }: Pick<RubyTextPair, 'base'> & KanjiBounds) => {
  if (start >= base.length) return false;
  if (start >= end) return false;
  return KANJI_REGEX.test(base.slice(start, end));
};

interface ReadingAffixOptions {
  reading: string;
  prefix: string;
  suffix: string;
  preservePrefixReading: boolean;
}

const shouldStripReadingPrefix = ({
  reading,
  prefix,
  preservePrefixReading,
}: Omit<ReadingAffixOptions, 'suffix'>) => {
  if (!prefix) return false;
  if (preservePrefixReading) return false;
  if (PARTICLE_PREFIXES.has(prefix)) return false;
  return reading.startsWith(prefix);
};

const stripReadingAffixes = ({
  reading,
  prefix,
  suffix,
  preservePrefixReading,
}: ReadingAffixOptions) => {
  let adjusted = shouldStripReadingPrefix({ reading, prefix, preservePrefixReading })
    ? reading.slice(prefix.length)
    : reading;
  if (suffix && adjusted.endsWith(suffix)) {
    adjusted = adjusted.slice(0, adjusted.length - suffix.length);
  }
  return adjusted;
};

const normalizeRubyMatch = ({
  base,
  reading,
  preservePrefixReading,
}: NormalizeRubyMatchOptions) => {
  const cleanReading = reading.replace(/\s+/g, '');
  const { start, end } = findKanjiBounds({ base });
  if (!hasKanjiBase({ base, start, end })) {
    return {
      prefix: '',
      kanjiPart: base,
      suffix: '',
      reading: cleanReading,
    };
  }

  let prefix = base.substring(0, start);
  let kanjiPart = base.substring(start, end);
  const suffix = base.substring(end);
  const adjustedReading = stripReadingAffixes({
    reading: cleanReading,
    prefix,
    suffix,
    preservePrefixReading,
  });

  const realigned = splitUnannotatedRubyPrefix({ base: kanjiPart, reading: adjustedReading });
  prefix += realigned.prefix;
  kanjiPart = realigned.base;

  return {
    prefix,
    kanjiPart,
    suffix,
    reading: adjustedReading || cleanReading,
  };
};

interface RubyMatchParts {
  base: string;
  reading: string;
  bracketReading: string | undefined;
  parentheticalReading: string | undefined;
}

const isSupportedRubyMatch = ({
  base,
  reading,
  bracketReading,
  parentheticalReading,
}: RubyMatchParts) => {
  // Cloze blanks use `[...]`; do not interpret the ellipsis as a reading.
  if (bracketReading === '...') return false;
  if (parentheticalReading === undefined) return true;
  if (!isKanaReading(reading)) return false;
  return KANJI_REGEX.test(base);
};

interface RubySegmentAccumulator {
  decoded: string;
  segments: StudyRubySegment[];
  lastIndex: number;
}

const appendRubyMatch = (accumulator: RubySegmentAccumulator, match: RegExpMatchArray) => {
  const matchIndex = match.index ?? 0;
  const [fullMatch, base, bracketReading, parentheticalReading] = match;
  const reading = bracketReading ?? parentheticalReading ?? '';
  if (!isSupportedRubyMatch({ base, reading, bracketReading, parentheticalReading })) return;

  if (matchIndex > accumulator.lastIndex) {
    accumulator.segments.push({
      kind: 'text',
      key: `text-${accumulator.lastIndex}`,
      text: accumulator.decoded.slice(accumulator.lastIndex, matchIndex),
    });
  }

  // When ruby annotations are adjacent, any leading kana in this regex match was
  // written after the previous annotation and belongs to the plain surface text.
  // It must not consume the start of the following kanji reading, as in
  // `悪[わる]い意味[いみ]`.
  const normalized = normalizeRubyMatch({
    base,
    reading,
    preservePrefixReading: accumulator.lastIndex > 0 && matchIndex === accumulator.lastIndex,
  });

  if (normalized.prefix) {
    accumulator.segments.push({
      kind: 'text',
      key: `prefix-${matchIndex}`,
      text: normalized.prefix,
    });
  }

  accumulator.segments.push({
    kind: 'ruby',
    key: `ruby-${matchIndex}`,
    base: normalized.kanjiPart,
    reading: normalized.reading,
  });

  if (normalized.suffix) {
    accumulator.segments.push({
      kind: 'text',
      key: `suffix-${matchIndex}`,
      text: normalized.suffix,
    });
  }

  accumulator.lastIndex = matchIndex + fullMatch.length;
};

export const parseRubySegments = (value?: string | null): StudyRubySegment[] => {
  if (!value) return [];

  const decoded = decodeHtmlEntities(value);
  const accumulator: RubySegmentAccumulator = { decoded, segments: [], lastIndex: 0 };
  Array.from(decoded.matchAll(RUBY_PATTERN)).forEach((match) =>
    appendRubyMatch(accumulator, match)
  );

  if (accumulator.lastIndex < decoded.length) {
    accumulator.segments.push({
      kind: 'text',
      key: `text-${accumulator.lastIndex}`,
      text: decoded.slice(accumulator.lastIndex),
    });
  }

  if (!accumulator.segments.length) {
    return [
      {
        kind: 'text',
        key: 'text-0',
        text: decoded,
      },
    ];
  }

  return accumulator.segments;
};
