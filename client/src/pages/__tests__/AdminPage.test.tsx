import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';

import { resetAdminPageMocks, renderPage, mockNavigate, mockUser } from './AdminPageTestHarness';

describe('AdminPage access', () => {
  beforeEach(resetAdminPageMocks);

  describe('access control', () => {
    it('should redirect non-admin users', async () => {
      mockUser.value = { id: 'user-1', email: 'user@test.com', role: 'user' };
      renderPage();

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/app/journal', { replace: true });
      });
    });

    it('should render admin dashboard for admin users', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ users: [] }),
      });

      renderPage();

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Admin', level: 1 })).toBeInTheDocument();
      });
    });
  });

  describe('tab navigation', () => {
    beforeEach(() => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ users: [] }),
      });
    });

    it('should render all tab links', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByRole('link', { name: 'Users' })).toBeInTheDocument();
        expect(screen.getByText('Invite Codes')).toBeInTheDocument();
        expect(screen.getByText('Analytics')).toBeInTheDocument();
        expect(screen.queryByText('Avatars')).not.toBeInTheDocument();
        expect(screen.getByText('Settings')).toBeInTheDocument();
      });
    });

    it('should highlight active tab', async () => {
      renderPage('users');

      await waitFor(() => {
        const usersTab = screen.getByRole('link', { name: 'Users' });
        expect(usersTab).toHaveClass('is-active');
      });
    });
  });
});
