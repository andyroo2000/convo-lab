export function parseNullableString(value: unknown): string | null | undefined {
  if (typeof value === 'undefined') return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') return undefined;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const quotePairs: Array<[string, string]> = [
    ['"', '"'],
    ["'", "'"],
    ['“', '”'],
    ['「', '」'],
  ];
  const unquoted = quotePairs.reduce((current, [open, close]) => {
    if (current.length >= 2 && current.startsWith(open) && current.endsWith(close)) {
      return current.slice(1, -1).trim();
    }
    return current;
  }, trimmed);

  return unquoted || null;
}
