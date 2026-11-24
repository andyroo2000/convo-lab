export type ReadingSize = 'character' | 'word' | 'phrase' | 'sentence' | 'passage';

export function studyReadingSize(text: string): ReadingSize {
  const count = Array.from(text.trim()).length;
  if (/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(text)) {
    if (count === 1) return 'character';
    if (count <= 5) return 'word';
  } else if (count <= 32) {
    return 'phrase';
  }
  return count <= 45 ? 'sentence' : 'passage';
}
