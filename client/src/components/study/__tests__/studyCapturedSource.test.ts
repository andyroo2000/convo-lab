import { describe, expect, it } from 'vitest';
import { getCapturedSource } from '../studyCapturedSource';

describe('captured source notes', () => {
  it.each([
    'https://www.netflix.com/watch/123?trackId=456',
    'https://www.youtube.com/watch?v=abc&t=4',
  ])('recognizes legacy capture notes: %s', (sourceUrl) => {
    expect(getCapturedSource(`Captured from Episode 1 — ${sourceUrl}`)).toEqual({
      text: 'Captured from Episode 1',
    });
  });
  it.each([
    // eslint-disable-next-line no-script-url -- verifies this scheme is rejected as input.
    'javascript:alert(1)',
    'https://www.netflix.com.evil.test/watch/1',
    'https://user@www.netflix.com/watch/1',
  ])('refuses unsafe or lookalike links: %s', (url) => {
    expect(getCapturedSource(`Captured from Episode 1 — ${url}`)).toBeNull();
  });
  it('does not classify ordinary notes as captured dialogue', () => {
    expect(getCapturedSource('<p>Normal note.</p><p>Second note.</p>')).toBeNull();
  });
  it('recognizes title-only capture notes without requiring a link', () => {
    expect(getCapturedSource('Captured from Episode 1')).toEqual({
      text: 'Captured from Episode 1',
    });
    expect(getCapturedSource('Captured from Episode 1: A — B')).toEqual({
      text: 'Captured from Episode 1: A — B',
    });
  });
});
