import { describe, expect, it } from 'vitest';

import { studyReadingSize } from '../studyReadingSize';

describe('studyReadingSize', () => {
  it.each([
    ['', 'phrase'],
    ['  娘  ', 'character'],
    ['あ'.repeat(5), 'word'],
    ['あ'.repeat(6), 'sentence'],
    ['A'.repeat(32), 'phrase'],
    ['A'.repeat(33), 'sentence'],
    ['あ'.repeat(45), 'sentence'],
    ['あ'.repeat(46), 'passage'],
    ['日本ABC', 'word'],
  ])('sizes "%s" as %s', (text, size) => {
    expect(studyReadingSize(text)).toBe(size);
  });
});
