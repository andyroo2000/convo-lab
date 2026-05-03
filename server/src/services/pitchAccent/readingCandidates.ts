const HIRAGANA_START = 0x3041;
const HIRAGANA_END = 0x3096;
const KATAKANA_START = 0x30a1;
const KATAKANA_END = 0x30f6;

function toHiragana(value: string): string {
  return Array.from(value)
    .map((char) => {
      const code = char.charCodeAt(0);
      if (code >= KATAKANA_START && code <= KATAKANA_END) {
        return String.fromCharCode(code - 0x60);
      }
      return char;
    })
    .join('');
}

function onlyKana(value: string): string {
  return toHiragana(value).replace(/[^\u3041-\u3096ー]/g, '');
}

function isUsableKana(value: string): boolean {
  return (
    value.length > 0 &&
    Array.from(value).every((char) => {
      const code = char.charCodeAt(0);
      return (code >= HIRAGANA_START && code <= HIRAGANA_END) || char === 'ー';
    })
  );
}

function addCandidate(candidates: string[], value: string | null | undefined): void {
  if (!value) return;
  const normalized = onlyKana(value);
  if (isUsableKana(normalized) && !candidates.includes(normalized)) {
    candidates.push(normalized);
  }
}

function extractBracketReadings(value: string): string[] {
  return Array.from(value.matchAll(/\[([^\]]+)]|\(([^)]+)\)/g), (match) => match[1] ?? match[2]);
}

export function collectPitchAccentReadingCandidates(input: {
  expressionReading?: string | null;
  promptReading?: string | null;
  answerAudioTextOverride?: string | null;
  sentenceJpKana?: string | null;
}): string[] {
  const candidates: string[] = [];
  const readingFields = [input.expressionReading, input.promptReading];

  for (const field of readingFields) {
    if (!field) continue;
    const extracted = extractBracketReadings(field);
    if (extracted.length > 0) {
      extracted.forEach((reading) => addCandidate(candidates, reading));
    } else {
      addCandidate(candidates, field);
    }
  }

  addCandidate(candidates, input.answerAudioTextOverride);
  return candidates;
}
