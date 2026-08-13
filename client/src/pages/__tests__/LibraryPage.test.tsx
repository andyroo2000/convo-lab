/* eslint-disable testing-library/no-node-access, testing-library/no-container */
// Complex library page testing with dynamic content requires direct node access
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import LibraryPage from '../LibraryPage';

const mockUpdateUser = vi.fn();
const mockUseLibraryData = vi.hoisted(() => vi.fn());
const mockFeatureFlags = vi.hoisted(() => ({
  value: {
    dialoguesEnabled: true,
    scriptsEnabled: true,
    audioCourseEnabled: true,
    flashcardsEnabled: true,
  },
}));
const mockUser = {
  id: 'user-1',
  name: 'Test User',
  email: 'test@example.com',
  onboardingCompleted: false,
  seenSampleContentGuide: false,
  preferredStudyLanguage: 'ja',
  preferredNativeLanguage: 'en',
  role: 'admin' as const,
};

function deferredResponse() {
  let resolve!: (response: Response) => void;
  const promise = new Promise<Response>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

const RouteControls = () => {
  const navigate = useNavigate();
  return (
    <>
      <button type="button" onClick={() => navigate('/app/library?viewAs=user-a')}>
        View A
      </button>
      <button type="button" onClick={() => navigate('/app/library?viewAs=user-b')}>
        View B
      </button>
      <button type="button" onClick={() => navigate('/app/library')}>
        View self
      </button>
    </>
  );
};

const createMockLibraryData = (overrides: Record<string, unknown> = {}) => ({
  episodes: [],
  courses: [],
  isLoading: false,
  error: null,
  retry: vi.fn(),
  hasNextPage: false,
  shouldAutoLoadMore: false,
  fetchNextPage: vi.fn(),
  isFetchingNextPage: false,
  deleteEpisode: vi.fn(),
  deleteCourse: vi.fn(),
  isDeletingEpisode: false,
  isDeletingCourse: false,
  ...overrides,
});

// Mock hooks
vi.mock('../../hooks/useLibraryData', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../hooks/useLibraryData')>()),
  useLibraryData: mockUseLibraryData,
}));

vi.mock('../../hooks/useDemo', () => ({
  useIsDemo: () => false,
}));

vi.mock('../../hooks/useFeatureFlags', () => ({
  useFeatureFlags: () => ({
    flags: mockFeatureFlags.value,
    isLoading: false,
    error: null,
    isFeatureEnabled: (flag: keyof typeof mockFeatureFlags.value) => mockFeatureFlags.value[flag],
    isAdmin: false,
  }),
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    updateUser: mockUpdateUser,
  }),
}));

// Mock other components
vi.mock('../../components/common/ConfirmModal', () => ({
  default: () => null,
}));

describe('LibraryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseLibraryData.mockReturnValue(createMockLibraryData());
    mockFeatureFlags.value = {
      dialoguesEnabled: true,
      scriptsEnabled: true,
      audioCourseEnabled: true,
      flashcardsEnabled: true,
    };
    vi.stubGlobal('fetch', vi.fn());
  });

  const renderLibraryPage = (route = '/app/library') => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[route]}>
          <RouteControls />
          <LibraryPage />
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  describe('Impersonation banner request ownership', () => {
    it('clears the old banner immediately and ignores stale A responses after A to B to self', async () => {
      const aRequest = deferredResponse();
      const bRequest = deferredResponse();
      vi.mocked(fetch).mockReturnValueOnce(aRequest.promise).mockReturnValueOnce(bRequest.promise);
      renderLibraryPage('/app/library?viewAs=user-a');

      fireEvent.click(screen.getByRole('button', { name: 'View B' }));
      fireEvent.click(screen.getByRole('button', { name: 'View self' }));

      aRequest.resolve(
        new Response(JSON.stringify({ id: 'user-a', name: 'User A', email: 'a@example.com' }), {
          status: 200,
        })
      );
      bRequest.resolve(
        new Response(JSON.stringify({ id: 'user-b', name: 'User B', email: 'b@example.com' }), {
          status: 200,
        })
      );

      await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
      expect(screen.queryByText(/User A/)).toBeNull();
      expect(screen.queryByText(/User B/)).toBeNull();
    });

    it('clears A during the A to B transition and only renders B from the current response', async () => {
      const bRequest = deferredResponse();
      vi.mocked(fetch)
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ id: 'user-a', name: 'User A', email: 'a@example.com' }), {
            status: 200,
          })
        )
        .mockReturnValueOnce(bRequest.promise);
      renderLibraryPage('/app/library?viewAs=user-a');
      expect(await screen.findByText(/User A/)).toBeTruthy();

      fireEvent.click(screen.getByRole('button', { name: 'View B' }));
      expect(screen.queryByText(/User A/)).toBeNull();

      bRequest.resolve(
        new Response(JSON.stringify({ id: 'user-b', name: 'User B', email: 'b@example.com' }), {
          status: 200,
        })
      );
      expect(await screen.findByText(/User B/)).toBeTruthy();
    });

    it('does not render error response bodies as impersonated users', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(JSON.stringify({ name: 'Wrong User', email: 'wrong@example.com' }), {
          status: 500,
        })
      );

      renderLibraryPage('/app/library?viewAs=user-a');

      await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
      expect(screen.queryByText(/Wrong User/)).toBeNull();
    });
  });

  describe('Mobile layout - Filter buttons', () => {
    it('should render the v3 toolbar container', () => {
      const { container } = renderLibraryPage();

      const filterContainer = container.querySelector('.retro-library-v3-toolbar');
      expect(filterContainer).toBeTruthy();
    });

    it('should render all filter buttons', () => {
      renderLibraryPage();

      expect(screen.getByTestId('library-filter-all')).toBeTruthy();
      expect(screen.getByTestId('library-filter-dialogues')).toBeTruthy();
      expect(screen.getByTestId('library-filter-scripts')).toBeTruthy();
      expect(screen.getByTestId('library-filter-courses')).toBeTruthy();
    });

    it('should hide scripts filter independently from dialogues filter', () => {
      mockFeatureFlags.value.scriptsEnabled = false;

      renderLibraryPage();

      expect(screen.getByTestId('library-filter-dialogues')).toBeTruthy();
      expect(screen.queryByTestId('library-filter-scripts')).toBeNull();
    });

    it('should default to all content filter selected', () => {
      renderLibraryPage();

      const allButton = screen.getByTestId('library-filter-all');
      expect(allButton).toHaveClass('is-active');
      expect(allButton).toHaveAttribute('aria-pressed', 'true');
    });

    it('should scope library queries to the selected filter', () => {
      renderLibraryPage('/app/library?filter=courses');

      expect(mockUseLibraryData).toHaveBeenCalledWith(undefined, false, 'courses');
    });
  });

  describe('Mobile layout - Empty states', () => {
    it('should render the v3 empty state shell', () => {
      const { container } = renderLibraryPage();

      const emptyStateWrapper = container.querySelector('.retro-library-v3-empty');
      expect(emptyStateWrapper).toBeTruthy();
    });

    it('should render empty state for "all" filter when no content', () => {
      renderLibraryPage();

      // The "all" filter empty state has a "Browse All Options" button
      expect(screen.getByTestId('library-button-browse-all')).toBeTruthy();
    });

    it('should not auto-page an empty filtered result set', () => {
      const fetchNextPage = vi.fn();
      mockUseLibraryData.mockReturnValue(
        createMockLibraryData({ hasNextPage: true, shouldAutoLoadMore: false, fetchNextPage })
      );

      renderLibraryPage('/app/library?filter=dialogues');

      expect(screen.queryByTestId('scroll-sentinel')).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Load more' }));
      expect(fetchNextPage).toHaveBeenCalledOnce();
      expect(screen.getByRole('heading', { name: 'More content may be available' })).toBeTruthy();
      expect(screen.queryByRole('heading', { name: 'Create Your First Dialogue' })).toBeNull();
    });

    it('should keep paging available once the filtered result set has visible items', () => {
      mockUseLibraryData.mockReturnValue(
        createMockLibraryData({ hasNextPage: true, shouldAutoLoadMore: true })
      );

      renderLibraryPage('/app/library?filter=dialogues');

      expect(screen.getByTestId('scroll-sentinel')).toBeTruthy();
    });
  });

  describe('Error recovery', () => {
    it('offers a route back to all content from a scoped query failure', () => {
      mockUseLibraryData.mockReturnValue(createMockLibraryData({ error: 'Courses failed' }));

      renderLibraryPage('/app/library?filter=courses');

      expect(screen.getByRole('button', { name: 'Back to all content' })).toBeTruthy();
    });
  });

  describe('Content rendering', () => {
    const createDialogueEpisode = (overrides: Record<string, unknown> = {}) => ({
      id: 'episode-1',
      userId: 'user-1',
      title: 'A dialogue',
      sourceText: 'Source text',
      targetLanguage: 'ja',
      nativeLanguage: 'en',
      contentType: 'dialogue',
      status: 'ready',
      createdAt: '2026-08-12T00:00:00.000Z',
      updatedAt: '2026-08-12T00:00:00.000Z',
      dialogue: {
        speakers: [],
      },
      ...overrides,
    });

    it('should render filter buttons with correct styling', () => {
      renderLibraryPage();

      const dialoguesButton = screen.getByTestId('library-filter-dialogues');
      expect(dialoguesButton).toHaveClass('retro-library-v3-filter');
    });

    it('should display empty state message when no content exists', () => {
      renderLibraryPage();

      const emptyMessage = screen.getByRole('heading', { name: /No content yet/i });
      expect(emptyMessage).toBeTruthy();
    });

    it('renders the authoritative dialogue turn count from the library response', () => {
      mockUseLibraryData.mockReturnValue(
        createMockLibraryData({
          episodes: [
            createDialogueEpisode({
              dialogue: { speakers: [], turnCount: 7 },
            }),
          ],
        })
      );

      renderLibraryPage();

      expect(
        screen.getByText(
          (_content, element) =>
            element?.classList.contains('retro-caps') === true &&
            element.textContent === 'Dialogue / Turns: 7'
        )
      ).toBeTruthy();
    });

    it('does not infer a dialogue turn count from a legacy title', () => {
      mockUseLibraryData.mockReturnValue(
        createMockLibraryData({
          episodes: [createDialogueEpisode({ title: 'Hokkaido Food Trip' })],
        })
      );

      renderLibraryPage();

      expect(
        screen.getByText(
          (_content, element) =>
            element?.classList.contains('retro-caps') === true &&
            element.textContent === 'Dialogue / Turns: 0'
        )
      ).toBeTruthy();
    });
  });

  describe('Responsive design', () => {
    it('should render the v3 shell/body structure', () => {
      const { container } = renderLibraryPage();

      const shell = container.querySelector('.retro-library-v3-shell');
      const body = container.querySelector('.retro-library-v3-body');
      expect(shell).toBeTruthy();
      expect(body).toBeTruthy();
    });

    it('should show empty state and no library items when content is empty', () => {
      const { container } = renderLibraryPage();

      const emptyStateWrapper = container.querySelector('.retro-library-v3-empty');
      expect(emptyStateWrapper).toBeTruthy();
      expect(screen.queryByTestId('library-item')).toBeNull();
    });
  });
});
