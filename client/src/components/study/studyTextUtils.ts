const KANJI_REGEX = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff々]/u;
const HIRAGANA_REGEX = /[\u3040-\u309f]/u;
const KATAKANA_REGEX = /[\u30a0-\u30ff]/u;
const RUBY_PATTERN =
  /([\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff々\u3040-\u309f\u30a0-\u30ff]+)(?:\[([^\]]+)\]|\(([^)]+)\))/gu;
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

export const getHeadlineClasses = (value?: string | null) => {
  const length = value?.length ?? 0;

  if (length > 40) return 'text-2xl sm:text-3xl md:text-4xl';
  if (length > 20) return 'text-3xl sm:text-4xl md:text-5xl';
  return 'text-4xl sm:text-5xl md:text-6xl';
};

const normalizeRubyMatch = (base: string, reading: string) => {
  const cleanReading = reading.replace(/\s+/g, '');

  let kanjiStart = 0;
  while (kanjiStart < base.length && isKana(base[kanjiStart])) {
    kanjiStart += 1;
  }

  let kanjiEnd = base.length;
  while (kanjiEnd > kanjiStart && isKana(base[kanjiEnd - 1])) {
    kanjiEnd -= 1;
  }

  if (
    kanjiStart >= base.length ||
    kanjiStart >= kanjiEnd ||
    !KANJI_REGEX.test(base.slice(kanjiStart, kanjiEnd))
  ) {
    return {
      prefix: '',
      kanjiPart: base,
      suffix: '',
      reading: cleanReading,
    };
  }

  const prefix = base.substring(0, kanjiStart);
  const kanjiPart = base.substring(kanjiStart, kanjiEnd);
  const suffix = base.substring(kanjiEnd);

  let adjustedReading = cleanReading;
  if (prefix && adjustedReading.startsWith(prefix)) {
    adjustedReading = adjustedReading.slice(prefix.length);
  }
  if (suffix && adjustedReading.endsWith(suffix)) {
    adjustedReading = adjustedReading.slice(0, adjustedReading.length - suffix.length);
  }

  return {
    prefix,
    kanjiPart,
    suffix,
    reading: adjustedReading || cleanReading,
  };
};

export const parseRubySegments = (value?: string | null): StudyRubySegment[] => {
  if (!value) return [];

  const decoded = decodeHtmlEntities(value);
  const segments: StudyRubySegment[] = [];
  let lastIndex = 0;

  Array.from(decoded.matchAll(RUBY_PATTERN)).forEach((match) => {
    const matchIndex = match.index ?? 0;
    const [fullMatch, base, bracketReading, parentheticalReading] = match;
    const isParentheticalRuby = parentheticalReading !== undefined;
    const reading = bracketReading ?? parentheticalReading ?? '';

    if (isParentheticalRuby && (!isKanaReading(reading) || !KANJI_REGEX.test(base))) {
      return;
    }

    if (matchIndex > lastIndex) {
      segments.push({
        kind: 'text',
        key: `text-${lastIndex}`,
        text: decoded.slice(lastIndex, matchIndex),
      });
    }

    const normalized = normalizeRubyMatch(base, reading);

    if (normalized.prefix) {
      segments.push({
        kind: 'text',
        key: `prefix-${matchIndex}`,
        text: normalized.prefix,
      });
    }

    segments.push({
      kind: 'ruby',
      key: `ruby-${matchIndex}`,
      base: normalized.kanjiPart,
      reading: normalized.reading,
    });

    if (normalized.suffix) {
      segments.push({
        kind: 'text',
        key: `suffix-${matchIndex}`,
        text: normalized.suffix,
      });
    }

    lastIndex = matchIndex + fullMatch.length;
  });

  if (lastIndex < decoded.length) {
    segments.push({
      kind: 'text',
      key: `text-${lastIndex}`,
      text: decoded.slice(lastIndex),
    });
  }

  if (!segments.length) {
    return [
      {
        kind: 'text',
        key: 'text-0',
        text: decoded,
      },
    ];
  }

  return segments;
};
