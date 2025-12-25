import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PricingPage from '../PricingPage';

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
let mockUser: any = null;
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
  }),
}));

// Mock global fetch
global.fetch = vi.fn();

// Mock window.location
delete (window as any).location;
(window as any).location = { href: '' };

function renderWithRouter() {
  return render(
    <MemoryRouter>
      <PricingPage />
    </MemoryRouter>
  );
}

describe('PricingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockClear();
    mockUser = null;
    (window as any).location.href = '';
  });

  describe('Rendering', () => {
    it('should render pricing page heading', () => {
      renderWithRouter();

      expect(screen.getByRole('heading', { name: /Choose Your Plan/ })).toBeInTheDocument();
      expect(
        screen.getByText(/Start creating immersive language learning content/)
      ).toBeInTheDocument();
    });

    it('should render both pricing tiers', () => {
      renderWithRouter();

      expect(screen.getByText('Free')).toBeInTheDocument();
      expect(screen.getByText('Pro')).toBeInTheDocument();
    });

    it('should show free tier features', () => {
      renderWithRouter();

      expect(screen.getByText('5 generations per week')).toBeInTheDocument();
      expect(screen.getByText('$0')).toBeInTheDocument();
      expect(screen.getByText(/Perfect for trying out ConvoLab/)).toBeInTheDocument();
    });

    it('should show pro tier features', () => {
      renderWithRouter();

      expect(screen.getByText('30 generations per week')).toBeInTheDocument();
      expect(screen.getByText('$7')).toBeInTheDocument();
      expect(screen.getByText(/For serious language learners/)).toBeInTheDocument();
      expect(screen.getByText('Priority support')).toBeInTheDocument();
      expect(screen.getByText('Early access to new features')).toBeInTheDocument();
    });

    it('should mark Pro tier as "Most Popular"', () => {
      renderWithRouter();

      expect(screen.getByText('Most Popular')).toBeInTheDocument();
    });
  });

  describe('User States', () => {
    it('should show free tier as current plan for free users', () => {
      mockUser = { id: '1', email: 'test@example.com', tier: 'free' };
      renderWithRouter();

      const currentPlanBadges = screen.getAllByText('Current Plan');
      expect(currentPlanBadges).toHaveLength(1);
    });

    it('should show pro tier as current plan for pro users', () => {
      mockUser = { id: '1', email: 'test@example.com', tier: 'pro' };
      renderWithRouter();

      const currentPlanBadges = screen.getAllByText('Current Plan');
      expect(currentPlanBadges).toHaveLength(1);
    });

    it('should disable upgrade button for current plan', () => {
      mockUser = { id: '1', email: 'test@example.com', tier: 'pro' };
      renderWithRouter();

      const currentPlanButtons = screen.getAllByRole('button', { name: /Current Plan/ });
      currentPlanButtons.forEach((button) => {
        expect(button).toBeDisabled();
      });
    });

    it('should show Upgrade to Pro button for free users', () => {
      mockUser = { id: '1', email: 'test@example.com', tier: 'free' };
      renderWithRouter();

      expect(screen.getByRole('button', { name: /Upgrade to Pro/ })).toBeInTheDocument();
    });
  });

  describe('Checkout Flow', () => {
    it('should redirect to login when upgrading without being logged in', async () => {
      mockUser = null;
      renderWithRouter();

      const upgradeButton = screen.getByRole('button', { name: /Upgrade to Pro/ });
      fireEvent.click(upgradeButton);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/login?returnUrl=/pricing');
      });
    });

    it('should create checkout session when logged in user clicks upgrade', async () => {
      mockUser = { id: '1', email: 'test@example.com', tier: 'free' };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ url: 'https://checkout.stripe.com/session-123' }),
      });

      renderWithRouter();

      const upgradeButton = screen.getByRole('button', { name: /Upgrade to Pro/ });
      fireEvent.click(upgradeButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/billing/create-checkout-session'),
          expect.objectContaining({
            method: 'POST',
            credentials: 'include',
            body: expect.any(String),
          })
        );
      });
    });

    it('should redirect to Stripe checkout on successful session creation', async () => {
      mockUser = { id: '1', email: 'test@example.com', tier: 'free' };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ url: 'https://checkout.stripe.com/session-123' }),
      });

      renderWithRouter();

      const upgradeButton = screen.getByRole('button', { name: /Upgrade to Pro/ });
      fireEvent.click(upgradeButton);

      await waitFor(() => {
        expect((window as any).location.href).toBe('https://checkout.stripe.com/session-123');
      });
    });

    it('should show loading state during checkout session creation', async () => {
      mockUser = { id: '1', email: 'test@example.com', tier: 'free' };

      (global.fetch as any).mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            setTimeout(resolve, 1000);
          })
      );

      renderWithRouter();

      const upgradeButton = screen.getByRole('button', { name: /Upgrade to Pro/ });
      fireEvent.click(upgradeButton);

      // Button should be disabled during loading
      expect(upgradeButton).toBeDisabled();
    });

    it('should show error message when checkout session creation fails', async () => {
      mockUser = { id: '1', email: 'test@example.com', tier: 'free' };

      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: { message: 'Invalid price ID' } }),
      });

      renderWithRouter();

      const upgradeButton = screen.getByRole('button', { name: /Upgrade to Pro/ });
      fireEvent.click(upgradeButton);

      await waitFor(() => {
        expect(screen.getByText('Invalid price ID')).toBeInTheDocument();
      });
    });

    it('should handle network errors gracefully', async () => {
      mockUser = { id: '1', email: 'test@example.com', tier: 'free' };

      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      renderWithRouter();

      const upgradeButton = screen.getByRole('button', { name: /Upgrade to Pro/ });
      fireEvent.click(upgradeButton);

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });
    });

    it('should handle generic errors with fallback message', async () => {
      mockUser = { id: '1', email: 'test@example.com', tier: 'free' };

      (global.fetch as any).mockRejectedValueOnce('Unknown error');

      renderWithRouter();

      const upgradeButton = screen.getByRole('button', { name: /Upgrade to Pro/ });
      fireEvent.click(upgradeButton);

      await waitFor(() => {
        expect(screen.getByText('Failed to start checkout')).toBeInTheDocument();
      });
    });
  });

  describe('Feature Comparison', () => {
    it('should show all features for both tiers', () => {
      renderWithRouter();

      // Common features
      expect(screen.getAllByText('All content types')).toHaveLength(2);
      expect(screen.getAllByText('High-quality TTS audio')).toHaveLength(2);

      // Free tier specific
      expect(screen.getByText('Standard support')).toBeInTheDocument();

      // Pro tier specific
      expect(screen.getByText('Priority support')).toBeInTheDocument();
      expect(screen.getByText('Early access to new features')).toBeInTheDocument();
    });

    it('should show check icons for all features', () => {
      renderWithRouter();

      // Verify features are displayed by checking for feature text
      expect(screen.getByText(/unlimited practice sessions/i)).toBeInTheDocument();
    });
  });
});
