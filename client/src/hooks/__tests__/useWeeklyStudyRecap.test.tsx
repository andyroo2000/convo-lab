import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createWrapper } from '../../__tests__/hooks/test-utils';
import { useWeeklyStudyRecap } from '../useWeeklyStudyRecap';

const { fetchWithCsrfMock } = vi.hoisted(() => ({ fetchWithCsrfMock: vi.fn() }));

vi.mock('../../lib/csrf', () => ({ fetchWithCsrf: fetchWithCsrfMock }));

const recap = {
  generatedAt: '2026-08-17T12:00:00Z',
  week: {
    startsAt: '2026-08-10T04:00:00Z',
    endsAt: '2026-08-17T04:00:00Z',
    totalMs: 7_200_000,
    activeDays: 4,
    bestDay: { date: '2026-08-12', totalMs: 3_600_000 },
    categories: {
      review: 3_600_000,
      listen: 0,
      create: 0,
      immerse: 0,
      conversation: 3_600_000,
      wanikani: 0,
    },
    reviewCount: 120,
    recallRate: 0.94,
    newCardsIntroduced: 20,
  },
  previousWeek: {
    totalMs: 3_600_000,
    activeDays: 3,
    reviewCount: 90,
    recallRate: 0.9,
    newCardsIntroduced: 10,
  },
};

describe('useWeeklyStudyRecap', () => {
  beforeEach(() => fetchWithCsrfMock.mockReset());

  it('loads the last completed week with timezone and Monday week start', async () => {
    fetchWithCsrfMock.mockResolvedValue(new Response(JSON.stringify(recap), { status: 200 }));
    const { result } = renderHook(() => useWeeklyStudyRecap(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.data).toEqual(recap));
    expect(fetchWithCsrfMock).toHaveBeenCalledWith(
      expect.stringMatching(/^\/api\/study\/weekly-recap\?timezone=.+&weekStartsOn=2$/),
      expect.objectContaining({ credentials: 'include' })
    );
  });

  it('exposes a failed request for retry UI', async () => {
    fetchWithCsrfMock.mockResolvedValue(new Response(null, { status: 503 }));
    const { result } = renderHook(() => useWeeklyStudyRecap(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
