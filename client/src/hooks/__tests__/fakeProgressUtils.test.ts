import { describe, expect, it } from 'vitest';

import calculateFakeProgress from '../fakeProgressUtils';

describe('calculateFakeProgress', () => {
  it('starts at zero before any pending time has elapsed', () => {
    expect(calculateFakeProgress(0, 40_000)).toBe(0);
    expect(calculateFakeProgress(-1, 40_000)).toBe(0);
  });

  it('warms up quickly without jumping past the first quarter', () => {
    expect(calculateFakeProgress(2_000, 40_000)).toBeGreaterThan(0);
    expect(calculateFakeProgress(2_000, 40_000)).toBeLessThan(25);
    expect(calculateFakeProgress(4_000, 40_000)).toBeCloseTo(25);
  });

  it('approaches complete without reaching 100 while still pending', () => {
    expect(calculateFakeProgress(40_000, 40_000)).toBeGreaterThan(90);
    expect(calculateFakeProgress(60_000, 40_000)).toBeLessThan(100);
    expect(calculateFakeProgress(10 * 60_000, 40_000)).toBeLessThan(100);
  });
});
