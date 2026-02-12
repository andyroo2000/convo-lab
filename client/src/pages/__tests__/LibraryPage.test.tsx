/* eslint-disable testing-library/no-node-access, testing-library/no-container */
// Complex library page testing with dynamic content requires direct node access
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import LibraryPage from '../LibraryPage';

const mockUpdateUser = vi.fn();
const mockUser = {
  id: 'user-1',
  name: 'Test User',
  email: 'test@example.com',
  onboardingCompleted: false,
  seenSampleContentGuide: false,
  preferredStudyLanguage: 'ja',
  preferredNativeLanguage: 'en',
};

// Mock hooks
vi.mock('../../hooks/useLibraryData', () => ({
  useLibraryData: () => ({
    episodes: [],
    courses: [],
    isLoading: false,
    error: null,
    deleteEpisode: vi.fn(),
    deleteCourse: vi.fn(),
    isDeletingEpisode: false,
    isDeletingCourse: false,
  }),
}));

vi.mock('../../hooks/useDemo', () => ({
  useIsDemo: () => false,
}));

vi.mock('../../hooks/useFeatureFlags', () => ({
  useFeatureFlags: () => ({
    flags: {
      dialoguesEnabled: true,
      audioCourseEnabled: true,
    },
    isLoading: false,
    error: null,
    isFeatureEnabled: () => true,
    isAdmin: false,
  }),
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    updateUser: mockUpdateUser,
  }),
}));

// Mock EmptyStateCard component
vi.mock('../../components/EmptyStateCard', () => ({
  default: ({ title }: { title: string }) => <div data-testid="empty-state-card">{title}</div>,
}));

// Mock other components
vi.mock('../../components/common/ConfirmModal', () => ({
  default: () => null,
}));

vi.mock('../../components/common/LanguageLevelPill', () => ({
  default: () => null,
}));

vi.mock('../../components/common/LanguageLevelSidebar', () => ({
  default: () => null,
}));

vi.mock('../../components/common/Pill', () => ({
  default: () => null,
}));

describe('LibraryPage', () => {
  const renderLibraryPage = () =>
    render(
      <BrowserRouter>
        <LibraryPage />
      </BrowserRouter>
    );

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
      expect(screen.getByTestId('library-filter-courses')).toBeTruthy();
    });

    it('should default to all content filter selected', () => {
      renderLibraryPage();

      const allButton = screen.getByTestId('library-filter-all');
      expect(allButton).toHaveClass('is-active');
      expect(allButton).toHaveAttribute('aria-pressed', 'true');
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
  });

  describe('Content rendering', () => {
    it('should render filter buttons with correct styling', () => {
      renderLibraryPage();

      const dialoguesButton = screen.getByTestId('library-filter-dialogues');
      expect(dialoguesButton).toHaveClass('retro-library-v3-filter');
    });

    it('should display empty state message when no content exists', () => {
      renderLibraryPage();

      const emptyMessage = screen.getByText(/No content yet/i);
      expect(emptyMessage).toBeTruthy();
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
