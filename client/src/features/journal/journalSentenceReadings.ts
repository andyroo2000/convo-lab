// Match source sentence lengths without splitting ruby annotations or surrogate pairs.
export default function sentenceReadings(reading: string, texts: string[]): string[] | null {
  const tokens = reading.match(/[^\][]\[[^\]]+\]|[\s\S]/gu) ?? [];
  const parts: string[] = [];
  let index = 0;
  const matched = texts.every((text) => {
    let plain = '';
    let part = '';
    while (index < tokens.length && plain.length < text.length) {
      const token = tokens[index];
      part += token;
      plain += token.replace(/\[[^\]]+\]/gu, '');
      index += 1;
    }
    if (plain !== text) return false;
    parts.push(part);
    return true;
  });
  return matched && index === tokens.length ? parts : null;
}
