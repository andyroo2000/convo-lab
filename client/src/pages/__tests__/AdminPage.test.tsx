/* eslint-disable testing-library/no-node-access */
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
        expect(mockNavigate).toHaveBeenCalledWith('/app/library');
      });
    });

    it('should render admin dashboard for admin users', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ users: [] }),
      });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Admin Dashboard')).toBeInTheDocument();
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
        expect(screen.getByText('Users')).toBeInTheDocument();
        expect(screen.getByText('Invite Codes')).toBeInTheDocument();
        expect(screen.getByText('Analytics')).toBeInTheDocument();
        expect(screen.getByText('Avatars')).toBeInTheDocument();
        expect(screen.getByText('Settings')).toBeInTheDocument();
      });
    });

    it('should highlight active tab', async () => {
      renderPage('users');

      await waitFor(() => {
        const usersTab = screen.getByText('Users').closest('a');
        expect(usersTab).toHaveClass('border-indigo');
      });
    });
  });
});
