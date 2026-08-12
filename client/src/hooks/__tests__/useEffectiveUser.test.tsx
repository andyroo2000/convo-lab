import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
  const { effectiveUser, isImpersonating, loading } = useEffectiveUser();

  return (
    <>
      <div data-testid="layout-identity">{isImpersonating ? effectiveUser?.id : 'self'}</div>
      <div data-testid="draft-intent-owner">{effectiveUser?.id ?? 'none'}</div>
      <div data-testid="loading">{String(loading)}</div>
      <button type="button" onClick={() => navigate('/app/create?viewAs=user-b')}>
        View B
      </button>
      <button type="button" onClick={() => navigate('/app/create')}>
        View self
      </button>
    </>
  );
};

function renderConsumer() {
  return render(
    <MemoryRouter initialEntries={['/app/create?viewAs=user-a']}>
      <Consumer />
    </MemoryRouter>
  );
}

describe('useEffectiveUser request ownership', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
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
    expect(screen.getByTestId('layout-identity')).toHaveTextContent('self');
    expect(screen.getByTestId('draft-intent-owner')).toHaveTextContent('none');
    expect(screen.getByTestId('loading')).toHaveTextContent('true');

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

    expect(screen.getByTestId('layout-identity')).toHaveTextContent('self');
    expect(screen.getByTestId('draft-intent-owner')).toHaveTextContent('admin-user');
    expect(screen.getByTestId('loading')).toHaveTextContent('false');

    await act(async () => {
      requestB.resolve(userResponse('user-b', 'User B'));
      requestA.resolve(userResponse('user-a', 'User A'));
      await Promise.all([requestA.promise, requestB.promise]);
    });

    expect(screen.getByTestId('layout-identity')).toHaveTextContent('self');
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
    expect(screen.getByTestId('layout-identity')).toHaveTextContent('self');
    expect(screen.getByTestId('draft-intent-owner')).toHaveTextContent('none');
    expect(consoleError).toHaveBeenCalledTimes(1);
  });
});
