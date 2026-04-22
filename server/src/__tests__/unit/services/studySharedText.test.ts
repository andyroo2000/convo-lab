import { describe, expect, it } from 'vitest';

import {
  noteFieldValueToString,
  stripHtml,
  toSearchText,
} from '../../../services/study/shared/text.js';

describe('study shared text helpers', () => {
  it('strips HTML into plain text with line breaks', () => {
    expect(stripHtml('<div>Hello<br>world</div>')).toBe('Hello\nworld');
  });

  it('builds normalized search text from nested values', () => {
    expect(
      toSearchText({ prompt: '<b>会社</b>', nested: ['company', { hint: 'office' }] }, true, 12)
    ).toBe('会社 company office true 12');
  });

  it('serializes non-string field values safely', () => {
    expect(noteFieldValueToString({ a: 1 })).toBe('{"a":1}');
  });
});
