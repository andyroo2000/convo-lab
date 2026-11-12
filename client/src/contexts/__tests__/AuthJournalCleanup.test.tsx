import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from '../AuthContext';
import { fetchWithCsrf } from '../../lib/csrf';

vi.mock('../../lib/csrf', () => ({ fetchWithCsrf: vi.fn() }));
vi.mock('../../lib/audioCache', () => ({ clearAudioCache: vi.fn().mockResolvedValue(undefined) }));

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});
afterEach(() => vi.unstubAllGlobals());

it.each([true, false])(
  'removes device writing only after confirmed account deletion: %s',
  async (confirmed) => {
    const user = { id: '1', email: 'test@example.com', name: 'Test' };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => user }));
    vi.mocked(fetchWithCsrf).mockResolvedValue({
      ok: confirmed,
      json: async () => ({ message: 'Rejected' }),
    } as Response);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>
        <AuthProvider>{children}</AuthProvider>
      </QueryClientProvider>
    );
    const { result } = renderHook(useAuth, { wrapper });
    await waitFor(() => expect(result.current.user?.id).toBe('1'));
    const key = 'convolab:journal:v1:1:entry';
    localStorage.setItem(key, 'private writing');
    await act(async () => {
      try {
        await result.current.deleteAccount('password');
      } catch {
        expect(confirmed).toBe(false);
      }
    });
    expect(localStorage.getItem(key)).toBe(confirmed ? null : 'private writing');
    expect(result.current.user).toEqual(confirmed ? null : user);
  }
);
