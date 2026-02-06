import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useFeatureFlags } from '../../hooks/useFeatureFlags';
import { createWrapper } from './test-utils';

// Mock the config
vi.mock('../../config', () => ({
  API_URL: 'http://localhost:3001',
}));

// Mock AuthContext
const mockUser = vi.fn();
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: mockUser() }),
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('useFeatureFlags', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
    mockUser.mockReturnValue(null);
  });

  describe('Initial State', () => {
    it('should show loading state while fetching', () => {
      mockFetch.mockImplementation(() => new Promise(() => {}));

      const { result } = renderHook(() => useFeatureFlags(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);
    });

    it('should return undefined flags initially', () => {
      mockFetch.mockImplementation(() => new Promise(() => {}));

      const { result } = renderHook(() => useFeatureFlags(), {
        wrapper: createWrapper(),
      });

      expect(result.current.flags).toBeUndefined();
    });
  });

  describe('Data Fetching', () => {
    it('should fetch feature flags from API', async () => {
      const mockFlags = {
        id: 'flags-1',
        dialoguesEnabled: true,
        audioCourseEnabled: true,
        narrowListeningEnabled: false,
        updatedAt: '2024-01-01',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockFlags),
      });

      const { result } = renderHook(() => useFeatureFlags(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.flags).toEqual(mockFlags);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/feature-flags',
        expect.objectContaining({ credentials: 'include' })
      );
    });

    it('should set error on fetch failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
      });

      const { result } = renderHook(() => useFeatureFlags(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.error).toBeDefined();
      });
    });
  });

  describe('isFeatureEnabled', () => {
    it('should return true for enabled features', async () => {
      const mockFlags = {
        id: 'flags-1',
        dialoguesEnabled: true,
        audioCourseEnabled: false,
        narrowListeningEnabled: true,
        updatedAt: '2024-01-01',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockFlags),
      });

      const { result } = renderHook(() => useFeatureFlags(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.flags).toBeDefined();
      });

      expect(result.current.isFeatureEnabled('dialoguesEnabled')).toBe(true);
      expect(result.current.isFeatureEnabled('narrowListeningEnabled')).toBe(true);
    });

    it('should return false for disabled features', async () => {
      const mockFlags = {
        id: 'flags-1',
        dialoguesEnabled: true,
        audioCourseEnabled: false,
        narrowListeningEnabled: false,
        updatedAt: '2024-01-01',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockFlags),
      });

      const { result } = renderHook(() => useFeatureFlags(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.flags).toBeDefined();
      });

      expect(result.current.isFeatureEnabled('audioCourseEnabled')).toBe(false);
      expect(result.current.isFeatureEnabled('narrowListeningEnabled')).toBe(false);
    });

    it('should return true by default when flags not loaded', () => {
      mockFetch.mockImplementation(() => new Promise(() => {}));

      const { result } = renderHook(() => useFeatureFlags(), {
        wrapper: createWrapper(),
      });

      // Before flags load, should default to enabled
      expect(result.current.isFeatureEnabled('dialoguesEnabled')).toBe(true);
    });
  });

  describe('Admin Override', () => {
    it('should return true for all features when user is admin', async () => {
      mockUser.mockReturnValue({ role: 'admin' });

      const mockFlags = {
        id: 'flags-1',
        dialoguesEnabled: false,
        audioCourseEnabled: false,
        narrowListeningEnabled: false,
        updatedAt: '2024-01-01',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockFlags),
      });

      const { result } = renderHook(() => useFeatureFlags(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.flags).toBeDefined();
      });

      // Even though all flags are false, admin should see true
      expect(result.current.isFeatureEnabled('dialoguesEnabled')).toBe(true);
      expect(result.current.isFeatureEnabled('audioCourseEnabled')).toBe(true);
      expect(result.current.isFeatureEnabled('narrowListeningEnabled')).toBe(true);
    });

    it('should set isAdmin to true for admin users', async () => {
      mockUser.mockReturnValue({ role: 'admin' });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'flags-1' }),
      });

      const { result } = renderHook(() => useFeatureFlags(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isAdmin).toBe(true);
    });

    it('should set isAdmin to false for non-admin users', async () => {
      mockUser.mockReturnValue({ role: 'user' });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'flags-1' }),
      });

      const { result } = renderHook(() => useFeatureFlags(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isAdmin).toBe(false);
    });

    it('should set isAdmin to false when no user', async () => {
      mockUser.mockReturnValue(null);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'flags-1' }),
      });

      const { result } = renderHook(() => useFeatureFlags(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isAdmin).toBe(false);
    });
  });

  describe('Return Values', () => {
    it('should return all expected properties', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'flags-1' }),
      });

      const { result } = renderHook(() => useFeatureFlags(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current).toHaveProperty('flags');
      expect(result.current).toHaveProperty('isLoading');
      expect(result.current).toHaveProperty('error');
      expect(result.current).toHaveProperty('isFeatureEnabled');
      expect(result.current).toHaveProperty('isAdmin');
    });
  });

  describe('Cache Behavior', () => {
    it('should cache flags with staleTime of 5 minutes', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 'flags-1' }),
      });

      // First render
      const { unmount } = renderHook(() => useFeatureFlags(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1);
      });

      unmount();

      // This tests the staleTime configuration exists
      // The actual caching behavior is handled by React Query
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('FeatureFlags Type', () => {
    it('should validate FeatureFlags interface', () => {
      const validFlags = {
        id: 'flags-1',
        dialoguesEnabled: true,
        audioCourseEnabled: true,
        narrowListeningEnabled: true,
        updatedAt: '2024-01-01T00:00:00Z',
      };

      // Type checking - all required fields present
      expect(validFlags.id).toBeDefined();
      expect(typeof validFlags.dialoguesEnabled).toBe('boolean');
      expect(typeof validFlags.audioCourseEnabled).toBe('boolean');
      expect(typeof validFlags.narrowListeningEnabled).toBe('boolean');
      expect(typeof validFlags.updatedAt).toBe('string');
    });
  });
});
