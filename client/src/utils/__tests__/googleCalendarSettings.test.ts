import { describe, expect, it } from 'vitest';

import {
  canonicalizeGoogleCalendarSettings,
  GOOGLE_CALENDAR_SETTINGS_LIMITS,
} from '../googleCalendarSettings';

describe('canonicalizeGoogleCalendarSettings', () => {
  it('trims and locale-independently deduplicates while preserving first term spelling', () => {
    expect(
      canonicalizeGoogleCalendarSettings({
        calendarIds: [' primary ', 'primary', 'PRIMARY'],
        titleMatchTerms: [' iTalki ', 'ITALKI', '日本語', '日本語 '],
        syncEnabled: true,
      })
    ).toEqual({
      settings: {
        calendarIds: ['primary', 'PRIMARY'],
        titleMatchTerms: ['iTalki', '日本語'],
        syncEnabled: true,
      },
      errors: [],
    });
  });

  it('rejects blank members and requires both lists and an explicit boolean', () => {
    const result = canonicalizeGoogleCalendarSettings({
      calendarIds: ['primary', '   '],
      titleMatchTerms: [],
    });

    expect(result.settings).toBeNull();
    expect(result.errors).toEqual([
      { field: 'calendarIds', code: 'blank' },
      { field: 'titleMatchTerms', code: 'required' },
      { field: 'syncEnabled', code: 'invalid_type' },
    ]);
  });

  it('enforces list limits', () => {
    const result = canonicalizeGoogleCalendarSettings({
      calendarIds: Array.from(
        { length: GOOGLE_CALENDAR_SETTINGS_LIMITS.calendars + 1 },
        (_, index) => `calendar-${index}`
      ),
      titleMatchTerms: Array.from(
        { length: GOOGLE_CALENDAR_SETTINGS_LIMITS.terms + 1 },
        (_, index) => `term-${index}`
      ),
      syncEnabled: false,
    });

    expect(result.errors).toEqual([
      { field: 'calendarIds', code: 'too_many' },
      { field: 'titleMatchTerms', code: 'too_many' },
    ]);
  });

  it('enforces raw list limits before deduplication', () => {
    const result = canonicalizeGoogleCalendarSettings({
      calendarIds: Array(GOOGLE_CALENDAR_SETTINGS_LIMITS.calendars + 1).fill('duplicate'),
      titleMatchTerms: Array(GOOGLE_CALENDAR_SETTINGS_LIMITS.terms + 1).fill('LESSON'),
      syncEnabled: true,
    });

    expect(result.errors).toEqual([
      { field: 'calendarIds', code: 'too_many' },
      { field: 'titleMatchTerms', code: 'too_many' },
    ]);
  });

  it('counts term length in Unicode code points', () => {
    const accepted = '😀'.repeat(GOOGLE_CALENDAR_SETTINGS_LIMITS.termCodePoints);
    const rejected = `${accepted}😀`;

    expect(
      canonicalizeGoogleCalendarSettings({
        calendarIds: ['primary'],
        titleMatchTerms: [accepted],
        syncEnabled: true,
      }).settings?.titleMatchTerms
    ).toEqual([accepted]);
    expect(
      canonicalizeGoogleCalendarSettings({
        calendarIds: ['primary'],
        titleMatchTerms: [rejected],
        syncEnabled: true,
      }).errors
    ).toContainEqual({ field: 'titleMatchTerms', code: 'too_long' });
  });

  it('reports repeated overlong values once per field', () => {
    const result = canonicalizeGoogleCalendarSettings({
      calendarIds: [
        'x'.repeat(GOOGLE_CALENDAR_SETTINGS_LIMITS.calendarIdLength + 1),
        'y'.repeat(GOOGLE_CALENDAR_SETTINGS_LIMITS.calendarIdLength + 1),
      ],
      titleMatchTerms: [
        'x'.repeat(GOOGLE_CALENDAR_SETTINGS_LIMITS.termCodePoints + 1),
        'y'.repeat(GOOGLE_CALENDAR_SETTINGS_LIMITS.termCodePoints + 1),
      ],
      syncEnabled: true,
    });

    expect(result.errors).toEqual([
      { field: 'calendarIds', code: 'too_long' },
      { field: 'titleMatchTerms', code: 'too_long' },
    ]);
  });

  it('rejects invalid collection item types and overlong calendar IDs', () => {
    const result = canonicalizeGoogleCalendarSettings({
      calendarIds: ['x'.repeat(GOOGLE_CALENDAR_SETTINGS_LIMITS.calendarIdLength + 1)],
      titleMatchTerms: ['lesson', 42],
      syncEnabled: true,
    });

    expect(result.errors).toEqual([
      { field: 'calendarIds', code: 'too_long' },
      { field: 'titleMatchTerms', code: 'invalid_type' },
    ]);
  });
});
