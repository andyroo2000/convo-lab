/* eslint-disable testing-library/no-node-access, testing-library/no-container */
// Complex page testing with multiple card elements requires direct node access
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import CreatePage from '../CreatePage';

const mockNavigate = vi.fn();
const mockUpdateUser = vi.fn();
const mockUser = {
  id: 'user-1',
  name: 'Test User',
  email: 'test@example.com',
  onboardingCompleted: false,
  seenCustomContentGuide: false,
  preferredStudyLanguage: 'ja',
  preferredNativeLanguage: 'en',
};

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

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

describe('CreatePage', () => {
  const renderCreatePage = () =>
    render(
      <BrowserRouter>
        <CreatePage />
      </BrowserRouter>
    );

  beforeEach(() => {
    mockNavigate.mockClear();
  });

  describe('Poster layout', () => {
    it('should render the v3 create shell', () => {
      const { container } = renderCreatePage();

      const shell = container.querySelector('.retro-create-v3-shell');
      expect(shell).toBeTruthy();
    });

    it('should render v3 title and footer blocks', () => {
      const { container } = renderCreatePage();

      const title = container.querySelector('.retro-create-v3-title');
      const footerText = container.querySelector('.retro-create-v3-footer');
      expect(title).toBeTruthy();
      expect(footerText).toBeTruthy();
    });
  });

  describe('Card rendering', () => {
    it('should render cards grid', () => {
      const { container } = renderCreatePage();

      const cardsContainer = container.querySelector('.retro-create-v3-grid');
      expect(cardsContainer).toBeTruthy();
    });

    it('should render all content type cards', () => {
      renderCreatePage();

      expect(screen.getByTestId('create-card-dialogues')).toBeTruthy();
    });
  });

  describe('Content rendering', () => {
    it('should render page title', () => {
      renderCreatePage();

      expect(screen.getByText('What do you want to create?')).toBeTruthy();
    });

    it('should render page description', () => {
      renderCreatePage();

      expect(screen.getByText('Choose an activity type to get started')).toBeTruthy();
    });

    it('should render footer text', () => {
      renderCreatePage();

      expect(screen.getByText(/Experiment, iterate, and discover/i)).toBeTruthy();
    });
  });

  describe('Navigation', () => {
    it('should navigate to dialogue creation on click', () => {
      renderCreatePage();

      const dialogueCard = screen.getByTestId('create-card-dialogues');
      fireEvent.click(dialogueCard);

      expect(mockNavigate).toHaveBeenCalledWith('/app/create/dialogue');
    });
  });

  describe('Card structure', () => {
    it('should render cards with v3 card class', () => {
      renderCreatePage();

      const dialogueCard = screen.getByTestId('create-card-dialogues');
      expect(dialogueCard).toHaveClass('retro-create-v3-card');
    });

    it('should have v3 card body structure', () => {
      const { container } = renderCreatePage();

      const cardContent = container.querySelector(
        '[data-testid="create-card-dialogues"] .retro-create-v3-card-body'
      );
      expect(cardContent).toBeTruthy();
    });
  });

  describe('Responsive design', () => {
    it('should use styled title class', () => {
      renderCreatePage();

      const title = screen.getByText('What do you want to create?');
      expect(title).toHaveClass('retro-create-v3-title');
    });

    it('should use styled footer class', () => {
      renderCreatePage();

      const footer = screen.getByText(/Experiment, iterate/i);
      expect(footer).toHaveClass('retro-create-v3-footer');
    });
  });
});
