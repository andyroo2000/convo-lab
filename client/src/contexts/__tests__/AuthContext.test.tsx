import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import { AuthProvider, useAuth } from '../AuthContext';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Wrapper component for hooks
const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>;

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no session
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Not authenticated' }),
    });
  });

  describe('useAuth hook', () => {
    it('should throw error when used outside AuthProvider', () => {
      // Suppress console.error for this test
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderHook(() => useAuth());
      }).toThrow('useAuth must be used within an AuthProvider');

      consoleSpy.mockRestore();
    });

    it('should provide initial state with no user', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.user).toBe(null);
    });

    it('should load existing user on mount', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockUser,
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.user).toEqual(mockUser);
    });
  });

  describe('login', () => {
    it('should set user on successful login', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
      };

      // First call: checkAuth (no session)
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Not authenticated' }),
      });

      // Second call: login
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockUser,
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.login('test@example.com', 'password');
      });

      expect(result.current.user).toEqual(mockUser);
    });

    it('should throw error on failed login', async () => {
      // First call: checkAuth
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Not authenticated' }),
      });

      // Second call: login fails
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: 'Invalid credentials' }),
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await expect(
        act(async () => {
          await result.current.login('test@example.com', 'wrongpassword');
        })
      ).rejects.toThrow('Invalid credentials');
    });
  });

  describe('logout', () => {
    it('should clear user on logout', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
      };

      // First call: checkAuth (has session)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockUser,
      });

      // Second call: logout
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Logged out' }),
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.user).toEqual(mockUser);
      });

      await act(async () => {
        await result.current.logout();
      });

      expect(result.current.user).toBe(null);
    });
  });

  describe('signup', () => {
    it('should set user on successful signup', async () => {
      const mockUser = {
        id: '1',
        email: 'new@example.com',
        name: 'New User',
        role: 'user',
      };

      // First call: checkAuth
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Not authenticated' }),
      });

      // Second call: signup
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockUser,
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.signup('new@example.com', 'password', 'New User', 'INVITE123');
      });

      expect(result.current.user).toEqual(mockUser);
    });
  });

  describe('updateUser', () => {
    it('should update user data', async () => {
      const initialUser = {
        id: '1',
        email: 'test@example.com',
        name: 'Test User',
        displayName: null,
        role: 'user',
      };

      const updatedUser = {
        ...initialUser,
        displayName: 'New Display Name',
      };

      // First call: checkAuth
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => initialUser,
      });

      // Second call: updateUser
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => updatedUser,
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.user).toEqual(initialUser);
      });

      await act(async () => {
        await result.current.updateUser({ displayName: 'New Display Name' });
      });

      expect(result.current.user).toEqual(updatedUser);
    });
  });

  describe('deleteAccount', () => {
    it('should clear user on account deletion', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
      };

      // First call: checkAuth
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockUser,
      });

      // Second call: delete
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Account deleted' }),
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.user).toEqual(mockUser);
      });

      await act(async () => {
        await result.current.deleteAccount();
      });

      expect(result.current.user).toBe(null);
    });
  });

  describe('changePassword', () => {
    it('should change password successfully', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
      };

      // First call: checkAuth
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockUser,
      });

      // Second call: changePassword
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Password changed' }),
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.user).toEqual(mockUser);
      });

      // Should not throw
      await act(async () => {
        await result.current.changePassword('oldPassword', 'newPassword');
      });

      // User should still be logged in
      expect(result.current.user).toEqual(mockUser);
    });

    it('should throw error on failed password change', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
      };

      // First call: checkAuth
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockUser,
      });

      // Second call: changePassword fails
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: { message: 'Current password is incorrect' } }),
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.user).toEqual(mockUser);
      });

      await expect(
        act(async () => {
          await result.current.changePassword('wrongPassword', 'newPassword');
        })
      ).rejects.toThrow('Current password is incorrect');
    });
  });
});
