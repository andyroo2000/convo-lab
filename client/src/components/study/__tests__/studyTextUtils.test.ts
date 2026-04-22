import { describe, expect, it } from 'vitest';

import { decodeHtmlEntities, parseRubySegments, stripHtmlToText } from '../studyTextUtils';

describe('studyTextUtils', () => {
  it('decodes named and numeric HTML entities without using innerHTML', () => {
    expect(decodeHtmlEntities('Someone&#x27;s &amp; Company')).toBe("Someone's & Company");
    expect(decodeHtmlEntities('Tom &quot;Nook&quot;')).toBe('Tom "Nook"');
  });

  it('strips HTML to plain text while preserving line breaks', () => {
    expect(stripHtmlToText('<p>Hello &amp; goodbye<br />there</p><div>Line 2</div>')).toBe(
      'Hello & goodbye\nthere\nLine 2'
    );
  });

  it('keeps ruby parsing behavior on decoded plain text', () => {
    expect(parseRubySegments('お風呂[ふろ] &amp; 温泉[おんせん]')).toEqual([
      {
        kind: 'text',
        key: 'prefix-0',
        text: 'お',
      },
      {
        kind: 'ruby',
        key: 'ruby-0',
        base: '風呂',
        reading: 'ふろ',
      },
      {
        kind: 'text',
        key: 'text-7',
        text: ' & ',
      },
      {
        kind: 'ruby',
        key: 'ruby-10',
        base: '温泉',
        reading: 'おんせん',
      },
    ]);
  });
});
