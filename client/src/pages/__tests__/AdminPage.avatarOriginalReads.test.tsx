import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, screen, fireEvent, waitFor } from '@testing-library/react';
import { AUTH_SESSION_EXPIRED_EVENT } from '../../lib/authSession';

import {
  resetAdminPageMocks,
  mockAvatarReads,
  renderPage,
  mockSpeakerAvatars,
} from './AdminPageTestHarness';

describe('AdminPage avatarOriginalReads', () => {
  beforeEach(() => {
    resetAdminPageMocks();
    mockAvatarReads();
  });

  it('shows original-image loading and cancels the read when the page unmounts', async () => {
    let originalSignal: AbortSignal | undefined;
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
      (url: string, init?: RequestInit) => {
        if (url.includes('/sanctum/csrf-cookie')) {
          return Promise.resolve({ ok: true });
        }
        if (url.includes('/avatars/speaker/') && url.endsWith('/original')) {
          originalSignal = init?.signal ?? undefined;
          return new Promise((_resolve, reject) => {
            originalSignal?.addEventListener(
              'abort',
              () => reject(new DOMException('The operation was aborted.', 'AbortError')),
              { once: true }
            );
          });
        }
        if (url.includes('/api/convolab/admin/avatars/speakers')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockSpeakerAvatars),
          });
        }
        if (url.includes('/api/convolab/admin/users')) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve({ users: [] }) });
        }
        return Promise.reject(new Error('Unknown endpoint'));
      }
    );

    const view = renderPage('avatars');
    fireEvent.click((await screen.findAllByRole('button', { name: 'Re-crop' }))[0]);

    await waitFor(() => expect(originalSignal).toBeDefined());
    expect(screen.getByRole('button', { name: 'Loading...' })).toBeDisabled();

    view.unmount();

    expect(originalSignal?.aborted).toBe(true);
  });

  it('keeps a superseding original-image read authoritative when an older read finishes late', async () => {
    let finishFirstRead: ((response: unknown) => void) | undefined;
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url.includes('ja-female-casual.jpg/original')) {
        return new Promise((resolve) => {
          finishFirstRead = resolve;
        });
      }
      if (url.includes('ja-male-polite.jpg/original')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ originalUrl: 'https://example.com/newer-original.jpg' }),
        });
      }
      if (url.includes('/api/convolab/admin/avatars/speakers')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockSpeakerAvatars),
        });
      }
      if (url.includes('/api/convolab/admin/users')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ users: [] }) });
      }
      return Promise.reject(new Error('Unknown endpoint'));
    });

    renderPage('avatars');
    const [firstRecrop, secondRecrop] = await screen.findAllByRole('button', {
      name: 'Re-crop',
    });
    fireEvent.click(firstRecrop);
    await waitFor(() => expect(finishFirstRead).toBeDefined());
    fireEvent.click(secondRecrop);

    expect(await screen.findByText('Re-crop ja-male-polite.jpg')).toBeInTheDocument();
    expect(screen.getByText('https://example.com/newer-original.jpg')).toBeInTheDocument();

    await act(async () => {
      finishFirstRead?.({
        ok: true,
        json: () => Promise.resolve({ originalUrl: 'https://example.com/stale-original.jpg' }),
      });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByText('Re-crop ja-male-polite.jpg')).toBeInTheDocument();
    expect(screen.queryByText('https://example.com/stale-original.jpg')).not.toBeInTheDocument();
  });

  it('preserves structured original-image errors and shared session expiry', async () => {
    const expiredListener = vi.fn();
    window.addEventListener(AUTH_SESSION_EXPIRED_EVENT, expiredListener);
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url.includes('/avatars/speaker/') && url.endsWith('/original')) {
        return Promise.resolve({
          ok: false,
          status: 401,
          json: () => Promise.resolve({ message: 'Admin session expired' }),
        });
      }
      if (url.includes('/api/convolab/admin/avatars/speakers')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockSpeakerAvatars),
        });
      }
      if (url.includes('/api/convolab/admin/users')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ users: [] }) });
      }
      return Promise.reject(new Error('Unknown endpoint'));
    });

    try {
      renderPage('avatars');
      fireEvent.click((await screen.findAllByRole('button', { name: 'Re-crop' }))[0]);

      expect(await screen.findByText('Admin session expired (401)')).toBeInTheDocument();
      expect(expiredListener).toHaveBeenCalledTimes(1);
    } finally {
      window.removeEventListener(AUTH_SESSION_EXPIRED_EVENT, expiredListener);
    }
  });
});
