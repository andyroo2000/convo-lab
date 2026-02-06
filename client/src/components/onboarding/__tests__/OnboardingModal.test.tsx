/* eslint-disable testing-library/no-node-access */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import OnboardingModal from '../OnboardingModal';

// Mock AuthContext
const mockUpdateUser = vi.fn();
vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1', preferredStudyLanguage: 'ja', preferredNativeLanguage: 'en' },
    updateUser: mockUpdateUser,
  }),
}));

describe('OnboardingModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateUser.mockResolvedValue(undefined);
    vi.spyOn(window, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Rendering', () => {
    it('should render welcome message', () => {
      render(<OnboardingModal />);
      expect(screen.getByText(/Welcome to ConvoLab!/)).toBeInTheDocument();
    });

    it('should show all JLPT levels', () => {
      render(<OnboardingModal />);
      expect(screen.getByText('N5 (Beginner)')).toBeInTheDocument();
      expect(screen.getByText('N4 (Upper Beginner)')).toBeInTheDocument();
      expect(screen.getByText('N3 (Intermediate)')).toBeInTheDocument();
      expect(screen.getByText('N2 (Upper Intermediate)')).toBeInTheDocument();
      expect(screen.getByText('N1 (Advanced)')).toBeInTheDocument();
    });

    it('should have N5 selected by default', () => {
      render(<OnboardingModal />);
      const n5Button = screen.getByText('N5 (Beginner)').closest('button');
      expect(n5Button?.className).toContain('border-coral');
    });

    it('should render as fixed overlay with z-50', () => {
      render(<OnboardingModal />);
      const overlay = screen.getByText(/Welcome to ConvoLab!/).closest('.fixed');
      expect(overlay).toHaveClass('inset-0');
      expect(overlay).toHaveClass('z-50');
    });
  });

  describe('Level Selection', () => {
    it('should change selection when clicking a different level', () => {
      render(<OnboardingModal />);

      fireEvent.click(screen.getByText('N3 (Intermediate)'));

      const n3Button = screen.getByText('N3 (Intermediate)').closest('button');
      expect(n3Button?.className).toContain('border-coral');

      const n5Button = screen.getByText('N5 (Beginner)').closest('button');
      expect(n5Button?.className).not.toContain('border-coral');
    });
  });

  describe('Form Submission', () => {
    it('should call updateUser with default N5 on Get Started click', async () => {
      render(<OnboardingModal />);

      fireEvent.click(screen.getByText('Get Started'));

      await waitFor(() => {
        expect(mockUpdateUser).toHaveBeenCalledWith({
          preferredNativeLanguage: 'en',
          preferredStudyLanguage: 'ja',
          proficiencyLevel: 'N5',
          onboardingCompleted: true,
        });
      });
    });

    it('should call updateUser with selected level', async () => {
      render(<OnboardingModal />);

      fireEvent.click(screen.getByText('N3 (Intermediate)'));
      fireEvent.click(screen.getByText('Get Started'));

      await waitFor(() => {
        expect(mockUpdateUser).toHaveBeenCalledWith({
          preferredNativeLanguage: 'en',
          preferredStudyLanguage: 'ja',
          proficiencyLevel: 'N3',
          onboardingCompleted: true,
        });
      });
    });
  });

  describe('Loading State', () => {
    it('should show Loading... during submission', async () => {
      mockUpdateUser.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(resolve, 10000);
          })
      );

      render(<OnboardingModal />);
      fireEvent.click(screen.getByText('Get Started'));

      await waitFor(() => {
        expect(screen.getByText('Loading...')).toBeInTheDocument();
      });
    });

    it('should disable button during submission', async () => {
      mockUpdateUser.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(resolve, 10000);
          })
      );

      render(<OnboardingModal />);
      fireEvent.click(screen.getByText('Get Started'));

      await waitFor(() => {
        expect(screen.getByText('Loading...')).toBeDisabled();
      });
    });
  });

  describe('Error Handling', () => {
    it('should show alert on update failure', async () => {
      mockUpdateUser.mockRejectedValue(new Error('Network error'));

      render(<OnboardingModal />);
      fireEvent.click(screen.getByText('Get Started'));

      await waitFor(() => {
        expect(window.alert).toHaveBeenCalledWith('Failed to save preferences. Please try again.');
      });
    });

    it('should re-enable button after error', async () => {
      mockUpdateUser.mockRejectedValue(new Error('Network error'));

      render(<OnboardingModal />);
      fireEvent.click(screen.getByText('Get Started'));

      await waitFor(() => {
        expect(screen.getByText('Get Started')).not.toBeDisabled();
      });
    });
  });
});
