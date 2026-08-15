import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createWrapper } from '../../__tests__/hooks/test-utils';
import { useWeeklyStudyRecap } from '../useWeeklyStudyRecap';

const { fetchWithCsrfMock } = vi.hoisted(() => ({ fetchWithCsrfMock: vi.fn() }));

vi.mock('../../lib/csrf', () => ({ fetchWithCsrf: fetchWithCsrfMock }));

const recap = { generatedAt: '2026-08-17T12:00:00Z' };

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
