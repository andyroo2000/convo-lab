import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

// Mock the AuthContext
const mockUseAuth = vi.hoisted(() => vi.fn());

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: mockUseAuth,
}));

// Import after mocking
import { useIsDemo } from '../../hooks/useDemo';

describe('useDemo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useIsDemo', () => {
    it('should return true when user role is demo', () => {
      mockUseAuth.mockReturnValue({
        user: { id: '1', email: 'demo@example.com', role: 'demo' },
      });

      const { result } = renderHook(() => useIsDemo());

      expect(result.current).toBe(true);
    });

    it('should return false when user role is not demo', () => {
      mockUseAuth.mockReturnValue({
        user: { id: '1', email: 'user@example.com', role: 'user' },
      });

      const { result } = renderHook(() => useIsDemo());

      expect(result.current).toBe(false);
    });

    it('should return false when user role is admin', () => {
      mockUseAuth.mockReturnValue({
        user: { id: '1', email: 'admin@example.com', role: 'admin' },
      });

      const { result } = renderHook(() => useIsDemo());

      expect(result.current).toBe(false);
    });

    it('should return false when user is null', () => {
      mockUseAuth.mockReturnValue({
        user: null,
      });

      const { result } = renderHook(() => useIsDemo());

      expect(result.current).toBe(false);
    });

    it('should return false when user has no role', () => {
      mockUseAuth.mockReturnValue({
        user: { id: '1', email: 'user@example.com' },
      });

      const { result } = renderHook(() => useIsDemo());

      expect(result.current).toBe(false);
    });
  });
});
