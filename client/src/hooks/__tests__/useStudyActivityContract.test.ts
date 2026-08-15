import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { StudyActivitySessionInput } from '../../types/studyActivity';
import { saveStudyActivitySessions } from '../useStudyActivity';

const { fetchWithCsrfMock } = vi.hoisted(() => ({
  fetchWithCsrfMock: vi.fn(),
}));

vi.mock('../../lib/csrf', () => ({
  fetchWithCsrf: fetchWithCsrfMock,
}));

const input: StudyActivitySessionInput = {
  clientSessionId: '018f22d2-6d38-7000-8000-000000000001',
  category: 'conversation',
  activity: 'conversation',
  source: 'manual',
  startedAt: '2026-08-15T12:00:00.000Z',
  endedAt: '2026-08-15T13:00:00.000Z',
  durationMs: 3_600_000,
};

describe('study activity request contract', () => {
  beforeEach(() => {
    fetchWithCsrfMock.mockReset();
  });

  it('sends web provenance and safely decodes a legacy response without origin', async () => {
    fetchWithCsrfMock.mockResolvedValue(
      new Response(JSON.stringify([input]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const [stored] = await saveStudyActivitySessions([input]);
    const [path, request] = fetchWithCsrfMock.mock.calls[0] as [string, RequestInit];

    expect(path).toBe('/api/study/activity-sessions/batch');
    expect(JSON.parse(String(request.body))).toEqual({
      sessions: [{ ...input, origin: 'web' }],
    });
    expect(stored).toEqual({
      ...input,
      editable: true,
      origin: 'legacy',
      provider: null,
    });
  });

  it('decodes provider provenance returned by the backend', async () => {
    fetchWithCsrfMock.mockResolvedValue(
      new Response(JSON.stringify([{ ...input, source: 'calendar', origin: 'google_calendar' }]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const [stored] = await saveStudyActivitySessions([input]);

    expect(stored.origin).toBe('google_calendar');
    expect(stored.provider).toBe('google_calendar');
    expect(stored.editable).toBe(false);
  });
});
