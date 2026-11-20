// A pinned-source adapter must fail loudly if its expected source changes.
export function replaceRequired(source, before, after, expected = 1) {
  const count = source.split(before).length - 1;
  if (count !== expected)
    throw Error(`Expected ${expected} matches for ${JSON.stringify(before)}, found ${count}`);
  return source.replaceAll(before, after);
}
