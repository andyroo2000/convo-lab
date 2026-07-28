import { describe, expect, it } from 'vitest';

import formatDuration from '../../utils/studyTimeFormat';

describe('formatDuration', () => {
  it('omits the minute suffix for exact-hour durations', () => {
    expect(formatDuration(60 * 60 * 1000)).toBe('1h');
    expect(formatDuration(2 * 60 * 60 * 1000)).toBe('2h');
  });

  it('keeps minutes for partial hours', () => {
    expect(formatDuration(90 * 60 * 1000)).toBe('1h 30m');
    expect(formatDuration(30 * 60 * 1000)).toBe('30m');
  });
});
