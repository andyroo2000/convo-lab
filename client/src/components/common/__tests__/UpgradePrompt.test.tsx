/* eslint-disable testing-library/no-node-access, testing-library/no-container */
// Testing modal visibility and structure requires direct node access
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import UpgradePrompt from '../UpgradePrompt';

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock AuthContext
let mockUser: // eslint-disable-next-line @typescript-eslint/no-explicit-any
any = { id: '1', tier: 'free' };
vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
  }),
}));

function renderWithRouter(props = {}) {
  return render(
    <MemoryRouter>
      <UpgradePrompt {...props} />
    </MemoryRouter>
  );
}

describe('UpgradePrompt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: '1', tier: 'free' };
  });

  describe('Rendering', () => {
    it('should render upgrade prompt modal', () => {
      renderWithRouter();

      expect(screen.getByText(/Quota Limit Reached/i)).toBeInTheDocument();
    });

    it('should display quota usage when provided', () => {
      renderWithRouter({ quotaUsed: 5, quotaLimit: 5 });

      expect(screen.getByText(/You've used 5 of 5 generations/)).toBeInTheDocument();
    });

    it('should not display quota usage when not provided', () => {
      renderWithRouter();

      expect(screen.queryByText(/You've used/)).not.toBeInTheDocument();
    });

    it('should render close button when onClose provided', () => {
      const onClose = vi.fn();
      renderWithRouter({ onClose });

      const closeButton = screen.getByLabelText('Close');
      expect(closeButton).toBeInTheDocument();
    });

    it('should not render close button when onClose not provided', () => {
      renderWithRouter();

      const closeButton = screen.queryByLabelText('Close');
      expect(closeButton).not.toBeInTheDocument();
    });
  });

  describe('Free Tier User', () => {
    beforeEach(() => {
      mockUser = { id: '1', tier: 'free' };
    });

    it('should show upgrade message for free users', () => {
      renderWithRouter();

      expect(screen.getByText(/You've reached your free tier lifetime limit/i)).toBeInTheDocument();
      expect(screen.getAllByText(/Upgrade to Pro/i).length).toBeGreaterThan(0);
    });

    it('should display Pro plan features', () => {
      renderWithRouter();

      expect(screen.getByText(/Pro Plan - \$10\/month/i)).toBeInTheDocument();
      // Features show as translation keys when i18n isn't fully set up in tests
      expect(screen.getByText(/30 generations per month/i)).toBeInTheDocument();
      expect(screen.getByText(/All content types included/i)).toBeInTheDocument();
      expect(screen.getByText(/High-quality Google Cloud TTS/i)).toBeInTheDocument();
      expect(screen.getByText(/Priority support/i)).toBeInTheDocument();
    });

    it('should show upgrade button for free users', () => {
      renderWithRouter();

      const upgradeButton = screen.getByRole('button', { name: /Upgrade to Pro/i });
      expect(upgradeButton).toBeInTheDocument();
    });

    it('should navigate to pricing page when upgrade clicked', () => {
      const onClose = vi.fn();
      renderWithRouter({ onClose });

      const upgradeButton = screen.getByRole('button', { name: /Upgrade to Pro/i });
      fireEvent.click(upgradeButton);

      expect(mockNavigate).toHaveBeenCalledWith('/pricing');
      expect(onClose).toHaveBeenCalled();
    });

    it('should show maybe later button when onClose provided', () => {
      const onClose = vi.fn();
      renderWithRouter({ onClose });

      const maybeLaterButton = screen.getByRole('button', { name: /Maybe Later/i });
      expect(maybeLaterButton).toBeInTheDocument();
    });

    it('should call onClose when maybe later clicked', () => {
      const onClose = vi.fn();
      renderWithRouter({ onClose });

      const maybeLaterButton = screen.getByRole('button', { name: /Maybe Later/i });
      fireEvent.click(maybeLaterButton);

      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('Pro Tier User', () => {
    beforeEach(() => {
      mockUser = { id: '1', tier: 'pro' };
    });

    it('should show quota reset message for pro users', () => {
      renderWithRouter();

      expect(screen.getByText(/You've reached your monthly generation limit/i)).toBeInTheDocument();
    });

    it('should show view billing button for pro users', () => {
      renderWithRouter();

      const billingButton = screen.getByRole('button', { name: /View Billing Settings/i });
      expect(billingButton).toBeInTheDocument();
    });

    it('should navigate to billing settings when view billing clicked', () => {
      const onClose = vi.fn();
      renderWithRouter({ onClose });

      const billingButton = screen.getByRole('button', { name: /View Billing Settings/i });
      fireEvent.click(billingButton);

      expect(mockNavigate).toHaveBeenCalledWith('/app/settings/billing');
      expect(onClose).toHaveBeenCalled();
    });

    it('should not show upgrade to pro features for pro users', () => {
      renderWithRouter();

      expect(screen.queryByText(/Pro Plan - \$10\/month/i)).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Upgrade to Pro/i })).not.toBeInTheDocument();
    });
  });

  describe('Close Functionality', () => {
    it('should call onClose when close button clicked', () => {
      const onClose = vi.fn();
      renderWithRouter({ onClose });

      const closeButton = screen.getByLabelText('Close');
      fireEvent.click(closeButton);

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose after upgrade button click', () => {
      const onClose = vi.fn();
      mockUser = { id: '1', tier: 'free' };
      renderWithRouter({ onClose });

      const upgradeButton = screen.getByRole('button', { name: /Upgrade to Pro/i });
      fireEvent.click(upgradeButton);

      expect(onClose).toHaveBeenCalled();
    });

    it('should call onClose after view billing click', () => {
      const onClose = vi.fn();
      mockUser = { id: '1', tier: 'pro' };
      renderWithRouter({ onClose });

      const billingButton = screen.getByRole('button', { name: /View Billing Settings/i });
      fireEvent.click(billingButton);

      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('UI Elements', () => {
    it('should render Zap icon', () => {
      renderWithRouter();

      const zapIcon = document.querySelector('svg');
      expect(zapIcon).toBeInTheDocument();
    });

    it('should render with gradient header', () => {
      const { container } = renderWithRouter();

      const header = container.querySelector('.bg-gradient-to-r');
      expect(header).toBeInTheDocument();
      expect(header).toHaveClass('from-periwinkle', 'to-dark-periwinkle');
    });

    it('should render Check icons for pro features', () => {
      mockUser = { id: '1', tier: 'free' };
      renderWithRouter();

      const checkIcons = document.querySelectorAll('.text-green-500');
      expect(checkIcons.length).toBeGreaterThan(0);
    });

    it('should have modal overlay', () => {
      renderWithRouter();

      const overlay = screen.getByText(/Quota Limit Reached/i).closest('.fixed');
      expect(overlay).toHaveClass('bg-black', 'bg-opacity-50');
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined user gracefully', () => {
      mockUser = null;
      renderWithRouter();

      // Should still render the modal
      expect(screen.getByText(/Quota Limit Reached/i)).toBeInTheDocument();
    });

    it('should handle zero quota values', () => {
      renderWithRouter({ quotaUsed: 0, quotaLimit: 0 });

      expect(screen.getByText(/You've used 0 of 0 generations/)).toBeInTheDocument();
    });

    it('should handle large quota values', () => {
      renderWithRouter({ quotaUsed: 999, quotaLimit: 1000 });

      expect(screen.getByText(/You've used 999 of 1000 generations/)).toBeInTheDocument();
    });

    it('should not call onClose when not provided', () => {
      mockUser = { id: '1', tier: 'free' };
      renderWithRouter(); // No onClose prop

      const upgradeButton = screen.getByRole('button', { name: /Upgrade to Pro/i });

      // Should not throw error
      expect(() => fireEvent.click(upgradeButton)).not.toThrow();
      expect(mockNavigate).toHaveBeenCalled();
    });
  });
});
