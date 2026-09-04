/* eslint-disable testing-library/no-node-access */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';

import {
  resetAdminPageMocks,
  renderPage,
  mockNavigate,
  mockUsers,
  mockSpeakerAvatars,
} from './AdminPageTestHarness';

describe('AdminPage users', () => {
  beforeEach(resetAdminPageMocks);

  describe('users tab', () => {
    beforeEach(() => {
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
        if (url.includes('/api/convolab/admin/users')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ users: mockUsers }),
          });
        }
        return Promise.reject(new Error('Unknown endpoint'));
      });
    });

    it('should fetch and display users on mount', async () => {
      renderPage('users');

      await waitFor(() => {
        expect(screen.getByText('user1@test.com')).toBeInTheDocument();
        expect(screen.getByText('user2@test.com')).toBeInTheDocument();
      });
    });

    it('should show loading state while fetching users', () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(() => new Promise(() => {}));

      renderPage('users');

      expect(screen.getByText('Loading users...')).toBeInTheDocument();
    });

    it('should render search input', async () => {
      renderPage('users');

      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText('Search users by name or email...');
        expect(searchInput).toBeInTheDocument();
      });
    });

    it('should handle search input change', async () => {
      renderPage('users');

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search users by name or email...')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search users by name or email...');
      fireEvent.change(searchInput, { target: { value: 'user1' } });

      expect(searchInput).toHaveValue('user1');
    });

    it('should fetch users when search button is clicked', async () => {
      renderPage('users');

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search users by name or email...')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByPlaceholderText('Search users by name or email...'), {
        target: { value: 'name+tag@example.com' },
      });
      const searchButton = screen.getByText('Search');
      fireEvent.click(searchButton);

      await waitFor(() => {
        const searchCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.find(
          ([url]) => url === '/api/convolab/admin/users?search=name%2Btag%40example.com'
        );
        expect(searchCall).toBeDefined();
        const init = searchCall?.[1] as RequestInit;
        expect(init.credentials).toBe('include');
        expect(new Headers(init.headers).get('Accept')).toBe('application/json');
      });
    });

    it('aborts the mounted users read when the page unmounts', async () => {
      let requestSignal: AbortSignal | undefined;
      const view = renderPage('users');
      await screen.findByText('user1@test.com');

      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
        (_url: string, init?: RequestInit) =>
          new Promise((_resolve, reject) => {
            requestSignal = init?.signal ?? undefined;
            requestSignal?.addEventListener(
              'abort',
              () => reject(new DOMException('The operation was aborted.', 'AbortError')),
              { once: true }
            );
          })
      );

      fireEvent.change(screen.getByPlaceholderText('Search users by name or email...'), {
        target: { value: 'pending query' },
      });
      fireEvent.click(screen.getByText('Search'));
      await waitFor(() => expect(requestSignal).toBeDefined());
      expect(requestSignal?.aborted).toBe(false);

      view.unmount();

      expect(requestSignal?.aborted).toBe(true);
    });

    it('silently aborts a superseded users read while the replacement succeeds', async () => {
      renderPage('users');
      await screen.findByText('user1@test.com');

      const foreignRealm = document.createElement('iframe');
      document.body.appendChild(foreignRealm);
      const ForeignDOMException = (foreignRealm.contentWindow as unknown as typeof globalThis)
        .DOMException;
      const abortError = new ForeignDOMException('The operation was aborted.', 'AbortError');
      expect(abortError).not.toBeInstanceOf(Error);

      let pendingSignal: AbortSignal | undefined;
      let searchRequestCount = 0;
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
        (_url: string, init?: RequestInit) => {
          searchRequestCount += 1;
          if (searchRequestCount === 1) {
            return new Promise((_resolve, reject) => {
              pendingSignal = init?.signal ?? undefined;
              pendingSignal?.addEventListener('abort', () => reject(abortError), { once: true });
            });
          }

          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ users: [mockUsers[1]] }),
          });
        }
      );

      const searchInput = screen.getByPlaceholderText('Search users by name or email...');
      fireEvent.change(searchInput, { target: { value: 'pending' } });
      fireEvent.click(screen.getByText('Search'));
      await waitFor(() => expect(pendingSignal).toBeDefined());

      fireEvent.change(searchInput, { target: { value: 'replacement' } });
      fireEvent.click(screen.getByText('Search'));

      await screen.findByText('user2@test.com');
      expect(pendingSignal?.aborted).toBe(true);
      expect(screen.queryByText('Failed to fetch users')).not.toBeInTheDocument();
      foreignRealm.remove();
    });

    it('should handle user deletion', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
        (url: string, options: RequestInit | undefined) => {
          if (url.includes('/api/convolab/admin/users/user-1') && options?.method === 'DELETE') {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve({}),
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

      renderPage('users');

      await waitFor(async () => {
        // Find delete buttons by title attribute
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
              expect.stringContaining('/api/convolab/admin/users/user-1'),
              expect.objectContaining({ method: 'DELETE' })
            );
          });
        }
      });
    });

    it('should display user stats', async () => {
      renderPage('users');

      await waitFor(() => {
        // User 1 has 5 episodes + 2 courses = 7 items
        expect(screen.getByText('7 items')).toBeInTheDocument();
        // User 2 has 3 episodes + 1 course = 4 items
        expect(screen.getByText('4 items')).toBeInTheDocument();
      });
    });

    it('keeps user details and impersonation within the users tab', async () => {
      renderPage('users');

      const userEmail = await screen.findByText('user1@test.com');
      fireEvent.click(userEmail.closest('tr') as HTMLTableRowElement);

      expect(screen.getByRole('heading', { name: 'User Details' })).toBeInTheDocument();
      expect(screen.getByText('User Information')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Impersonate User' }));
      expect(mockNavigate).toHaveBeenCalledWith('/app/library?viewAs=user-1');
    });

    it('preserves the current user search when the parent refreshes the avatars user feed', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
        if (url.includes('/api/convolab/admin/avatars/speakers')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockSpeakerAvatars),
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

      renderPage('users');
      await screen.findByText('user1@test.com');

      fireEvent.change(screen.getByPlaceholderText('Search users by name or email...'), {
        target: { value: 'name+tag@example.com' },
      });
      fireEvent.click(screen.getByRole('link', { name: 'Avatars' }));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/convolab/admin/users?search=name%2Btag%40example.com',
          expect.objectContaining({ signal: expect.any(AbortSignal) })
        );
      });
    });
  });
});
