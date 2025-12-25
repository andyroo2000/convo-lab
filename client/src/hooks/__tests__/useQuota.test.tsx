import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useQuota } from '../useQuota';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('useQuota', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch quota on mount', async () => {
    const mockQuotaData = {
      unlimited: false,
      quota: { used: 10, limit: 20, remaining: 10, resetsAt: '2025-12-16T00:00:00Z' },
      cooldown: { active: false, remainingSeconds: 0 },
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockQuotaData,
    });

    const { result } = renderHook(() => useQuota());

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.quotaInfo).toEqual(mockQuotaData);
    expect(result.current.error).toBeNull();
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/me/quota'),
      expect.objectContaining({
        credentials: 'include',
      })
    );
  });

  it('should set loading=true initially', () => {
    mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves

    const { result } = renderHook(() => useQuota());

    expect(result.current.loading).toBe(true);
    expect(result.current.quotaInfo).toBeNull();
  });

  it('should set quotaInfo on successful fetch', async () => {
    const mockQuotaData = {
      unlimited: true,
      quota: null,
      cooldown: { active: false, remainingSeconds: 0 },
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockQuotaData,
    });

    const { result } = renderHook(() => useQuota());

    await waitFor(() => {
      expect(result.current.quotaInfo).toEqual(mockQuotaData);
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should set error on failed fetch', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Unauthorized' }),
    });

    const { result } = renderHook(() => useQuota());

    await waitFor(() => {
      expect(result.current.error).toBe('Failed to fetch quota');
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.quotaInfo).toBeNull();
  });

  it('should handle fetch exception', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useQuota());

    await waitFor(() => {
      expect(result.current.error).toBe('Network error');
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.quotaInfo).toBeNull();
  });

  it('should provide refetchQuota function', async () => {
    const mockQuotaData1 = {
      unlimited: false,
      quota: { used: 10, limit: 20, remaining: 10, resetsAt: '2025-12-16T00:00:00Z' },
      cooldown: { active: false, remainingSeconds: 0 },
    };

    const mockQuotaData2 = {
      unlimited: false,
      quota: { used: 11, limit: 20, remaining: 9, resetsAt: '2025-12-16T00:00:00Z' },
      cooldown: { active: true, remainingSeconds: 25 },
    };

    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => mockQuotaData1 })
      .mockResolvedValueOnce({ ok: true, json: async () => mockQuotaData2 });

    const { result } = renderHook(() => useQuota());

    await waitFor(() => {
      expect(result.current.quotaInfo).toEqual(mockQuotaData1);
    });

    // Refetch
    await result.current.refetchQuota();

    await waitFor(() => {
      expect(result.current.quotaInfo).toEqual(mockQuotaData2);
    });

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('should include credentials in fetch request', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        unlimited: true,
        quota: null,
        cooldown: { active: false, remainingSeconds: 0 },
      }),
    });

    renderHook(() => useQuota());

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          credentials: 'include',
        })
      );
    });
  });

  it('should clear error on successful refetch after error', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false }).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        unlimited: true,
        quota: null,
        cooldown: { active: false, remainingSeconds: 0 },
      }),
    });

    const { result } = renderHook(() => useQuota());

    await waitFor(() => {
      expect(result.current.error).toBe('Failed to fetch quota');
    });

    await result.current.refetchQuota();

    await waitFor(() => {
      expect(result.current.error).toBeNull();
      expect(result.current.quotaInfo).not.toBeNull();
    });
  });
});
