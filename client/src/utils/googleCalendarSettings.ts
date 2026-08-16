export const GOOGLE_CALENDAR_SETTINGS_LIMITS = {
  calendars: 25,
  calendarIdLength: 1024,
  terms: 50,
  termCodePoints: 100,
} as const;

export interface GoogleCalendarSettings {
  calendarIds: string[];
  titleMatchTerms: string[];
  syncEnabled: boolean;
}

export type GoogleCalendarSettingsField = keyof GoogleCalendarSettings;
export type GoogleCalendarSettingsErrorCode =
  | 'blank'
  | 'invalid_type'
  | 'required'
  | 'server_rejected'
  | 'too_many'
  | 'too_long';

export interface GoogleCalendarSettingsError {
  field: GoogleCalendarSettingsField;
  code: GoogleCalendarSettingsErrorCode;
}

export type GoogleCalendarSettingsResult =
  | { settings: GoogleCalendarSettings; errors: [] }
  | { settings: null; errors: GoogleCalendarSettingsError[] };

const GOOGLE_CALENDAR_EDGE_WHITESPACE = /^[\p{Z}\s]+|[\p{Z}\s]+$/gu;

export function trimGoogleCalendarInput(value: string) {
  return value.replace(GOOGLE_CALENDAR_EDGE_WHITESPACE, '');
}

export function googleCalendarTitleTermKey(value: string) {
  return trimGoogleCalendarInput(value).toLowerCase();
}

function canonicalStrings(
  value: unknown,
  field: Extract<GoogleCalendarSettingsField, 'calendarIds' | 'titleMatchTerms'>,
  maximumItems: number,
  maximumLength: number,
  caseInsensitive: boolean
) {
  const errors: GoogleCalendarSettingsError[] = [];
  if (!Array.isArray(value)) {
    return { values: [], errors: [{ field, code: 'invalid_type' as const }] };
  }
  if (value.length > maximumItems) {
    return { values: [], errors: [{ field, code: 'too_many' as const }] };
  }
  if (value.some((item) => typeof item !== 'string')) {
    return { values: [], errors: [{ field, code: 'invalid_type' as const }] };
  }
  if (value.length === 0) errors.push({ field, code: 'required' });

  const seen = new Set<string>();
  const values: string[] = [];
  value.forEach((raw) => {
    // Match the server's bounded pre-trim scan before running its Unicode whitespace regex.
    if ([...raw].length > maximumLength + 64) {
      if (!errors.some((error) => error.code === 'too_long')) {
        errors.push({ field, code: 'too_long' });
      }
      return;
    }
    const trimmed = trimGoogleCalendarInput(raw);
    if (!trimmed) {
      if (!errors.some((error) => error.code === 'blank')) errors.push({ field, code: 'blank' });
      return;
    }
    const comparison = caseInsensitive ? googleCalendarTitleTermKey(trimmed) : trimmed;
    if (seen.has(comparison)) return;
    seen.add(comparison);
    if ([...trimmed].length > maximumLength) {
      if (!errors.some((error) => error.code === 'too_long')) {
        errors.push({ field, code: 'too_long' });
      }
    } else values.push(trimmed);
  });

  return { values, errors };
}

export function canonicalizeGoogleCalendarSettings(input: {
  calendarIds?: unknown;
  titleMatchTerms?: unknown;
  syncEnabled?: unknown;
}): GoogleCalendarSettingsResult {
  const calendars = canonicalStrings(
    input.calendarIds,
    'calendarIds',
    GOOGLE_CALENDAR_SETTINGS_LIMITS.calendars,
    GOOGLE_CALENDAR_SETTINGS_LIMITS.calendarIdLength,
    false
  );
  const terms = canonicalStrings(
    input.titleMatchTerms,
    'titleMatchTerms',
    GOOGLE_CALENDAR_SETTINGS_LIMITS.terms,
    GOOGLE_CALENDAR_SETTINGS_LIMITS.termCodePoints,
    true
  );
  const errors = [...calendars.errors, ...terms.errors];
  if (typeof input.syncEnabled !== 'boolean') {
    errors.push({ field: 'syncEnabled', code: 'invalid_type' });
  }
  if (errors.length > 0) return { settings: null, errors };

  return {
    settings: {
      calendarIds: calendars.values,
      titleMatchTerms: terms.values,
      syncEnabled: input.syncEnabled as boolean,
    },
    errors: [],
  };
}
