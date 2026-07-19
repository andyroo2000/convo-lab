import { describe, expect, it } from 'vitest';

import { noteFieldValueToString, stripHtml } from '../../../services/study/shared/text.js';

describe('study shared text helpers', () => {
  it('strips HTML into plain text with line breaks', () => {
    expect(stripHtml('<div>Hello<br>world</div>')).toBe('Hello\nworld');
  });

  it('serializes non-string field values safely', () => {
    expect(noteFieldValueToString({ a: 1 })).toBe('{"a":1}');
  });
});
