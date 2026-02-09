export function normalizeMatchText(text: string): string {
  return text
    .trim()
    .replace(/\s+/g, '')
    .replace(/^[「『（(【［["'“”]+/, '')
    .replace(/[」』）)】］\]"'“”]+$/, '');
}
