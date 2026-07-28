import { describe, expect, it } from 'vitest';

import { masteryReviewAnnouncementKind, normalizeStudyMasteryLevel } from '../studyMastery';

describe('study mastery helpers', () => {
  it('distinguishes stage progress, unchanged reviews, and failures', () => {
    expect(masteryReviewAnnouncementKind('master', 'enlightened', true)).toBe('advanced');
    expect(masteryReviewAnnouncementKind('master', 'master', true)).toBe('remained');
    expect(masteryReviewAnnouncementKind('master', 'apprentice', false)).toBe('failedMoved');
    expect(masteryReviewAnnouncementKind('master', 'master', false)).toBe('failedSameStage');
  });

  it('normalizes unknown API values to a valid fallback', () => {
    expect(normalizeStudyMasteryLevel('unknown')).toBe('apprentice');
    expect(normalizeStudyMasteryLevel('unknown', 'guru')).toBe('guru');
  });
});
