import { describe, expect, it } from 'vitest';

import {
  conjugateVerb,
  createVerbPracticeCard,
  DEFAULT_CONJUGATION_IDS,
  DEFAULT_JLPT_LEVELS,
  DEFAULT_VERB_GROUPS,
  sanitizeSelectedConjugationIds,
  sanitizeSelectedJlptLevels,
  sanitizeSelectedVerbGroups,
  toggleSelection,
  type VerbConjugationId,
  type VerbGroup,
} from '../verbConjugation';
import { VERB_DATASET } from '../verbDataset';

const byId = (id: string) => {
  const found = VERB_DATASET.find((entry) => entry.id === id);
  if (!found) {
    throw new Error(`Missing fixture verb: ${id}`);
  }
  return found;
};

describe('verbConjugation', () => {
  it('falls back to defaults for invalid filter selections', () => {
    expect(sanitizeSelectedJlptLevels([])).toEqual(DEFAULT_JLPT_LEVELS);
    expect(sanitizeSelectedJlptLevels(['N3'])).toEqual(DEFAULT_JLPT_LEVELS);

    expect(sanitizeSelectedVerbGroups([])).toEqual(DEFAULT_VERB_GROUPS);
    expect(sanitizeSelectedVerbGroups(['4'])).toEqual(DEFAULT_VERB_GROUPS);

    expect(sanitizeSelectedConjugationIds([])).toEqual(DEFAULT_CONJUGATION_IDS);
    expect(sanitizeSelectedConjugationIds(['unknown'])).toEqual(DEFAULT_CONJUGATION_IDS);
  });

  it('does not allow deselecting the final active filter', () => {
    expect(toggleSelection<VerbGroup>(['2'], '2')).toEqual(['2']);
    expect(toggleSelection<VerbConjugationId>(['te-form'], 'te-form')).toEqual(['te-form']);
  });

  it('conjugates regular group 1 verbs', () => {
    const nomu = byId('nomu');
    expect(conjugateVerb(nomu, 'te-form')?.answer).toEqual({
      script: '飲んで',
      reading: 'のんで',
    });
    expect(conjugateVerb(nomu, 'present-polite')?.answer).toEqual({
      script: '飲みます',
      reading: 'のみます',
    });
  });

  it('handles 行く as an irregular te/past exception', () => {
    const iku = byId('iku');
    expect(conjugateVerb(iku, 'te-form')?.answer).toEqual({
      script: '行って',
      reading: 'いって',
    });
    expect(conjugateVerb(iku, 'past-casual')?.answer).toEqual({
      script: '行った',
      reading: 'いった',
    });
  });

  it('provides colloquial potential plus textbook reference for group 2 verbs', () => {
    const miru = byId('miru');
    const result = conjugateVerb(miru, 'potential-colloquial');

    expect(result?.answer).toEqual({
      script: '見れる',
      reading: 'みれる',
    });
    expect(result?.referenceAnswer).toEqual({
      script: '見られる',
      reading: 'みられる',
    });
  });

  it('handles 来る potential colloquial and textbook forms', () => {
    const kuru = byId('kuru');
    const colloquial = conjugateVerb(kuru, 'potential-colloquial');
    const textbook = conjugateVerb(kuru, 'potential');

    expect(colloquial?.answer).toEqual({
      script: '来れる',
      reading: 'これる',
    });
    expect(colloquial?.referenceAnswer).toEqual({
      script: '来られる',
      reading: 'こられる',
    });
    expect(textbook?.answer).toEqual({
      script: '来られる',
      reading: 'こられる',
    });
  });

  it('does not generate colloquial potential cards where no contraction exists', () => {
    expect(conjugateVerb(byId('suru'), 'potential-colloquial')).toBeNull();

    const card = createVerbPracticeCard(['N5', 'N4'], ['1'], ['potential-colloquial']);
    expect(card).toBeNull();
  });

  it('creates cards that respect selected filters', () => {
    const card = createVerbPracticeCard(['N4'], ['2'], ['potential-colloquial']);

    expect(card).not.toBeNull();
    expect(card?.verb.jlptLevel).toBe('N4');
    expect(card?.verb.group).toBe('2');
    expect(card?.conjugation.id).toBe('potential-colloquial');
    expect(card?.referenceAnswer).toBeDefined();
  });
});
