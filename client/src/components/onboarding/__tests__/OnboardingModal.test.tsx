import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import OnboardingModal from '../OnboardingModal';

// Mock AuthContext
const mockUpdateUser = vi.fn();
vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1', preferredStudyLanguage: 'ja' },
    updateUser: mockUpdateUser,
  }),
}));

describe('OnboardingModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateUser.mockResolvedValue(undefined);
  });

  describe('Rendering', () => {
    it('should render modal with welcome message', () => {
      render(<OnboardingModal />);

      expect(screen.getByText(/Welcome to ConvoLab!/)).toBeInTheDocument();
    });

    it('should render step 1 initially', () => {
      render(<OnboardingModal />);

      expect(screen.getByText(/What language are you learning?/)).toBeInTheDocument();
    });

    it('should render Japanese and Chinese language options', () => {
      render(<OnboardingModal />);

      expect(screen.getByText('Japanese')).toBeInTheDocument();
      expect(screen.getByText('Chinese')).toBeInTheDocument();
      expect(screen.getByText('日本語')).toBeInTheDocument();
      expect(screen.getByText('中文')).toBeInTheDocument();
    });

    it('should render Next button on step 1', () => {
      render(<OnboardingModal />);

      expect(screen.getByText('Next →')).toBeInTheDocument();
    });

    it('should render progress indicator', () => {
      render(<OnboardingModal />);

      // Two progress dots
      const progressDots = document.querySelectorAll('.h-2.w-24.rounded-full');
      expect(progressDots).toHaveLength(2);
    });
  });

  describe('Language Selection', () => {
    it('should have Japanese selected by default', () => {
      render(<OnboardingModal />);

      const japaneseButton = screen.getByText('Japanese').closest('button');
      expect(japaneseButton).toHaveClass('border-indigo-600');
    });

    it('should select Chinese when clicked', () => {
      render(<OnboardingModal />);

      const chineseButton = screen.getByText('Chinese').closest('button');
      fireEvent.click(chineseButton!);

      expect(chineseButton).toHaveClass('border-indigo-600');
    });

    it('should deselect Japanese when Chinese is selected', () => {
      render(<OnboardingModal />);

      const chineseButton = screen.getByText('Chinese').closest('button');
      fireEvent.click(chineseButton!);

      const japaneseButton = screen.getByText('Japanese').closest('button');
      expect(japaneseButton).not.toHaveClass('border-indigo-600');
    });
  });

  describe('Step Navigation', () => {
    it('should navigate to step 2 on Next click', () => {
      render(<OnboardingModal />);

      fireEvent.click(screen.getByText('Next →'));

      expect(screen.getByText(/What's your current JLPT level?/)).toBeInTheDocument();
    });

    it('should navigate back to step 1 on Back click', () => {
      render(<OnboardingModal />);

      fireEvent.click(screen.getByText('Next →'));
      fireEvent.click(screen.getByText('← Back'));

      expect(screen.getByText(/What language are you learning?/)).toBeInTheDocument();
    });

    it('should show Get Started button on step 2', () => {
      render(<OnboardingModal />);

      fireEvent.click(screen.getByText('Next →'));

      expect(screen.getByText('Get Started')).toBeInTheDocument();
    });
  });

  describe('JLPT Levels (Japanese)', () => {
    beforeEach(() => {
      render(<OnboardingModal />);
      fireEvent.click(screen.getByText('Next →'));
    });

    it('should show all JLPT levels', () => {
      expect(screen.getByText('N5 (Beginner)')).toBeInTheDocument();
      expect(screen.getByText('N4 (Upper Beginner)')).toBeInTheDocument();
      expect(screen.getByText('N3 (Intermediate)')).toBeInTheDocument();
      expect(screen.getByText('N2 (Upper Intermediate)')).toBeInTheDocument();
      expect(screen.getByText('N1 (Advanced)')).toBeInTheDocument();
    });

    it('should have N5 selected by default', () => {
      const n5Button = screen.getByText('N5 (Beginner)').closest('button');
      expect(n5Button).toHaveClass('border-indigo-600');
    });

    it('should select N3 when clicked', () => {
      const n3Button = screen.getByText('N3 (Intermediate)').closest('button');
      fireEvent.click(n3Button!);

      expect(n3Button).toHaveClass('border-indigo-600');
    });
  });

  describe('HSK Levels (Chinese)', () => {
    beforeEach(() => {
      render(<OnboardingModal />);
      fireEvent.click(screen.getByText('Chinese').closest('button')!);
      fireEvent.click(screen.getByText('Next →'));
    });

    it('should show HSK heading', () => {
      expect(screen.getByText(/What's your current HSK level?/)).toBeInTheDocument();
    });

    it('should show all HSK levels', () => {
      expect(screen.getByText('HSK 1 (Beginner)')).toBeInTheDocument();
      expect(screen.getByText('HSK 2 (Upper Beginner)')).toBeInTheDocument();
      expect(screen.getByText('HSK 3 (Intermediate)')).toBeInTheDocument();
      expect(screen.getByText('HSK 4 (Upper Intermediate)')).toBeInTheDocument();
      expect(screen.getByText('HSK 5 (Advanced)')).toBeInTheDocument();
      expect(screen.getByText('HSK 6 (Mastery)')).toBeInTheDocument();
    });

    it('should have HSK1 selected by default', () => {
      const hsk1Button = screen.getByText('HSK 1 (Beginner)').closest('button');
      expect(hsk1Button).toHaveClass('border-indigo-600');
    });
  });

  describe('Form Submission', () => {
    it('should call updateUser on Get Started click', async () => {
      render(<OnboardingModal />);

      fireEvent.click(screen.getByText('Next →'));
      fireEvent.click(screen.getByText('Get Started'));

      await waitFor(() => {
        expect(mockUpdateUser).toHaveBeenCalledWith({
          preferredStudyLanguage: 'ja',
          proficiencyLevel: 'N5',
          onboardingCompleted: true,
        });
      });
    });

    it('should submit with correct HSK level for Chinese', async () => {
      render(<OnboardingModal />);

      fireEvent.click(screen.getByText('Chinese').closest('button')!);
      fireEvent.click(screen.getByText('Next →'));
      fireEvent.click(screen.getByText('HSK 3 (Intermediate)').closest('button')!);
      fireEvent.click(screen.getByText('Get Started'));

      await waitFor(() => {
        expect(mockUpdateUser).toHaveBeenCalledWith({
          preferredStudyLanguage: 'zh',
          proficiencyLevel: 'HSK3',
          onboardingCompleted: true,
        });
      });
    });

    it('should show Saving... during submission', async () => {
      mockUpdateUser.mockImplementation(() => new Promise(() => {}));

      render(<OnboardingModal />);

      fireEvent.click(screen.getByText('Next →'));
      fireEvent.click(screen.getByText('Get Started'));

      await waitFor(() => {
        expect(screen.getByText('Saving...')).toBeInTheDocument();
      });
    });

    it('should disable buttons during submission', async () => {
      mockUpdateUser.mockImplementation(() => new Promise(() => {}));

      render(<OnboardingModal />);

      fireEvent.click(screen.getByText('Next →'));
      fireEvent.click(screen.getByText('Get Started'));

      await waitFor(() => {
        expect(screen.getByText('Saving...')).toBeDisabled();
        expect(screen.getByText('← Back')).toBeDisabled();
      });
    });
  });

  describe('Error Handling', () => {
    it('should show alert on update failure', async () => {
      const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});
      mockUpdateUser.mockRejectedValue(new Error('Network error'));

      render(<OnboardingModal />);

      fireEvent.click(screen.getByText('Next →'));
      fireEvent.click(screen.getByText('Get Started'));

      await waitFor(() => {
        expect(alertMock).toHaveBeenCalledWith('Failed to save preferences. Please try again.');
      });

      alertMock.mockRestore();
    });

    it('should re-enable buttons after error', async () => {
      mockUpdateUser.mockRejectedValue(new Error('Network error'));

      render(<OnboardingModal />);

      fireEvent.click(screen.getByText('Next →'));
      fireEvent.click(screen.getByText('Get Started'));

      await waitFor(() => {
        expect(screen.getByText('Get Started')).not.toBeDisabled();
        expect(screen.getByText('← Back')).not.toBeDisabled();
      });
    });
  });

  describe('Level Descriptions', () => {
    it('should show description for JLPT levels', () => {
      render(<OnboardingModal />);
      fireEvent.click(screen.getByText('Next →'));

      expect(screen.getByText('Basic grammar and around 800 vocabulary words')).toBeInTheDocument();
      expect(screen.getByText('Can understand complex topics and nuanced expressions')).toBeInTheDocument();
    });

    it('should show description for HSK levels', () => {
      render(<OnboardingModal />);
      fireEvent.click(screen.getByText('Chinese').closest('button')!);
      fireEvent.click(screen.getByText('Next →'));

      expect(screen.getByText('Can understand and use very simple phrases')).toBeInTheDocument();
      expect(screen.getByText('Can easily comprehend and express yourself in Chinese')).toBeInTheDocument();
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
