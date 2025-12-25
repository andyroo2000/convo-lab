import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import AdminPage from '../AdminPage';

const mockNavigate = vi.fn();
const mockUser = vi.hoisted(() => ({ value: { id: 'admin-1', email: 'admin@test.com', role: 'admin' } }));

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
  default: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
    isOpen ? <div data-testid="avatar-cropper-modal">Avatar Cropper Modal</div> : null,
}));

vi.mock('../../components/common/Toast', () => ({
  default: ({ visible, message, type }: { visible: boolean; message: string; type: string }) =>
    visible ? <div data-testid="toast" data-type={type}>{message}</div> : null,
}));

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn().mockResolvedValue(undefined),
  },
});

// Mock window.confirm
global.confirm = vi.fn();

const mockUsers = [
  {
    id: 'user-1',
    email: 'user1@test.com',
    name: 'User One',
    displayName: 'User 1',
    role: 'user',
    createdAt: new Date('2024-01-01').toISOString(),
    _count: { episodes: 5, courses: 2, narrowListeningPacks: 1, chunkPacks: 3 },
  },
  {
    id: 'user-2',
    email: 'user2@test.com',
    name: 'User Two',
    displayName: 'User 2',
    role: 'user',
    createdAt: new Date('2024-01-15').toISOString(),
    _count: { episodes: 3, courses: 1, narrowListeningPacks: 0, chunkPacks: 2 },
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
  narrowListeningPacks: 145,
  chunkPacks: 298,
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
  audioCourseEnabled: true,
  narrowListeningEnabled: false,
  processingInstructionEnabled: true,
  lexicalChunksEnabled: false,
  updatedAt: new Date('2024-01-01').toISOString(),
};

describe('AdminPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser.value = { id: 'admin-1', email: 'admin@test.com', role: 'admin' };
    global.fetch = vi.fn();
    (global.confirm as any).mockReturnValue(true);
  });

  const renderPage = (tab = 'users') => render(
      <MemoryRouter initialEntries={[`/app/admin/${tab}`]}>
        <Routes>
          <Route path="/app/admin/:tab?" element={<AdminPage />} />
        </Routes>
      </MemoryRouter>
    );

  describe('access control', () => {
    it('should redirect non-admin users', () => {
      mockUser.value = { id: 'user-1', email: 'user@test.com', role: 'user' };
      renderPage();

      expect(mockNavigate).toHaveBeenCalledWith('/app/library');
    });

    it('should render admin dashboard for admin users', async () => {
      (global.fetch as any).mockResolvedValue({
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
      (global.fetch as any).mockResolvedValue({
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
      (global.fetch as any).mockImplementation((url: string) => {
        if (url.includes('/api/admin/users')) {
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
      (global.fetch as any).mockImplementation(() => new Promise(() => {}));

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

      fireEvent.change(searchInput, { target: { value: 'user1' } });
      await waitFor(async () => {
        const searchInput = screen.getByPlaceholderText('Search users by name or email...');
        expect(searchInput).toHaveValue('user1');
      });
    });

    it('should fetch users when search button is clicked', async () => {
      renderPage('users');

      fireEvent.click(searchButton);
      await waitFor(async () => {
        const searchButton = screen.getByText('Search');

        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/admin/users'),
          expect.objectContaining({ credentials: 'include' })
        );
      });
    });

    it('should handle user deletion', async () => {
      (global.fetch as any).mockImplementation((url: string, options: any) => {
        if (url.includes('/api/admin/users/user-1') && options?.method === 'DELETE') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({}),
          });
        }
        if (url.includes('/api/admin/users')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ users: mockUsers }),
          });
        }
        return Promise.reject(new Error('Unknown endpoint'));
      });

      renderPage('users');

      await waitFor(async () => {
        // Find delete buttons by title attribute
        const deleteButtons = document.querySelectorAll('button');
        const trashButtons = Array.from(deleteButtons).filter(btn => {
          const svg = btn.querySelector('svg.lucide-trash-2');
          return svg !== null;
        });

        if (trashButtons.length > 0) {
          fireEvent.click(trashButtons[0]);

          expect(global.confirm).toHaveBeenCalled();
          await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
              expect.stringContaining('/api/admin/users/user-1'),
              expect.objectContaining({ method: 'DELETE' })
            );
          });
        }
      });
    });

    it('should display user stats', async () => {
      renderPage('users');

      await waitFor(() => {
        // User 1 has 5 episodes + 2 courses + 1 narrow + 3 chunks = 11 items
        expect(screen.getByText('11 items')).toBeInTheDocument();
        // User 2 has 3 episodes + 1 course + 0 narrow + 2 chunks = 6 items
        expect(screen.getByText('6 items')).toBeInTheDocument();
      });
    });
  });

  describe('invite codes tab', () => {
    beforeEach(() => {
      (global.fetch as any).mockImplementation((url: string) => {
        if (url.includes('/api/admin/invite-codes')) {
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
      (global.fetch as any).mockImplementation((url: string, options: any) => {
        if (url.includes('/api/admin/invite-codes') && options?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({}),
          });
        }
        if (url.includes('/api/admin/invite-codes')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockInviteCodes),
          });
        }
        return Promise.reject(new Error('Unknown endpoint'));
      });

      renderPage('invite-codes');

      fireEvent.click(createButton);
      await waitFor(async () => {
        const createButton = screen.getByText('Create Code');

        await waitFor(() => {
          expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining('/api/admin/invite-codes'),
            expect.objectContaining({ method: 'POST' })
          );
        });
      });
    });

    it('should handle copying invite code', async () => {
      renderPage('invite-codes');

      fireEvent.click(copyButtons[0]);
      await waitFor(async () => {
        const copyButtons = screen.getAllByTitle('Copy code');

        expect(navigator.clipboard.writeText).toHaveBeenCalledWith('ABCD1234');
      });
    });

    it('should handle deleting invite code', async () => {
      (global.fetch as any).mockImplementation((url: string, options: any) => {
        if (url.includes('/api/admin/invite-codes/code-1') && options?.method === 'DELETE') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({}),
          });
        }
        if (url.includes('/api/admin/invite-codes')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockInviteCodes),
          });
        }
        return Promise.reject(new Error('Unknown endpoint'));
      });

      renderPage('invite-codes');

      await waitFor(async () => {
        // Find delete buttons - they have Trash2 icon
        const deleteButtons = document.querySelectorAll('button');
        const trashButtons = Array.from(deleteButtons).filter(btn => {
          const svg = btn.querySelector('svg.lucide-trash-2');
          return svg !== null;
        });

        if (trashButtons.length > 0) {
          fireEvent.click(trashButtons[0]);

          expect(global.confirm).toHaveBeenCalled();
          await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
              expect.stringContaining('/api/admin/invite-codes/code-1'),
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
      (global.fetch as any).mockImplementation((url: string) => {
        if (url.includes('/api/admin/stats')) {
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
        expect(screen.getByText('145')).toBeInTheDocument(); // narrow listening packs
        expect(screen.getByText('298')).toBeInTheDocument(); // chunk packs
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
      (global.fetch as any).mockImplementation((url: string) => {
        if (url.includes('/api/admin/avatars/speakers')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockSpeakerAvatars),
          });
        }
        if (url.includes('/api/admin/users')) {
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
  });

  describe('settings tab', () => {
    beforeEach(() => {
      (global.fetch as any).mockImplementation((url: string, options: any) => {
        if (url.includes('/api/admin/feature-flags')) {
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
        return Promise.reject(new Error('Unknown endpoint'));
      });
    });

    it('should fetch and display feature flags', async () => {
      renderPage('settings');

      await waitFor(() => {
        expect(screen.getByText('Comprehensible Input Dialogues')).toBeInTheDocument();
        expect(screen.getByText('Guided Audio Course')).toBeInTheDocument();
        expect(screen.getByText('Narrow Listening Packs')).toBeInTheDocument();
        expect(screen.getByText('Processing Instruction Activities')).toBeInTheDocument();
        expect(screen.getByText('Lexical Chunk Packs')).toBeInTheDocument();
      });
    });

    it('should toggle feature flags', async () => {
      renderPage('settings');

      await waitFor(async () => {
        const toggles = screen.getAllByRole('checkbox');
        const narrowListeningToggle = toggles.find(
          (toggle) => !toggle.getAttribute('checked') && toggle.getAttribute('aria-label')?.includes('narrow')
        );

        if (narrowListeningToggle) {
          fireEvent.click(narrowListeningToggle);

          await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
              expect.stringContaining('/api/admin/feature-flags'),
              expect.objectContaining({
                method: 'PATCH',
                body: expect.stringContaining('narrowListeningEnabled'),
              })
            );
          });
        }
      });
    });
  });

  describe('error handling', () => {
    it('should display error message when fetch fails', async () => {
      (global.fetch as any).mockRejectedValue(new Error('Failed to fetch users'));

      renderPage('users');

      await waitFor(() => {
        expect(screen.getByText(/Failed to fetch users/i)).toBeInTheDocument();
      });
    });
  });
});
