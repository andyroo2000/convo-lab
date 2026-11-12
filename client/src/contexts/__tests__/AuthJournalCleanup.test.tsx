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
      const deletion = result.current.deleteAccount('password');
      if (confirmed) await expect(deletion).resolves.toBeUndefined();
      else await expect(deletion).rejects.toThrow('Rejected');
    });
    expect(localStorage.getItem(key)).toBe(confirmed ? null : 'private writing');
    expect(result.current.user).toEqual(confirmed ? null : user);
  }
);

it('retries journal cleanup when the session provider mounts', async () => {
  localStorage.setItem('convolab:journal-account-deletion:1', 'pending');
  localStorage.setItem('convolab:journal-answer:1:entry:analysis', 'private answer');
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
  const client = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
  const { result } = renderHook(useAuth, { wrapper });
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(localStorage.getItem('convolab:journal-answer:1:entry:analysis')).toBeNull();
  expect(localStorage.getItem('convolab:journal-account-deletion:1')).toBeNull();
});
