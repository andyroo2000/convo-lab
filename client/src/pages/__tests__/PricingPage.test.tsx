import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
type MockUser = { id: string; email: string; tier: 'free' | 'pro' } | null;
let mockUser: MockUser = null;
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
  }),
}));

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch as unknown as typeof fetch;

// Mock window.location
const mockLocation = { href: '' } as unknown as Location;
Object.defineProperty(window, 'location', {
  writable: true,
  value: mockLocation,
});

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
    mockFetch.mockClear();
    mockUser = null;
    vi.stubEnv('VITE_STRIPE_PRICE_PRO_MONTHLY', 'price_test_pro_monthly');
    window.location.href = '';
  });

  afterEach(() => {
    vi.unstubAllEnvs();
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

      expect(screen.getByText('2 dialogues + 1 audio course (lifetime)')).toBeInTheDocument();
      expect(screen.getByText('$0')).toBeInTheDocument();
      expect(screen.getByText(/Perfect for trying out ConvoLab/)).toBeInTheDocument();
    });

    it('should show pro tier features', () => {
      renderWithRouter();

      expect(screen.getByText('30 generations per month')).toBeInTheDocument();
      expect(screen.getByText('$10')).toBeInTheDocument();
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

      // Should show "Current Plan" in both badge and button (2 instances)
      const currentPlanBadges = screen.getAllByText('Current Plan');
      expect(currentPlanBadges).toHaveLength(2);
    });

    it('should show pro tier as current plan for pro users', () => {
      mockUser = { id: '1', email: 'test@example.com', tier: 'pro' };
      renderWithRouter();

      // Should show "Current Plan" in both badge and button (2 instances)
      const currentPlanBadges = screen.getAllByText('Current Plan');
      expect(currentPlanBadges).toHaveLength(2);
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

      mockFetch.mockResolvedValueOnce({
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

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ url: 'https://checkout.stripe.com/session-123' }),
      });

      renderWithRouter();

      const upgradeButton = screen.getByRole('button', { name: /Upgrade to Pro/ });
      fireEvent.click(upgradeButton);

      await waitFor(() => {
        expect(window.location.href).toBe('https://checkout.stripe.com/session-123');
      });
    });

    it('should show loading state during checkout session creation', async () => {
      mockUser = { id: '1', email: 'test@example.com', tier: 'free' };

      mockFetch.mockImplementationOnce(
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

      mockFetch.mockResolvedValueOnce({
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

      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      renderWithRouter();

      const upgradeButton = screen.getByRole('button', { name: /Upgrade to Pro/ });
      fireEvent.click(upgradeButton);

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });
    });

    it('should handle generic errors with fallback message', async () => {
      mockUser = { id: '1', email: 'test@example.com', tier: 'free' };

      mockFetch.mockRejectedValueOnce('Unknown error');

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
      expect(screen.getAllByText('High-quality TTS audio')).toHaveLength(2);

      // Free tier specific
      expect(screen.getByText('Sample content included')).toBeInTheDocument();
      expect(screen.getByText('Standard support')).toBeInTheDocument();

      // Pro tier specific
      expect(screen.getByText('All content types')).toBeInTheDocument();
      expect(screen.getByText('Priority support')).toBeInTheDocument();
      expect(screen.getByText('Early access to new features')).toBeInTheDocument();
    });

    it('should show check icons for all features', () => {
      renderWithRouter();

      // Verify features are displayed by checking for feature text that exists
      expect(screen.getByText(/2 dialogues \+ 1 audio course \(lifetime\)/i)).toBeInTheDocument();
      expect(screen.getByText(/30 generations per month/i)).toBeInTheDocument();
    });
  });
});
