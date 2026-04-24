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

  it('parses Anki-style parenthetical ruby while preserving particles and okurigana', () => {
    expect(parseRubySegments('予定(よてい)が変(か)わった。')).toEqual([
      {
        kind: 'ruby',
        key: 'ruby-0',
        base: '予定',
        reading: 'よてい',
      },
      {
        kind: 'text',
        key: 'prefix-7',
        text: 'が',
      },
      {
        kind: 'ruby',
        key: 'ruby-7',
        base: '変',
        reading: 'か',
      },
      {
        kind: 'text',
        key: 'text-12',
        text: 'わった。',
      },
    ]);
  });

  it('leaves non-reading parentheses as plain text', () => {
    expect(parseRubySegments('予定(plan)が変(か)わった。')).toEqual([
      {
        kind: 'text',
        key: 'text-0',
        text: '予定(plan)',
      },
      {
        kind: 'text',
        key: 'prefix-8',
        text: 'が',
      },
      {
        kind: 'ruby',
        key: 'ruby-8',
        base: '変',
        reading: 'か',
      },
      {
        kind: 'text',
        key: 'text-13',
        text: 'わった。',
      },
    ]);
  });

  it('does not convert kana-only parentheticals to ruby', () => {
    expect(parseRubySegments('かな(かな)だけ')).toEqual([
      {
        kind: 'text',
        key: 'text-0',
        text: 'かな(かな)だけ',
      },
    ]);
  });
});
