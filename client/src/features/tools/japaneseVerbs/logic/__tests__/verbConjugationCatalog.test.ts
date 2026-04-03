import { describe, expect, it } from 'vitest';

import { buildVerbConjugationCatalog } from '../verbConjugation';

describe('buildVerbConjugationCatalog', () => {
  const catalog = buildVerbConjugationCatalog();

  it('produces a non-empty array of catalog entries', () => {
    expect(catalog.length).toBeGreaterThan(0);
  });

  it('produces entries with all required fields', () => {
    catalog.forEach((entry) => {
      expect(entry).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          verbId: expect.any(String),
          conjugationId: expect.any(String),
          text: expect.any(String),
          kanaText: expect.any(String),
          relativePath: expect.any(String),
        })
      );
    });
  });

  it('builds id from verbId and conjugationId', () => {
    catalog.forEach((entry) => {
      expect(entry.id).toBe(`${entry.verbId}_${entry.conjugationId}`);
    });
  });

  it('builds relativePath from verbId and conjugationId', () => {
    catalog.forEach((entry) => {
      expect(entry.relativePath).toBe(`${entry.verbId}/${entry.conjugationId}.mp3`);
    });
  });

  it('has no duplicate ids', () => {
    const ids = catalog.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('skips invalid conjugation combinations (fewer entries than verb × conjugation count)', () => {
    // There are verbs where certain conjugations return null (e.g., Group 1 potential-colloquial)
    // So the catalog should have fewer entries than verb count × conjugation count
    // With ~42 verbs and 9 conjugations, max would be 378 but some are skipped
    expect(catalog.length).toBeLessThan(378);
    expect(catalog.length).toBeGreaterThan(200);
  });

  it('contains non-empty text and kanaText for every entry', () => {
    catalog.forEach((entry) => {
      expect(entry.text.length).toBeGreaterThan(0);
      expect(entry.kanaText.length).toBeGreaterThan(0);
    });
  });
});
