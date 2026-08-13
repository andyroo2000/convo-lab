import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { User } from '../../types';
import useEffectiveUser from '../useEffectiveUser';

const authState = vi.hoisted(() => ({
  user: {
    id: 'admin-user',
    name: 'Admin',
    email: 'admin@example.com',
    role: 'admin',
  } as User,
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: authState.user }),
}));

type DeferredResponse = {
  promise: Promise<Response>;
  resolve: (response: Response) => void;
  reject: (error: unknown) => void;
};

function deferredResponse(): DeferredResponse {
  let resolve!: (response: Response) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<Response>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function userResponse(id: string, name: string): Response {
  return {
    ok: true,
    json: async () => ({ id, name, email: `${id}@example.com`, role: 'user' }),
  } as Response;
}

const Consumer = () => {
  const navigate = useNavigate();
  const { effectiveUser, effectiveUserId, isImpersonating, loading, status, retry } =
    useEffectiveUser();

  return (
    <>
      <div data-testid="layout-identity">{effectiveUser?.id ?? 'none'}</div>
      <div data-testid="draft-intent-owner">{effectiveUser?.id ?? 'none'}</div>
      <div data-testid="effective-user-id">{effectiveUserId ?? 'none'}</div>
      <div data-testid="impersonating">{String(isImpersonating)}</div>
      <div data-testid="loading">{String(loading)}</div>
      <div data-testid="status">{status}</div>
      <button type="button" onClick={() => navigate('/app/create?viewAs=user-b')}>
        View B
      </button>
      <button type="button" onClick={() => navigate('/app/create')}>
        View self
      </button>
      <button type="button" onClick={() => retry()}>
        Retry
      </button>
    </>
  );
};

function renderConsumer({ count = 1, route = '/app/create?viewAs=user-a' } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        {Array.from({ length: count }, (_, index) => (
          <Consumer key={index} />
        ))}
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('useEffectiveUser request ownership', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    authState.user = {
      id: 'admin-user',
      name: 'Admin',
      email: 'admin@example.com',
      role: 'admin',
    } as User;
  });

  it('returns the authenticated user ID as ready without fetching outside impersonation', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    renderConsumer({ route: '/app/create' });

    expect(screen.getByTestId('effective-user-id')).toHaveTextContent('admin-user');
    expect(screen.getByTestId('status')).toHaveTextContent('ready');
    expect(screen.getByTestId('loading')).toHaveTextContent('false');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('shares one impersonated-user request across multiple consumers', async () => {
    const request = deferredResponse();
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockReturnValue(request.promise);

    renderConsumer({ count: 2 });

    expect(screen.getAllByTestId('status')).toHaveLength(2);
    expect(screen.getAllByTestId('status')[0]).toHaveTextContent('loading');
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    await act(async () => request.resolve(userResponse('user-a', 'User A')));
    await waitFor(() =>
      expect(screen.getAllByTestId('effective-user-id')[0]).toHaveTextContent('user-a')
    );
    expect(screen.getAllByTestId('status')[0]).toHaveTextContent('ready');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('does not expose A to Layout or the StudyCreate intent owner while B is loading', async () => {
    const requestA = deferredResponse();
    const requestB = deferredResponse();
    vi.spyOn(globalThis, 'fetch')
      .mockImplementationOnce(() => requestA.promise)
      .mockImplementationOnce(() => requestB.promise);

    renderConsumer();
    await act(async () => requestA.resolve(userResponse('user-a', 'User A')));
    await waitFor(() =>
      expect(screen.getByTestId('draft-intent-owner')).toHaveTextContent('user-a')
    );

    fireEvent.click(screen.getByRole('button', { name: 'View B' }));
    expect(screen.getByTestId('layout-identity')).toHaveTextContent('none');
    expect(screen.getByTestId('draft-intent-owner')).toHaveTextContent('none');
    expect(screen.getByTestId('impersonating')).toHaveTextContent('true');
    expect(screen.getByTestId('loading')).toHaveTextContent('true');
    expect(screen.getByTestId('status')).toHaveTextContent('loading');

    await act(async () => requestB.resolve(userResponse('user-b', 'User B')));
    await waitFor(() => expect(screen.getByTestId('layout-identity')).toHaveTextContent('user-b'));
    expect(screen.getByTestId('draft-intent-owner')).toHaveTextContent('user-b');
  });

  it('ignores stale success and finally-equivalent completion after A to B to self', async () => {
    const requestA = deferredResponse();
    const requestB = deferredResponse();
    vi.spyOn(globalThis, 'fetch')
      .mockImplementationOnce(() => requestA.promise)
      .mockImplementationOnce(() => requestB.promise);

    renderConsumer();
    fireEvent.click(screen.getByRole('button', { name: 'View B' }));
    fireEvent.click(screen.getByRole('button', { name: 'View self' }));

    await waitFor(() => {
      expect((vi.mocked(fetch).mock.calls[0][1] as RequestInit).signal?.aborted).toBe(true);
      expect((vi.mocked(fetch).mock.calls[1][1] as RequestInit).signal?.aborted).toBe(true);
    });

    expect(screen.getByTestId('layout-identity')).toHaveTextContent('admin-user');
    expect(screen.getByTestId('draft-intent-owner')).toHaveTextContent('admin-user');
    expect(screen.getByTestId('impersonating')).toHaveTextContent('false');
    expect(screen.getByTestId('loading')).toHaveTextContent('false');
    expect(screen.getByTestId('status')).toHaveTextContent('ready');

    await act(async () => {
      requestB.resolve(userResponse('user-b', 'User B'));
      requestA.resolve(userResponse('user-a', 'User A'));
      await Promise.all([requestA.promise, requestB.promise]);
    });

    expect(screen.getByTestId('layout-identity')).toHaveTextContent('admin-user');
    expect(screen.getByTestId('draft-intent-owner')).toHaveTextContent('admin-user');
    expect(screen.getByTestId('loading')).toHaveTextContent('false');
  });

  it('ignores stale errors and rejects non-OK current responses without reviving another owner', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const requestA = deferredResponse();
    const requestB = deferredResponse();
    vi.spyOn(globalThis, 'fetch')
      .mockImplementationOnce(() => requestA.promise)
      .mockImplementationOnce(() => requestB.promise);

    renderConsumer();
    fireEvent.click(screen.getByRole('button', { name: 'View B' }));

    await act(async () => {
      requestA.reject(new Error('stale A failure'));
      requestB.resolve({
        ok: false,
        status: 500,
        json: async () => ({ id: 'server-body' }),
      } as Response);
      await Promise.allSettled([requestA.promise, requestB.promise]);
    });

    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
    expect(screen.getByTestId('layout-identity')).toHaveTextContent('none');
    expect(screen.getByTestId('draft-intent-owner')).toHaveTextContent('none');
    expect(screen.getByTestId('impersonating')).toHaveTextContent('true');
    expect(screen.getByTestId('status')).toHaveTextContent('error');
    expect(consoleError).toHaveBeenCalledTimes(1);
  });

  it('recovers from an error when the current impersonated-user request is retried', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({ ok: false, status: 500 } as Response)
      .mockResolvedValueOnce(userResponse('user-a', 'Recovered User A'));

    renderConsumer();

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('error'));
    expect(screen.getByTestId('effective-user-id')).toHaveTextContent('none');

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('ready'));
    expect(screen.getByTestId('effective-user-id')).toHaveTextContent('user-a');
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('rejects a successful response whose identity does not match the requested owner', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(userResponse('different-user', 'Wrong User'));

    renderConsumer();

    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
    expect(screen.getByTestId('layout-identity')).toHaveTextContent('none');
    expect(screen.getByTestId('draft-intent-owner')).toHaveTextContent('none');
    expect(consoleError).toHaveBeenCalledTimes(1);
  });

  it('does not expose a resolved identity to a different authenticated admin', async () => {
    const requestForFirstAdmin = deferredResponse();
    const requestForSecondAdmin = deferredResponse();
    vi.spyOn(globalThis, 'fetch')
      .mockImplementationOnce(() => requestForFirstAdmin.promise)
      .mockImplementationOnce(() => requestForSecondAdmin.promise);

    const view = renderConsumer();
    await act(async () =>
      requestForFirstAdmin.resolve(userResponse('user-a', 'User A for first admin'))
    );
    await waitFor(() =>
      expect(screen.getByTestId('draft-intent-owner')).toHaveTextContent('user-a')
    );

    authState.user = {
      id: 'second-admin',
      name: 'Second Admin',
      email: 'second-admin@example.com',
      role: 'admin',
    } as User;
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    view.rerender(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/app/create?viewAs=user-a']}>
          <Consumer />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(screen.getByTestId('layout-identity')).toHaveTextContent('none');
    expect(screen.getByTestId('draft-intent-owner')).toHaveTextContent('none');
    expect(screen.getByTestId('loading')).toHaveTextContent('true');

    await act(async () =>
      requestForSecondAdmin.resolve(userResponse('user-a', 'User A for second admin'))
    );
    await waitFor(() =>
      expect(screen.getByTestId('draft-intent-owner')).toHaveTextContent('user-a')
    );
  });
});
