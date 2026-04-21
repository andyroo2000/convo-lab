const KANJI_REGEX = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff々]/u;
const HIRAGANA_REGEX = /[\u3040-\u309f]/u;
const KATAKANA_REGEX = /[\u30a0-\u30ff]/u;
const RUBY_PATTERN =
  /([\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff々\u3040-\u309f\u30a0-\u30ff]+)\[([^\]]+)\]/gu;

export interface StudyRubySegment {
  kind: 'text' | 'ruby';
  key: string;
  text?: string;
  base?: string;
  reading?: string;
}

const isKana = (char: string): boolean => HIRAGANA_REGEX.test(char) || KATAKANA_REGEX.test(char);

export const decodeHtmlEntities = (value: string) =>
  value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (match, codePoint) => {
      const parsed = Number.parseInt(codePoint, 10);
      return Number.isNaN(parsed) ? match : String.fromCodePoint(parsed);
    })
    .replace(/&#x([0-9a-f]+);/gi, (match, codePoint) => {
      const parsed = Number.parseInt(codePoint, 16);
      return Number.isNaN(parsed) ? match : String.fromCodePoint(parsed);
    });

export const stripHtmlToText = (value: string) =>
  decodeHtmlEntities(
    value
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<\/blockquote>/gi, '\n')
      .replace(/<[^>]+>/g, '')
  ).trim();

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

  if (length > 40) return 'text-3xl md:text-4xl';
  if (length > 20) return 'text-4xl md:text-5xl';
  return 'text-5xl md:text-6xl';
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
    const [fullMatch, base, reading] = match;

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
