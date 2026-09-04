import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { AUTH_SESSION_EXPIRED_EVENT } from '../../lib/authSession';

import {
  resetAdminPageMocks,
  mockAvatarReads,
  renderPage,
  mockUsers,
  mockSpeakerAvatars,
} from './AdminPageTestHarness';

describe('AdminPage avatarReads', () => {
  beforeEach(() => {
    resetAdminPageMocks();
    mockAvatarReads();
  });

  it('keeps the user-avatar loading state until the concurrent users read finishes', async () => {
    let finishUsersRead: (() => void) | undefined;
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url.includes('/api/convolab/admin/avatars/speakers')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockSpeakerAvatars),
        });
      }
      if (url.includes('/api/convolab/admin/users')) {
        return new Promise((resolve) => {
          finishUsersRead = () =>
            resolve({
              ok: true,
              json: () => Promise.resolve({ users: mockUsers }),
            });
        });
      }
      return Promise.reject(new Error('Unknown endpoint'));
    });

    renderPage('avatars');

    await screen.findByText('Japanese Female - Casual');
    expect(screen.getByText('Loading users...')).toBeInTheDocument();

    finishUsersRead?.();
    await screen.findByText('user1@test.com');
    expect(screen.queryByText('Loading users...')).not.toBeInTheDocument();
  });

  it('keeps the speaker-avatar loading state until its own read finishes', async () => {
    let finishSpeakerRead: (() => void) | undefined;
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url.includes('/api/convolab/admin/avatars/speakers')) {
        return new Promise((resolve) => {
          finishSpeakerRead = () =>
            resolve({
              ok: true,
              json: () => Promise.resolve(mockSpeakerAvatars),
            });
        });
      }
      if (url.includes('/api/convolab/admin/users')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ users: mockUsers }),
        });
      }
      return Promise.reject(new Error('Unknown endpoint'));
    });

    renderPage('avatars');

    await screen.findByText('user1@test.com');
    expect(screen.getByText('Loading speaker avatars...')).toBeInTheDocument();

    finishSpeakerRead?.();
    await screen.findByText('Japanese Female - Casual');
    expect(screen.queryByText('Loading speaker avatars...')).not.toBeInTheDocument();
  });

  it('shows structured speaker-avatar errors without clearing the users loading state', async () => {
    let finishUsersRead: (() => void) | undefined;
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url.includes('/api/convolab/admin/avatars/speakers')) {
        return Promise.resolve({
          ok: false,
          status: 503,
          json: () => Promise.resolve({ message: 'Avatar service unavailable' }),
        });
      }
      if (url.includes('/api/convolab/admin/users')) {
        return new Promise((resolve) => {
          finishUsersRead = () =>
            resolve({
              ok: true,
              json: () => Promise.resolve({ users: mockUsers }),
            });
        });
      }
      return Promise.reject(new Error('Unknown endpoint'));
    });

    renderPage('avatars');

    expect(await screen.findByText('Avatar service unavailable (503)')).toBeInTheDocument();
    expect(screen.getByText('Loading users...')).toBeInTheDocument();

    finishUsersRead?.();
    await screen.findByText('user1@test.com');
  });

  it('uses shared session-expiry behavior for unauthorized speaker-avatar reads', async () => {
    const expiredListener = vi.fn();
    window.addEventListener(AUTH_SESSION_EXPIRED_EVENT, expiredListener);
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url.includes('/api/convolab/admin/avatars/speakers')) {
        return Promise.resolve({
          ok: false,
          status: 401,
          json: () => Promise.resolve({ message: 'Admin session expired' }),
        });
      }
      if (url.includes('/api/convolab/admin/users')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ users: mockUsers }),
        });
      }
      return Promise.reject(new Error('Unknown endpoint'));
    });

    try {
      renderPage('avatars');

      await waitFor(() => {
        expect(expiredListener).toHaveBeenCalledTimes(1);
        expect(screen.getByText('Admin session expired (401)')).toBeInTheDocument();
      });
    } finally {
      window.removeEventListener(AUTH_SESSION_EXPIRED_EVENT, expiredListener);
    }
  });

  it('cancels the speaker-avatar read when the page unmounts', async () => {
    let speakerSignal: AbortSignal | undefined;
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
      (url: string, init?: RequestInit) => {
        if (url.includes('/api/convolab/admin/avatars/speakers')) {
          return new Promise((_resolve, reject) => {
            speakerSignal = init?.signal ?? undefined;
            speakerSignal?.addEventListener(
              'abort',
              () => reject(new DOMException('The operation was aborted.', 'AbortError')),
              { once: true }
            );
          });
        }
        if (url.includes('/api/convolab/admin/users')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ users: mockUsers }),
          });
        }
        return Promise.reject(new Error('Unknown endpoint'));
      }
    );

    const view = renderPage('avatars');
    await waitFor(() => expect(speakerSignal).toBeDefined());
    expect(speakerSignal?.aborted).toBe(false);

    view.unmount();

    expect(speakerSignal?.aborted).toBe(true);
  });
});
