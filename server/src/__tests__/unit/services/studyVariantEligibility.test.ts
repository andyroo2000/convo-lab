import { describe, expect, it } from 'vitest';

import { hasRequiredRecentWins } from '../../../services/study/variants/eligibility.js';

describe('study variant eligibility', () => {
  it('requires two recent Good or Easy reviews', () => {
    expect(hasRequiredRecentWins([{ rating: 3 }, { rating: 4 }])).toBe(true);
    expect(hasRequiredRecentWins([{ rating: 4 }, { rating: 2 }, { rating: 3 }])).toBe(true);
    expect(hasRequiredRecentWins([{ rating: 3 }])).toBe(false);
  });

  it('treats the latest Again as the start of a new eligibility window', () => {
    expect(
      hasRequiredRecentWins([{ rating: 3 }, { rating: 1 }, { rating: 4 }, { rating: 3 }])
    ).toBe(false);
    expect(hasRequiredRecentWins([{ rating: 1 }, { rating: 4 }, { rating: 3 }])).toBe(false);
  });
});
