import { describe, expect, it } from 'vitest';

import { decodeHtmlEntities, parseRubySegments, stripHtmlToText } from '../studyTextUtils';

describe('studyTextUtils', () => {
  it('keeps cloze blank markers as plain text', () => {
    expect(parseRubySegments('試合に[...]。')).toEqual([
      { kind: 'text', key: 'text-0', text: '試合に[...]。' },
    ]);
  });

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

  it('does not remove a particle that matches the start of the following reading', () => {
    expect(parseRubySegments('虫[むし]は本当[ほんとう]に苦手[にがて]。')).toEqual([
      { kind: 'ruby', key: 'ruby-0', base: '虫', reading: 'むし' },
      { kind: 'text', key: 'prefix-5', text: 'は' },
      { kind: 'ruby', key: 'ruby-5', base: '本当', reading: 'ほんとう' },
      { kind: 'text', key: 'prefix-14', text: 'に' },
      { kind: 'ruby', key: 'ruby-14', base: '苦手', reading: 'にがて' },
      { kind: 'text', key: 'text-22', text: '。' },
    ]);
  });

  it('does not remove a reading mora that matches kana between adjacent ruby annotations', () => {
    expect(parseRubySegments('いい意味[いみ]でも悪[わる]い意味[いみ]でも')).toEqual([
      { kind: 'text', key: 'prefix-0', text: 'いい' },
      { kind: 'ruby', key: 'ruby-0', base: '意味', reading: 'いみ' },
      { kind: 'text', key: 'prefix-8', text: 'でも' },
      { kind: 'ruby', key: 'ruby-8', base: '悪', reading: 'わる' },
      { kind: 'text', key: 'prefix-15', text: 'い' },
      { kind: 'ruby', key: 'ruby-15', base: '意味', reading: 'いみ' },
      { kind: 'text', key: 'text-22', text: 'でも' },
    ]);
  });

  it('keeps an unannotated word before 狭い out of its furigana base', () => {
    expect(parseRubySegments('この道[みち]は少し狭[せま]いです。')).toEqual([
      { kind: 'text', key: 'prefix-0', text: 'この' },
      { kind: 'ruby', key: 'ruby-0', base: '道', reading: 'みち' },
      { kind: 'text', key: 'prefix-7', text: 'は少し' },
      { kind: 'ruby', key: 'ruby-7', base: '狭', reading: 'せま' },
      { kind: 'text', key: 'text-15', text: 'いです。' },
    ]);
  });

  it('keeps internal kana inside a single annotated word', () => {
    expect(parseRubySegments('取り扱い[とりあつかい]')).toEqual([
      { kind: 'ruby', key: 'ruby-0', base: '取り扱', reading: 'とりあつか' },
      { kind: 'text', key: 'suffix-0', text: 'い' },
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
