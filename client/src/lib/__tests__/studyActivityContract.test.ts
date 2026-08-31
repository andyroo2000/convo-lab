import { describe, expect, it } from 'vitest';

import type { StudyActivitySessionInput } from '../../types/studyActivity';
import { decodeStudyActivitySession, encodeStudyActivitySession } from '../studyActivityContract';

const input: StudyActivitySessionInput = {
  clientSessionId: '018f22d2-6d38-7000-8000-000000000001',
  category: 'conversation',
  activity: 'conversation',
  source: 'manual',
  name: 'iTalki lesson',
  startedAt: '2026-08-15T12:00:00.000Z',
  endedAt: '2026-08-15T13:00:00.000Z',
  durationMs: 3_600_000,
};

describe('study activity API contract', () => {
  it.each([undefined, null])(
    'keeps old responses without an origin backward-compatible (%s)',
    (origin) => {
      const session = decodeStudyActivitySession({ ...input, origin });

      expect(session.origin).toBe('legacy');
      expect(session.provider).toBeNull();
      expect(session.editable).toBe(true);
    }
  );

  it.each(['', 'calendar', 'other'])(
    'fails closed while decoding an unknown origin (%s)',
    (origin) => {
      const session = decodeStudyActivitySession({ ...input, origin });

      expect(session.origin).toBe('legacy');
      expect(session.provider).toBeNull();
      expect(session.editable).toBe(false);
    }
  );

  it('does not mistake a legacy calendar-source entry for a Google Calendar import', () => {
    const session = decodeStudyActivitySession({
      ...input,
      source: 'calendar',
    });

    expect(session.origin).toBe('legacy');
    expect(session.provider).toBeNull();
    expect(session.editable).toBe(true);
  });

  it('exposes Google Calendar as explicit read-only provider provenance', () => {
    const session = decodeStudyActivitySession({
      ...input,
      source: 'calendar',
      origin: 'google_calendar',
    });

    expect(session.origin).toBe('google_calendar');
    expect(session.provider).toBe('google_calendar');
    expect(session.editable).toBe(false);
  });

  it.each([
    { origin: 'google_calendar' as const, source: 'calendar' as const },
    { origin: 'wanikani' as const, source: 'manual' as const },
    { origin: 'system' as const, source: 'manual' as const },
    { origin: 'web' as const, source: 'automatic' as const },
  ])('marks $origin/$source records as non-editable', ({ origin, source }) => {
    expect(decodeStudyActivitySession({ ...input, origin, source }).editable).toBe(false);
  });

  it('marks normal iOS and web manual records as editable', () => {
    expect(decodeStudyActivitySession({ ...input, origin: 'ios' }).editable).toBe(true);
    expect(decodeStudyActivitySession({ ...input, origin: 'web' }).editable).toBe(true);
  });

  it('identifies every outbound write as web without leaking derived response fields', () => {
    const storedSession = decodeStudyActivitySession({
      ...input,
      id: '01K2R0T9Q4V8B7RAG4M7C5B0Y3',
      origin: 'google_calendar',
    });

    expect(encodeStudyActivitySession(storedSession)).toEqual({
      id: '01K2R0T9Q4V8B7RAG4M7C5B0Y3',
      clientSessionId: input.clientSessionId,
      activity: input.activity,
      source: input.source,
      name: input.name,
      startedAt: input.startedAt,
      endedAt: input.endedAt,
      durationMs: input.durationMs,
      origin: 'web',
    });
  });

  it('preserves the current payload while adding web origin to new sessions', () => {
    const encoded = encodeStudyActivitySession(input);

    expect(encoded).toEqual({
      clientSessionId: input.clientSessionId,
      activity: input.activity,
      source: input.source,
      name: input.name,
      startedAt: input.startedAt,
      endedAt: input.endedAt,
      durationMs: input.durationMs,
      origin: 'web',
    });
  });
});
