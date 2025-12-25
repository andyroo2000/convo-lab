import { describe, it, expect, vi, beforeEach } from 'vitest';
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
    // Mock window.alert for jsdom
    vi.spyOn(window, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Rendering', () => {
    it('should render modal with welcome message', () => {
      render(<OnboardingModal />);

      expect(screen.getByText(/Welcome to ConvoLab!/)).toBeInTheDocument();
    });

    it('should render step 1 initially', () => {
      render(<OnboardingModal />);

      // Step 1 asks for native language
      expect(screen.getByText(/What's your native language?/i)).toBeInTheDocument();
    });

    it('should render Next button on step 1', () => {
      render(<OnboardingModal />);

      expect(screen.getByText('Next →')).toBeInTheDocument();
    });

    it('should render progress indicator with 3 steps', () => {
      render(<OnboardingModal />);

      // Three progress dots for 3 steps
      const progressDots = document.querySelectorAll('.h-2.w-24.rounded-full');
      expect(progressDots).toHaveLength(3);
    });
  });

  describe('Language Selection', () => {
    it('should have English selected by default as native language', () => {
      render(<OnboardingModal />);

      const englishButton = screen.getByText('English').closest('button');
      expect(englishButton).toHaveClass('border-indigo-600');
    });

    it('should navigate to step 2 on Next click', () => {
      render(<OnboardingModal />);

      fireEvent.click(screen.getByText('Next →'));

      // Step 2 asks for target language
      expect(screen.getByText(/What language are you learning?/i)).toBeInTheDocument();
    });

    it('should navigate back to step 1 on Back click', () => {
      render(<OnboardingModal />);

      fireEvent.click(screen.getByText('Next →'));
      fireEvent.click(screen.getByText('← Back'));

      expect(screen.getByText(/What's your native language?/i)).toBeInTheDocument();
    });
  });

  describe('Step Navigation', () => {
    it('should show target language selection on step 2', () => {
      render(<OnboardingModal />);

      fireEvent.click(screen.getByText('Next →'));

      expect(screen.getByText(/What language are you learning?/i)).toBeInTheDocument();
    });

    it('should show proficiency level selection on step 3', () => {
      render(<OnboardingModal />);

      // Navigate to step 2
      fireEvent.click(screen.getByText('Next →'));

      // Navigate to step 3
      fireEvent.click(screen.getByText('Next →'));

      expect(screen.getByText(/What's your proficiency level?/i)).toBeInTheDocument();
    });

    it('should show Get Started button on step 3', () => {
      render(<OnboardingModal />);

      // Navigate to step 3
      fireEvent.click(screen.getByText('Next →'));
      fireEvent.click(screen.getByText('Next →'));

      expect(screen.getByText('Get Started')).toBeInTheDocument();
    });
  });

  describe('Form Submission', () => {
    it('should call updateUser on Get Started click', async () => {
      render(<OnboardingModal />);

      // Navigate through all steps
      fireEvent.click(screen.getByText('Next →')); // to step 2
      fireEvent.click(screen.getByText('Next →')); // to step 3
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

    it('should show Loading... during submission', async () => {
      // Use a long-delayed promise instead of one that never resolves
      mockUpdateUser.mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 10000)));

      render(<OnboardingModal />);

      fireEvent.click(screen.getByText('Next →'));
      fireEvent.click(screen.getByText('Next →'));
      fireEvent.click(screen.getByText('Get Started'));

      await waitFor(() => {
        expect(screen.getByText('Loading...')).toBeInTheDocument();
      });
    });

    it('should disable buttons during submission', async () => {
      // Use a long-delayed promise instead of one that never resolves
      mockUpdateUser.mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 10000)));

      render(<OnboardingModal />);

      fireEvent.click(screen.getByText('Next →'));
      fireEvent.click(screen.getByText('Next →'));
      fireEvent.click(screen.getByText('Get Started'));

      await waitFor(() => {
        expect(screen.getByText('Loading...')).toBeDisabled();
        expect(screen.getByText('← Back')).toBeDisabled();
      });
    });
  });

  describe('Error Handling', () => {
    it('should show alert on update failure', async () => {
      mockUpdateUser.mockRejectedValue(new Error('Network error'));

      render(<OnboardingModal />);

      fireEvent.click(screen.getByText('Next →'));
      fireEvent.click(screen.getByText('Next →'));
      fireEvent.click(screen.getByText('Get Started'));

      await waitFor(() => {
        expect(window.alert).toHaveBeenCalledWith('Failed to save preferences. Please try again.');
      });
    });

    it('should re-enable buttons after error', async () => {
      mockUpdateUser.mockRejectedValue(new Error('Network error'));

      render(<OnboardingModal />);

      fireEvent.click(screen.getByText('Next →'));
      fireEvent.click(screen.getByText('Next →'));
      fireEvent.click(screen.getByText('Get Started'));

      await waitFor(() => {
        expect(screen.getByText('Get Started')).not.toBeDisabled();
        expect(screen.getByText('← Back')).not.toBeDisabled();
      });
    });
  });

  describe('Modal Structure', () => {
    it('should render as fixed overlay', () => {
      render(<OnboardingModal />);

      const overlay = screen.getByText(/Welcome to ConvoLab!/).closest('.fixed');
      expect(overlay).toHaveClass('inset-0');
    });

    it('should have proper z-index', () => {
      render(<OnboardingModal />);

      const overlay = screen.getByText(/Welcome to ConvoLab!/).closest('.fixed');
      expect(overlay).toHaveClass('z-50');
    });
  });
});
