import { act, renderHook, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider, useAuth } from '../AuthContext';
import {
  CSRF_TOKEN_COOKIE_NAME,
  LEARNING_OS_CSRF_TOKEN_HEADER_NAME,
  resetCsrfStateForTests,
} from '../../lib/csrf';

vi.mock('../../config', () => ({
  API_URL: '',
  LEARNING_OS_DIRECT_ACCOUNT_API_ENABLED: true,
  SHOW_ONBOARDING_WELCOME: false,
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>;

const user = {
  id: '1',
  email: 'test@example.com',
  name: 'Test User',
  displayName: null,
  role: 'user',
};

function successfulResponse(body: unknown = {}): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  } as Response;
}

describe('AuthContext with direct Learning OS account API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCsrfStateForTests();
    document.cookie = `${CSRF_TOKEN_COOKIE_NAME}=learning-os-csrf-token`;
  });

  it('loads the current user directly from the compatibility API', async () => {
    mockFetch.mockResolvedValueOnce(successfulResponse(user));

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.user).toEqual(user));
    expect(mockFetch).toHaveBeenCalledWith('/api/convolab/auth/me', {
      credentials: 'include',
    });
  });

  it('updates the profile directly with the compatibility payload', async () => {
    const updatedUser = { ...user, displayName: 'Updated Name' };
    mockFetch
      .mockResolvedValueOnce(successfulResponse(user))
      .mockResolvedValueOnce(successfulResponse())
      .mockResolvedValueOnce(successfulResponse(updatedUser));

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.user).toEqual(user));

    await act(async () => {
      await result.current.updateUser({ displayName: 'Updated Name' });
    });

    expect(mockFetch).toHaveBeenNthCalledWith(2, '/sanctum/csrf-cookie', {
      method: 'GET',
      credentials: 'include',
    });
    expect(mockFetch).toHaveBeenNthCalledWith(
      3,
      '/api/convolab/auth/me',
      expect.objectContaining({
        method: 'PATCH',
        credentials: 'include',
        body: JSON.stringify({ displayName: 'Updated Name' }),
      })
    );
    const headers = new Headers(mockFetch.mock.calls[2]?.[1]?.headers);
    expect(headers.get(LEARNING_OS_CSRF_TOKEN_HEADER_NAME)).toBe('learning-os-csrf-token');
    expect(result.current.user).toEqual(updatedUser);
  });

  it('uses the Learning OS password route and canonical payload', async () => {
    mockFetch
      .mockResolvedValueOnce(successfulResponse(user))
      .mockResolvedValueOnce(successfulResponse())
      .mockResolvedValueOnce(successfulResponse({ message: 'Password changed' }));

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.user).toEqual(user));

    await act(async () => {
      await result.current.changePassword('old-password', 'new-password');
    });

    expect(mockFetch).toHaveBeenNthCalledWith(
      3,
      '/api/convolab/auth/me/password',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({
          current_password: 'old-password',
          password: 'new-password',
          password_confirmation: 'new-password',
        }),
      })
    );
  });

  it('uses the Learning OS deletion payload and clears the user', async () => {
    mockFetch
      .mockResolvedValueOnce(successfulResponse(user))
      .mockResolvedValueOnce(successfulResponse())
      .mockResolvedValueOnce(successfulResponse({ message: 'Account deleted' }));

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.user).toEqual(user));

    await act(async () => {
      await result.current.deleteAccount('current-password');
    });

    expect(mockFetch).toHaveBeenNthCalledWith(
      3,
      '/api/convolab/auth/me',
      expect.objectContaining({
        method: 'DELETE',
        body: JSON.stringify({ current_password: 'current-password' }),
      })
    );
    expect(result.current.user).toBeNull();
  });
});
