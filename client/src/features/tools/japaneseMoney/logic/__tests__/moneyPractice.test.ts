import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createMoneyPracticeCard,
  createMoneyPracticeCardFromTiers,
  DEFAULT_MONEY_TIER_ID,
  getMoneyTierById,
} from '../moneyPractice';

describe('moneyPractice', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps a single line item equal to total amount for the default small tier', () => {
    const card = createMoneyPracticeCard(DEFAULT_MONEY_TIER_ID);

    expect(card.lineItems).toHaveLength(1);
    expect(card.lineItems[0]?.amount).toBe(card.amount);
  });

  it('creates amounts inside the selected tier bounds', () => {
    const card = createMoneyPracticeCard('lt_100k');

    expect(card.amount).toBeGreaterThanOrEqual(10_000);
    expect(card.amount).toBeLessThan(100_000);
    expect(card.tierId).toBe('lt_100k');
  });

  it('ensures line items always add up to the total amount', () => {
    const card = createMoneyPracticeCard('lt_10m');
    const lineItemTotal = card.lineItems.reduce((sum, lineItem) => sum + lineItem.amount, 0);

    expect(lineItemTotal).toBe(card.amount);
    expect(card.lineItems.every((lineItem) => lineItem.amount > 0)).toBe(true);
  });

  it('falls back to the default tier when tier list is empty', () => {
    const card = createMoneyPracticeCardFromTiers([]);
    expect(card.tierId).toBe(DEFAULT_MONEY_TIER_ID);
  });

  it('falls back to the default tier when tier list has only invalid values', () => {
    const card = createMoneyPracticeCardFromTiers(['not_a_real_tier' as never]);
    expect(card.tierId).toBe(DEFAULT_MONEY_TIER_ID);
  });

  it('throws when requesting an unknown tier id', () => {
    expect(() => getMoneyTierById('not_a_real_tier' as never)).toThrow(
      'Unsupported money tier id: not_a_real_tier'
    );
  });

  it('de-duplicates tier ids and still returns a valid card', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const card = createMoneyPracticeCardFromTiers(['lt_10k', 'lt_10k']);
    expect(card.tierId).toBe('lt_10k');
  });

  it('ignores invalid tiers when at least one valid tier is provided', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const card = createMoneyPracticeCardFromTiers(['lt_1m', 'not_a_real_tier' as never, 'lt_1m']);

    expect(card.tierId).toBe('lt_1m');
  });
});
