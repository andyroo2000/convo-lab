import { describe, expect, it } from 'vitest';

import {
  buildCounterPhraseCatalog,
  createCounterPracticeCard,
  DEFAULT_COUNTER_IDS,
  sanitizeSelectedCounterIds,
  toggleCounterSelection,
} from '../counterPractice';

describe('counterPractice', () => {
  it('falls back to defaults when selected counters are empty or invalid', () => {
    expect(sanitizeSelectedCounterIds([])).toEqual(DEFAULT_COUNTER_IDS);
    expect(sanitizeSelectedCounterIds(['invalid'])).toEqual(DEFAULT_COUNTER_IDS);
  });

  it('keeps only one instance of each valid counter id', () => {
    expect(sanitizeSelectedCounterIds(['mai', 'mai', 'hiki'])).toEqual(['mai', 'hiki']);
  });

  it('does not allow removing the final selected counter', () => {
    expect(toggleCounterSelection(['hon'], 'hon')).toEqual(['hon']);
  });

  it('adds and removes counters from multi-select pool', () => {
    expect(toggleCounterSelection(['mai', 'hon'], 'hiki')).toEqual(['mai', 'hon', 'hiki']);
    expect(toggleCounterSelection(['mai', 'hon'], 'mai')).toEqual(['hon']);
  });

  it('creates cards only from selected counter IDs', () => {
    const ids = new Set<string>();
    for (let index = 0; index < 20; index += 1) {
      ids.add(createCounterPracticeCard(['hiki']).counterId);
    }

    expect(Array.from(ids)).toEqual(['hiki']);
  });

  it('returns ruby-ready answer data', () => {
    const card = createCounterPracticeCard(['mai']);

    expect(card.countScript.length).toBeGreaterThan(0);
    expect(card.countKana.length).toBeGreaterThan(0);
    expect(card.object.script.length).toBeGreaterThan(0);
    expect(card.object.kana.length).toBeGreaterThan(0);
  });

  it('uses kanji counter symbols in revealed script', () => {
    expect(createCounterPracticeCard(['mai']).countScript).toContain('枚');
    expect(createCounterPracticeCard(['hon']).countScript).toContain('本');
    expect(createCounterPracticeCard(['hiki']).countScript).toContain('匹');
    expect(createCounterPracticeCard(['satsu']).countScript).toContain('冊');
    expect(createCounterPracticeCard(['dai']).countScript).toContain('台');
    expect(createCounterPracticeCard(['ko']).countScript).toContain('個');
    expect(createCounterPracticeCard(['nin']).countScript).toContain('人');
    expect(createCounterPracticeCard(['hai']).countScript).toContain('杯');
    expect(createCounterPracticeCard(['chaku']).countScript).toContain('着');
    expect(createCounterPracticeCard(['soku']).countScript).toContain('足');
    expect(createCounterPracticeCard(['wa']).countScript).toContain('羽');
    expect(createCounterPracticeCard(['kai']).countScript).toContain('階');
  });

  it('builds deterministic phrase catalog for pre-rendered audio', () => {
    const entries = buildCounterPhraseCatalog();
    const honPencilSix = entries.find((entry) => entry.id === 'hon_pencil_06');
    const ninPersonOne = entries.find((entry) => entry.id === 'nin_person_01');

    expect(entries).toHaveLength(340);
    expect(honPencilSix).toMatchObject({
      relativePath: 'phrase/hon/pencil/06.mp3',
      text: '鉛筆を六本',
      kanaText: 'えんぴつ を ろっぽん',
    });
    expect(ninPersonOne).toMatchObject({
      relativePath: 'phrase/nin/person/01.mp3',
      text: '人を一人',
      kanaText: 'ひと を ひとり',
    });
  });
});
