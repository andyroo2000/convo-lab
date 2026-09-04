/* eslint-disable testing-library/no-node-access */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';

import { resetAdminPageMocks, renderPage, mockInviteCodes } from './AdminPageTestHarness';

describe('AdminPage inviteCodes', () => {
  beforeEach(resetAdminPageMocks);

  describe('invite codes tab', () => {
    beforeEach(() => {
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
        if (url.includes('/api/convolab/admin/invite-codes')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockInviteCodes),
          });
        }
        return Promise.reject(new Error('Unknown endpoint'));
      });
    });

    it('should fetch and display invite codes', async () => {
      renderPage('invite-codes');

      await waitFor(() => {
        expect(screen.getByText('ABCD1234')).toBeInTheDocument();
        expect(screen.getByText('EFGH5678')).toBeInTheDocument();
      });
    });

    it('should show create invite code button', async () => {
      renderPage('invite-codes');

      await waitFor(() => {
        expect(screen.getByText('Create Code')).toBeInTheDocument();
      });
    });

    it('should handle creating new invite code', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
        (url: string, options: RequestInit | undefined) => {
          if (url.includes('/api/convolab/admin/invite-codes') && options?.method === 'POST') {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve({}),
            });
          }
          if (url.includes('/api/convolab/admin/invite-codes')) {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve(mockInviteCodes),
            });
          }
          return Promise.reject(new Error('Unknown endpoint'));
        }
      );

      renderPage('invite-codes');

      await waitFor(() => {
        expect(screen.getByText('Create Code')).toBeInTheDocument();
      });

      const createButton = screen.getByText('Create Code');
      fireEvent.click(createButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/convolab/admin/invite-codes'),
          expect.objectContaining({ method: 'POST' })
        );
      });
    });

    it('should handle copying invite code', async () => {
      renderPage('invite-codes');

      await waitFor(() => {
        expect(screen.getAllByTitle('Copy code').length).toBeGreaterThan(0);
      });

      const copyButtons = screen.getAllByTitle('Copy code');
      fireEvent.click(copyButtons[0]);

      await waitFor(() => {
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith('ABCD1234');
      });
    });

    it('should handle deleting invite code', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
        (url: string, options: RequestInit | undefined) => {
          if (
            url.includes('/api/convolab/admin/invite-codes/code-1') &&
            options?.method === 'DELETE'
          ) {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve({}),
            });
          }
          if (url.includes('/api/convolab/admin/invite-codes')) {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve(mockInviteCodes),
            });
          }
          return Promise.reject(new Error('Unknown endpoint'));
        }
      );

      renderPage('invite-codes');

      await waitFor(async () => {
        // Find delete buttons - they have Trash2 icon
        const deleteButtons = document.querySelectorAll('button');
        const trashButtons = Array.from(deleteButtons).filter((btn) => {
          const svg = btn.querySelector('svg.lucide-trash-2');
          return svg !== null;
        });

        if (trashButtons.length > 0) {
          fireEvent.click(trashButtons[0]);

          await waitFor(() => {
            expect(screen.getByTestId('modal-button-confirm')).toBeInTheDocument();
          });
          fireEvent.click(screen.getByTestId('modal-button-confirm'));
          await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
              expect.stringContaining('/api/convolab/admin/invite-codes/code-1'),
              expect.objectContaining({ method: 'DELETE' })
            );
          });
        }
      });
    });

    it('should show used status for invite codes', async () => {
      renderPage('invite-codes');

      await waitFor(() => {
        // The used code shows user name and email in separate elements
        expect(screen.getByText('User One')).toBeInTheDocument();
        expect(screen.getByText('user1@test.com')).toBeInTheDocument();
        expect(screen.getByText('Used')).toBeInTheDocument();
        expect(screen.getByText('Available')).toBeInTheDocument();
      });
    });
  });
});
