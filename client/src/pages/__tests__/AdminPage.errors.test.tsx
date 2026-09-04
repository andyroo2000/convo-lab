import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { AUTH_SESSION_EXPIRED_EVENT } from '../../lib/authSession';

import { resetAdminPageMocks, renderPage } from './AdminPageTestHarness';

describe('AdminPage errors', () => {
  beforeEach(resetAdminPageMocks);

  describe('error handling', () => {
    it('should display error message when fetch fails', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Failed to fetch users')
      );

      renderPage('users');

      await waitFor(() => {
        expect(screen.getByText(/Failed to fetch users/i)).toBeInTheDocument();
      });
    });

    it('shows the normalized API error for a failed dashboard read', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 503,
        json: () => Promise.resolve({ message: 'Admin service unavailable' }),
      });

      renderPage('users');

      await waitFor(() => {
        expect(screen.getByText('Admin service unavailable (503)')).toBeInTheDocument();
      });
    });

    it('uses the shared session-expiry behavior for unauthorized dashboard reads', async () => {
      const expiredListener = vi.fn();
      window.addEventListener(AUTH_SESSION_EXPIRED_EVENT, expiredListener);
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ message: 'Admin session expired' }),
      });

      try {
        renderPage('analytics');

        await waitFor(() => {
          expect(expiredListener).toHaveBeenCalledTimes(1);
          expect(screen.getByText('Admin session expired (401)')).toBeInTheDocument();
        });
      } finally {
        window.removeEventListener(AUTH_SESSION_EXPIRED_EVENT, expiredListener);
      }
    });
  });
});
