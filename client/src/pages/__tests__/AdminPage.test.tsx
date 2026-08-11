/* eslint-disable testing-library/no-node-access */
// Complex admin page testing with tables and forms requires direct node access
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { AUTH_SESSION_EXPIRED_EVENT } from '../../lib/authSession';
import AdminPage from '../AdminPage';

const mockNavigate = vi.fn();
const mockUser = vi.hoisted(() => ({
  value: { id: 'admin-1', email: 'admin@test.com', role: 'admin' },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser.value,
  }),
}));

vi.mock('../../components/admin/AvatarCropperModal', () => ({
  default: ({
    isOpen,
    imageUrl,
    onSave,
    title,
  }: {
    isOpen: boolean;
    imageUrl: string;
    onClose: () => void;
    onSave: (
      blob: Blob,
      cropArea: { x: number; y: number; width: number; height: number }
    ) => Promise<void>;
    title?: string;
  }) =>
    isOpen ? (
      <div data-testid="avatar-cropper-modal">
        <span>{title}</span>
        <span>{imageUrl}</span>
        <button
          type="button"
          onClick={() => {
            onSave(new Blob(['cropped-image']), {
              x: 1,
              y: 2,
              width: 100,
              height: 100,
            }).catch(() => undefined);
          }}
        >
          Save Crop
        </button>
      </div>
    ) : null,
}));

vi.mock('../../components/common/Toast', () => ({
  default: ({ isVisible, message, type }: { isVisible: boolean; message: string; type: string }) =>
    isVisible ? (
      <div data-testid="toast" data-type={type}>
        {message}
      </div>
    ) : null,
}));

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn().mockResolvedValue(undefined),
  },
});

const mockUsers = [
  {
    id: 'user-1',
    email: 'user1@test.com',
    name: 'User One',
    displayName: 'User 1',
    role: 'user',
    createdAt: new Date('2024-01-01').toISOString(),
    _count: { episodes: 5, courses: 2 },
  },
  {
    id: 'user-2',
    email: 'user2@test.com',
    name: 'User Two',
    displayName: 'User 2',
    role: 'user',
    createdAt: new Date('2024-01-15').toISOString(),
    _count: { episodes: 3, courses: 1 },
  },
];

const mockInviteCodes = [
  {
    id: 'code-1',
    code: 'ABCD1234',
    usedBy: null,
    usedAt: null,
    createdAt: new Date('2024-01-01').toISOString(),
  },
  {
    id: 'code-2',
    code: 'EFGH5678',
    usedBy: 'user-1',
    usedAt: new Date('2024-01-15').toISOString(),
    createdAt: new Date('2024-01-01').toISOString(),
    user: { id: 'user-1', email: 'user1@test.com', name: 'User One' },
  },
];

const mockStats = {
  users: 150,
  episodes: 523,
  courses: 234,
  inviteCodes: { total: 50, used: 30, available: 20 },
};

const mockSpeakerAvatars = [
  {
    id: 'avatar-1',
    filename: 'ja-female-casual.jpg',
    croppedUrl: 'https://example.com/ja-female-casual-cropped.jpg',
    originalUrl: 'https://example.com/ja-female-casual-original.jpg',
    language: 'ja',
    gender: 'female',
    tone: 'casual',
    createdAt: new Date('2024-01-01').toISOString(),
    updatedAt: new Date('2024-01-01').toISOString(),
  },
  {
    id: 'avatar-2',
    filename: 'ja-male-polite.jpg',
    croppedUrl: 'https://example.com/ja-male-polite-cropped.jpg',
    originalUrl: 'https://example.com/ja-male-polite-original.jpg',
    language: 'ja',
    gender: 'male',
    tone: 'polite',
    createdAt: new Date('2024-01-01').toISOString(),
    updatedAt: new Date('2024-01-01').toISOString(),
  },
];

const mockFeatureFlags = {
  id: 'flags-1',
  dialoguesEnabled: true,
  scriptsEnabled: true,
  audioCourseEnabled: true,
  flashcardsEnabled: true,
  updatedAt: new Date('2024-01-01').toISOString(),
};

const mockPronunciationDictionary = {
  keepKanji: ['橋'],
  forceKana: { 北海道: 'ほっかいどう' },
  verbKana: { 話す: 'はなす' },
  updatedAt: new Date('2024-01-02').toISOString(),
};

describe('AdminPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser.value = { id: 'admin-1', email: 'admin@test.com', role: 'admin' };
    global.fetch = vi.fn();
  });

  const renderPage = (tab = 'users') =>
    render(
      <MemoryRouter initialEntries={[`/app/admin/${tab}`]}>
        <Routes>
          <Route path="/app/admin/:tab?" element={<AdminPage />} />
        </Routes>
      </MemoryRouter>
    );

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
  });

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

  describe('analytics tab', () => {
    beforeEach(() => {
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
        if (url.includes('/api/convolab/admin/stats')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockStats),
          });
        }
        return Promise.reject(new Error('Unknown endpoint'));
      });
    });

    it('should fetch and display analytics stats', async () => {
      renderPage('analytics');

      await waitFor(() => {
        expect(screen.getByText('150')).toBeInTheDocument(); // users
        expect(screen.getByText('523')).toBeInTheDocument(); // episodes
        expect(screen.getByText('234')).toBeInTheDocument(); // courses
      });
    });

    it('should display invite codes stats', async () => {
      renderPage('analytics');

      await waitFor(() => {
        expect(screen.getByText('50')).toBeInTheDocument(); // total
        expect(screen.getByText('30')).toBeInTheDocument(); // used
        expect(screen.getByText('20')).toBeInTheDocument(); // available
      });
    });
  });

  describe('avatars tab', () => {
    beforeEach(() => {
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
            json: () => Promise.resolve({ users: [] }),
          });
        }
        return Promise.reject(new Error('Unknown endpoint'));
      });
    });

    it('should fetch and display speaker avatars', async () => {
      renderPage('avatars');

      await waitFor(() => {
        expect(screen.getByText('Japanese Female - Casual')).toBeInTheDocument();
        expect(screen.getByText('Japanese Male - Polite')).toBeInTheDocument();
      });
    });

    it('should show re-crop button for existing avatars', async () => {
      renderPage('avatars');

      await waitFor(() => {
        const recropButtons = screen.getAllByText('Re-crop');
        expect(recropButtons.length).toBeGreaterThan(0);
      });
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

    it('preserves structured speaker re-crop errors', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
        (url: string, init?: RequestInit) => {
          if (url.includes('/sanctum/csrf-cookie')) {
            return Promise.resolve({ ok: true });
          }
          if (url.includes('/avatars/speaker/') && url.endsWith('/original')) {
            return Promise.resolve({
              ok: true,
              status: 200,
              json: () => Promise.resolve({ originalUrl: 'https://example.com/original.jpg' }),
            });
          }
          if (url.includes('/avatars/speaker/') && url.endsWith('/recrop')) {
            expect(init?.method).toBe('POST');
            return Promise.resolve({
              ok: false,
              status: 409,
              json: () =>
                Promise.resolve({
                  message: 'Speaker avatar must be uploaded before it can be re-cropped',
                }),
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

      renderPage('avatars');
      fireEvent.click((await screen.findAllByRole('button', { name: 'Re-crop' }))[0]);
      fireEvent.click(await screen.findByRole('button', { name: 'Save Crop' }));

      expect(
        await screen.findByText('Speaker avatar must be uploaded before it can be re-cropped (409)')
      ).toBeInTheDocument();
    });

    it('cancels a pending speaker re-crop mutation when the page unmounts', async () => {
      let recropSignal: AbortSignal | undefined;
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
        (url: string, init?: RequestInit) => {
          if (url.includes('/sanctum/csrf-cookie')) {
            return Promise.resolve({ ok: true });
          }
          if (url.includes('/avatars/speaker/') && url.endsWith('/original')) {
            return Promise.resolve({
              ok: true,
              status: 200,
              json: () => Promise.resolve({ originalUrl: 'https://example.com/original.jpg' }),
            });
          }
          if (url.includes('/avatars/speaker/') && url.endsWith('/recrop')) {
            recropSignal = init?.signal ?? undefined;
            return new Promise((_resolve, reject) => {
              recropSignal?.addEventListener(
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
      fireEvent.click(await screen.findByRole('button', { name: 'Save Crop' }));
      await waitFor(() => expect(recropSignal).toBeDefined());
      expect(recropSignal?.aborted).toBe(false);

      view.unmount();

      expect(recropSignal?.aborted).toBe(true);
    });

    it('preserves structured speaker upload errors through the multipart client', async () => {
      let uploadInit: RequestInit | undefined;
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
        (url: string, init?: RequestInit) => {
          if (url.includes('/sanctum/csrf-cookie')) {
            return Promise.resolve({ ok: true });
          }
          if (url.includes('/avatars/speaker/') && url.endsWith('/upload')) {
            uploadInit = init;
            return Promise.resolve({
              ok: false,
              status: 413,
              json: () => Promise.resolve({ message: 'Speaker avatar image is too large' }),
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

      const originalCreateObjectUrl = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
      Object.defineProperty(URL, 'createObjectURL', {
        configurable: true,
        value: vi.fn().mockReturnValue('blob:speaker-avatar'),
      });
      renderPage('avatars');
      const uploadButton = (await screen.findAllByRole('button', { name: 'Upload New' }))[0];
      const fileInput = document.createElement('input');
      const createElementSpy = vi.spyOn(document, 'createElement').mockReturnValueOnce(fileInput);

      try {
        fireEvent.click(uploadButton);
        const image = new File(['image-bytes'], 'source.png', { type: 'image/png' });
        Object.defineProperty(fileInput, 'files', { configurable: true, value: [image] });
        await act(async () => {
          fileInput.onchange?.({ target: fileInput } as unknown as Event);
        });

        fireEvent.click(await screen.findByRole('button', { name: 'Save Crop' }));

        expect(
          await screen.findByText('Speaker avatar image is too large (413)')
        ).toBeInTheDocument();
        expect(uploadInit?.signal).toBeDefined();
        expect(uploadInit?.body).toBeInstanceOf(FormData);
        expect(new Headers(uploadInit?.headers).get('Content-Type')).toBeNull();
      } finally {
        createElementSpy.mockRestore();
        if (originalCreateObjectUrl) {
          Object.defineProperty(URL, 'createObjectURL', originalCreateObjectUrl);
        } else {
          Reflect.deleteProperty(URL, 'createObjectURL');
        }
      }
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

  describe('settings tab', () => {
    beforeEach(() => {
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
        (url: string, options: RequestInit | undefined) => {
          if (url.includes('/sanctum/csrf-cookie')) {
            return Promise.resolve({ ok: true });
          }
          if (url.includes('/api/feature-flags')) {
            if (options?.method === 'PATCH') {
              return Promise.resolve({
                ok: true,
                json: () => Promise.resolve(mockFeatureFlags),
              });
            }
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve(mockFeatureFlags),
            });
          }
          if (url.includes('/api/convolab/admin/pronunciation-dictionaries')) {
            if (options?.method === 'PUT') {
              return Promise.resolve({
                ok: true,
                json: () => Promise.resolve(mockPronunciationDictionary),
              });
            }
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve(mockPronunciationDictionary),
            });
          }
          return Promise.reject(new Error('Unknown endpoint'));
        }
      );
    });

    it('should fetch and display feature flags', async () => {
      renderPage('settings');

      await waitFor(() => {
        expect(screen.getByText('Comprehensible Input Dialogues')).toBeInTheDocument();
        expect(screen.getByText('Guided Audio Course')).toBeInTheDocument();
        expect(screen.getByText('Study / Flashcards')).toBeInTheDocument();
        expect(screen.queryByText('Learning OS Study API')).not.toBeInTheDocument();
        expect(screen.queryByText('Study Review')).not.toBeInTheDocument();
      });
    });

    it('should fetch and display verb pronunciation overrides', async () => {
      renderPage('settings');

      await waitFor(() => {
        expect(screen.getByText('Verb-Kana')).toBeInTheDocument();
        expect(screen.getByDisplayValue('話す=はなす')).toBeInTheDocument();
      });
    });

    it('should toggle feature flags', async () => {
      renderPage('settings');

      const dialoguesToggle = await screen.findByLabelText('Toggle AI-Generated Dialogues');
      fireEvent.click(dialoguesToggle);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/feature-flags'),
          expect.objectContaining({
            method: 'PATCH',
          })
        );
      });
    });

    it('rolls back a feature toggle and shows the structured mutation error', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
        (url: string, options?: RequestInit) => {
          if (url.includes('/sanctum/csrf-cookie')) {
            return Promise.resolve({ ok: true });
          }
          if (url.includes('/api/feature-flags') && options?.method === 'PATCH') {
            return Promise.resolve({
              ok: false,
              status: 503,
              json: () => Promise.resolve({ message: 'Feature settings unavailable' }),
            });
          }
          if (url.includes('/api/feature-flags')) {
            return Promise.resolve({ ok: true, json: () => Promise.resolve(mockFeatureFlags) });
          }
          if (url.includes('/api/convolab/admin/pronunciation-dictionaries')) {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve(mockPronunciationDictionary),
            });
          }
          return Promise.reject(new Error('Unknown endpoint'));
        }
      );

      renderPage('settings');
      const dialoguesToggle = await screen.findByLabelText('Toggle AI-Generated Dialogues');
      expect(dialoguesToggle).toBeChecked();

      fireEvent.click(dialoguesToggle);

      expect(await screen.findByText('Feature settings unavailable (503)')).toBeInTheDocument();
      expect(dialoguesToggle).toBeChecked();
    });

    it('uses shared session-expiry behavior for unauthorized feature mutations', async () => {
      const expiredListener = vi.fn();
      window.addEventListener(AUTH_SESSION_EXPIRED_EVENT, expiredListener);
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
        (url: string, options?: RequestInit) => {
          if (url.includes('/sanctum/csrf-cookie')) {
            return Promise.resolve({ ok: true });
          }
          if (url.includes('/api/feature-flags') && options?.method === 'PATCH') {
            return Promise.resolve({
              ok: false,
              status: 401,
              json: () => Promise.resolve({ message: 'Admin session expired' }),
            });
          }
          if (url.includes('/api/feature-flags')) {
            return Promise.resolve({ ok: true, json: () => Promise.resolve(mockFeatureFlags) });
          }
          if (url.includes('/api/convolab/admin/pronunciation-dictionaries')) {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve(mockPronunciationDictionary),
            });
          }
          return Promise.reject(new Error('Unknown endpoint'));
        }
      );

      try {
        renderPage('settings');
        const dialoguesToggle = await screen.findByLabelText('Toggle AI-Generated Dialogues');
        fireEvent.click(dialoguesToggle);

        await waitFor(() => {
          expect(expiredListener).toHaveBeenCalledTimes(1);
          expect(screen.getByText('Admin session expired (401)')).toBeInTheDocument();
          expect(dialoguesToggle).toBeChecked();
        });
      } finally {
        window.removeEventListener(AUTH_SESSION_EXPIRED_EVENT, expiredListener);
      }
    });

    it('keeps concurrent feature mutations isolated when responses arrive out of order', async () => {
      let resolveDialogues: ((response: unknown) => void) | undefined;
      let resolveScripts: ((response: unknown) => void) | undefined;
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
        (url: string, options?: RequestInit) => {
          if (url.includes('/sanctum/csrf-cookie')) {
            return Promise.resolve({ ok: true });
          }
          if (url.includes('/api/feature-flags') && options?.method === 'PATCH') {
            const body = JSON.parse(String(options.body)) as Record<string, boolean>;
            return new Promise((resolve) => {
              if ('dialoguesEnabled' in body) resolveDialogues = resolve;
              if ('scriptsEnabled' in body) resolveScripts = resolve;
            });
          }
          if (url.includes('/api/feature-flags')) {
            return Promise.resolve({ ok: true, json: () => Promise.resolve(mockFeatureFlags) });
          }
          if (url.includes('/api/convolab/admin/pronunciation-dictionaries')) {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve(mockPronunciationDictionary),
            });
          }
          return Promise.reject(new Error('Unknown endpoint'));
        }
      );

      renderPage('settings');
      const dialoguesToggle = await screen.findByLabelText('Toggle AI-Generated Dialogues');
      const scriptsToggle = screen.getByLabelText('Toggle Script Player');
      fireEvent.click(dialoguesToggle);
      fireEvent.click(scriptsToggle);

      await waitFor(() => {
        expect(resolveDialogues).toBeDefined();
        expect(resolveScripts).toBeDefined();
        expect(dialoguesToggle).toBeDisabled();
        expect(scriptsToggle).toBeDisabled();
      });

      resolveScripts?.({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            ...mockFeatureFlags,
            dialoguesEnabled: true,
            scriptsEnabled: false,
          }),
      });
      await waitFor(() => {
        expect(scriptsToggle).not.toBeChecked();
        expect(scriptsToggle).not.toBeDisabled();
        expect(dialoguesToggle).toBeDisabled();
      });

      resolveDialogues?.({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            ...mockFeatureFlags,
            dialoguesEnabled: false,
            scriptsEnabled: true,
          }),
      });
      await waitFor(() => {
        expect(dialoguesToggle).not.toBeChecked();
        expect(scriptsToggle).not.toBeChecked();
        expect(dialoguesToggle).not.toBeDisabled();
      });
    });

    it('does not let a failed feature mutation overwrite a newer same-key refresh', async () => {
      let featureReadCount = 0;
      let resolvePatch: ((response: unknown) => void) | undefined;
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
        (url: string, options?: RequestInit) => {
          if (url.includes('/sanctum/csrf-cookie')) {
            return Promise.resolve({ ok: true });
          }
          if (url.includes('/api/feature-flags') && options?.method === 'PATCH') {
            return new Promise((resolve) => {
              resolvePatch = resolve;
            });
          }
          if (url.includes('/api/feature-flags')) {
            featureReadCount += 1;
            return Promise.resolve({
              ok: true,
              json: () =>
                Promise.resolve({
                  ...mockFeatureFlags,
                  dialoguesEnabled: featureReadCount === 1,
                }),
            });
          }
          if (url.includes('/api/convolab/admin/pronunciation-dictionaries')) {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve(mockPronunciationDictionary),
            });
          }
          if (url.includes('/api/convolab/admin/users')) {
            return Promise.resolve({ ok: true, json: () => Promise.resolve({ users: [] }) });
          }
          return Promise.reject(new Error('Unknown endpoint'));
        }
      );

      renderPage('settings');
      const dialoguesToggle = await screen.findByLabelText('Toggle AI-Generated Dialogues');
      expect(dialoguesToggle).toBeChecked();
      fireEvent.click(dialoguesToggle);
      await waitFor(() => expect(resolvePatch).toBeDefined());

      fireEvent.click(screen.getByRole('link', { name: 'Users' }));
      fireEvent.click(screen.getByRole('link', { name: 'Settings' }));

      const refreshedDialoguesToggle = await screen.findByLabelText(
        'Toggle AI-Generated Dialogues'
      );
      await waitFor(() => {
        expect(featureReadCount).toBe(2);
        expect(refreshedDialoguesToggle).not.toBeChecked();
      });

      resolvePatch?.({
        ok: false,
        status: 503,
        json: () => Promise.resolve({ message: 'Feature settings unavailable' }),
      });

      expect(await screen.findByText('Feature settings unavailable (503)')).toBeInTheDocument();
      expect(refreshedDialoguesToggle).not.toBeChecked();
    });

    it('should save verb pronunciation overrides', async () => {
      renderPage('settings');

      const verbKanaInput = await screen.findByDisplayValue('話す=はなす');
      fireEvent.change(verbKanaInput, { target: { value: '書く=かく' } });
      fireEvent.click(screen.getByText('Save Dictionary'));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/convolab/admin/pronunciation-dictionaries'),
          expect.objectContaining({
            method: 'PUT',
            body: expect.stringContaining('"verbKana":{"書く":"かく"}'),
          })
        );
      });
    });

    it('preserves pronunciation edits and shows structured mutation errors', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
        (url: string, options?: RequestInit) => {
          if (url.includes('/sanctum/csrf-cookie')) {
            return Promise.resolve({ ok: true });
          }
          if (url.includes('/api/feature-flags')) {
            return Promise.resolve({ ok: true, json: () => Promise.resolve(mockFeatureFlags) });
          }
          if (url.includes('/api/convolab/admin/pronunciation-dictionaries')) {
            if (options?.method === 'PUT') {
              return Promise.resolve({
                ok: false,
                status: 503,
                json: () => Promise.resolve({ message: 'Pronunciation settings unavailable' }),
              });
            }
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve(mockPronunciationDictionary),
            });
          }
          return Promise.reject(new Error('Unknown endpoint'));
        }
      );

      renderPage('settings');
      const verbKanaInput = await screen.findByDisplayValue('話す=はなす');
      fireEvent.change(verbKanaInput, { target: { value: '書く=かく' } });
      fireEvent.click(screen.getByText('Save Dictionary'));

      expect(
        await screen.findByText('Pronunciation settings unavailable (503)')
      ).toBeInTheDocument();
      expect(verbKanaInput).toHaveValue('書く=かく');
      expect(screen.getByText('Save Dictionary')).toBeEnabled();
    });

    it('uses shared session-expiry behavior for unauthorized pronunciation mutations', async () => {
      const expiredListener = vi.fn();
      window.addEventListener(AUTH_SESSION_EXPIRED_EVENT, expiredListener);
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
        (url: string, options?: RequestInit) => {
          if (url.includes('/sanctum/csrf-cookie')) {
            return Promise.resolve({ ok: true });
          }
          if (url.includes('/api/feature-flags')) {
            return Promise.resolve({ ok: true, json: () => Promise.resolve(mockFeatureFlags) });
          }
          if (url.includes('/api/convolab/admin/pronunciation-dictionaries')) {
            if (options?.method === 'PUT') {
              return Promise.resolve({
                ok: false,
                status: 401,
                json: () => Promise.resolve({ message: 'Admin session expired' }),
              });
            }
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve(mockPronunciationDictionary),
            });
          }
          return Promise.reject(new Error('Unknown endpoint'));
        }
      );

      try {
        renderPage('settings');
        const verbKanaInput = await screen.findByDisplayValue('話す=はなす');
        fireEvent.change(verbKanaInput, { target: { value: '書く=かく' } });
        fireEvent.click(screen.getByText('Save Dictionary'));

        await waitFor(() => {
          expect(expiredListener).toHaveBeenCalledTimes(1);
          expect(screen.getByText('Admin session expired (401)')).toBeInTheDocument();
          expect(verbKanaInput).toHaveValue('書く=かく');
          expect(screen.getByText('Save Dictionary')).toBeEnabled();
        });
      } finally {
        window.removeEventListener(AUTH_SESSION_EXPIRED_EVENT, expiredListener);
      }
    });

    it('serializes saves without overwriting newer same-field edits', async () => {
      let resolveFirstPut: ((response: unknown) => void) | undefined;
      const putBodies: string[] = [];
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
        (url: string, options?: RequestInit) => {
          if (url.includes('/sanctum/csrf-cookie')) {
            return Promise.resolve({ ok: true });
          }
          if (url.includes('/api/feature-flags')) {
            return Promise.resolve({ ok: true, json: () => Promise.resolve(mockFeatureFlags) });
          }
          if (url.includes('/api/convolab/admin/pronunciation-dictionaries')) {
            if (options?.method === 'PUT') {
              putBodies.push(String(options.body));
              if (putBodies.length === 1) {
                return new Promise((resolve) => {
                  resolveFirstPut = resolve;
                });
              }
              return Promise.resolve({
                ok: true,
                status: 200,
                json: () =>
                  Promise.resolve({
                    ...mockPronunciationDictionary,
                    verbKana: { 読む: 'よむ' },
                  }),
              });
            }
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve(mockPronunciationDictionary),
            });
          }
          return Promise.reject(new Error('Unknown endpoint'));
        }
      );

      renderPage('settings');
      const verbKanaInput = await screen.findByDisplayValue('話す=はなす');
      const saveButton = screen.getByText('Save Dictionary');
      const reloadButton = screen.getByText('Reload');

      fireEvent.change(verbKanaInput, { target: { value: '書く=かく' } });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(resolveFirstPut).toBeDefined();
        expect(screen.getByText('Saving...')).toBeDisabled();
        expect(reloadButton).toBeDisabled();
      });

      fireEvent.change(verbKanaInput, { target: { value: '読む=よむ' } });
      fireEvent.click(screen.getByText('Saving...'));
      expect(putBodies).toHaveLength(1);

      resolveFirstPut?.({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            ...mockPronunciationDictionary,
            verbKana: { 書く: 'かく' },
          }),
      });

      await waitFor(() => {
        expect(verbKanaInput).toHaveValue('読む=よむ');
        expect(screen.getByText('Save Dictionary')).toBeEnabled();
        expect(reloadButton).toBeEnabled();
      });

      fireEvent.click(screen.getByText('Save Dictionary'));
      await waitFor(() => expect(putBodies).toHaveLength(2));
      expect(putBodies[1]).toContain('"verbKana":{"読む":"よむ"}');
    });

    it('cancels both concurrent settings reads when the page unmounts', async () => {
      let featureFlagsSignal: AbortSignal | undefined;
      let pronunciationSignal: AbortSignal | undefined;
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
        (url: string, options?: RequestInit) => {
          if (url.includes('/api/feature-flags')) {
            return new Promise((_resolve, reject) => {
              featureFlagsSignal = options?.signal ?? undefined;
              featureFlagsSignal?.addEventListener(
                'abort',
                () => reject(new DOMException('The operation was aborted.', 'AbortError')),
                { once: true }
              );
            });
          }
          if (url.includes('/api/convolab/admin/pronunciation-dictionaries')) {
            return new Promise((_resolve, reject) => {
              pronunciationSignal = options?.signal ?? undefined;
              pronunciationSignal?.addEventListener(
                'abort',
                () => reject(new DOMException('The operation was aborted.', 'AbortError')),
                { once: true }
              );
            });
          }
          return Promise.reject(new Error('Unknown endpoint'));
        }
      );

      const view = renderPage('settings');
      await waitFor(() => {
        expect(featureFlagsSignal).toBeDefined();
        expect(pronunciationSignal).toBeDefined();
      });
      expect(featureFlagsSignal).not.toBe(pronunciationSignal);

      view.unmount();

      expect(featureFlagsSignal?.aborted).toBe(true);
      expect(pronunciationSignal?.aborted).toBe(true);
    });

    it('aborts both settings mutations when the page unmounts', async () => {
      let featureMutationOptions: RequestInit | undefined;
      let pronunciationMutationOptions: RequestInit | undefined;
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
        (url: string, options?: RequestInit) => {
          if (url.includes('/sanctum/csrf-cookie')) {
            return Promise.resolve({ ok: true });
          }
          if (url.includes('/api/feature-flags') && options?.method === 'PATCH') {
            featureMutationOptions = options;
            return new Promise((_resolve, reject) => {
              options.signal?.addEventListener(
                'abort',
                () => reject(new DOMException('The operation was aborted.', 'AbortError')),
                { once: true }
              );
            });
          }
          if (url.includes('/api/feature-flags')) {
            return Promise.resolve({ ok: true, json: () => Promise.resolve(mockFeatureFlags) });
          }
          if (
            url.includes('/api/convolab/admin/pronunciation-dictionaries') &&
            options?.method === 'PUT'
          ) {
            pronunciationMutationOptions = options;
            return new Promise((_resolve, reject) => {
              options.signal?.addEventListener(
                'abort',
                () => reject(new DOMException('The operation was aborted.', 'AbortError')),
                { once: true }
              );
            });
          }
          if (url.includes('/api/convolab/admin/pronunciation-dictionaries')) {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve(mockPronunciationDictionary),
            });
          }
          return Promise.reject(new Error('Unknown endpoint'));
        }
      );

      const view = renderPage('settings');
      const dialoguesToggle = await screen.findByLabelText('Toggle AI-Generated Dialogues');
      await screen.findByDisplayValue('話す=はなす');
      fireEvent.click(dialoguesToggle);
      fireEvent.click(screen.getByText('Save Dictionary'));

      await waitFor(() => {
        expect(featureMutationOptions).toBeDefined();
        expect(pronunciationMutationOptions).toBeDefined();
      });
      expect(featureMutationOptions?.signal).toBeDefined();
      expect(pronunciationMutationOptions?.signal).toBeDefined();

      view.unmount();

      expect(featureMutationOptions?.signal?.aborted).toBe(true);
      expect(pronunciationMutationOptions?.signal?.aborted).toBe(true);
    });

    it('shows structured errors for failed feature-flag reads', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
        if (url.includes('/api/feature-flags')) {
          return Promise.resolve({
            ok: false,
            status: 503,
            json: () => Promise.resolve({ message: 'Feature settings unavailable' }),
          });
        }
        if (url.includes('/api/convolab/admin/pronunciation-dictionaries')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockPronunciationDictionary),
          });
        }
        return Promise.reject(new Error('Unknown endpoint'));
      });

      renderPage('settings');

      expect(await screen.findByText('Feature settings unavailable (503)')).toBeInTheDocument();
      expect(screen.getByDisplayValue('話す=はなす')).toBeInTheDocument();
    });

    it('shows structured errors for failed pronunciation-dictionary reads', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
        if (url.includes('/api/feature-flags')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockFeatureFlags),
          });
        }
        if (url.includes('/api/convolab/admin/pronunciation-dictionaries')) {
          return Promise.resolve({
            ok: false,
            status: 503,
            json: () => Promise.resolve({ message: 'Pronunciation settings unavailable' }),
          });
        }
        return Promise.reject(new Error('Unknown endpoint'));
      });

      renderPage('settings');

      expect(
        await screen.findByText('Pronunciation settings unavailable (503)')
      ).toBeInTheDocument();
      expect(screen.getByLabelText('Toggle AI-Generated Dialogues')).toBeInTheDocument();
    });

    it('uses shared session-expiry behavior for unauthorized settings reads', async () => {
      const expiredListener = vi.fn();
      window.addEventListener(AUTH_SESSION_EXPIRED_EVENT, expiredListener);
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
        if (url.includes('/api/feature-flags')) {
          return Promise.resolve({
            ok: false,
            status: 401,
            json: () => Promise.resolve({ message: 'Admin session expired' }),
          });
        }
        if (url.includes('/api/convolab/admin/pronunciation-dictionaries')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockPronunciationDictionary),
          });
        }
        return Promise.reject(new Error('Unknown endpoint'));
      });

      try {
        renderPage('settings');

        await waitFor(() => {
          expect(expiredListener).toHaveBeenCalledTimes(1);
          expect(screen.getByText('Admin session expired (401)')).toBeInTheDocument();
        });
      } finally {
        window.removeEventListener(AUTH_SESSION_EXPIRED_EVENT, expiredListener);
      }
    });
  });

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
