import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as stripeService from '../../../services/stripeService.js';

// Create hoisted mocks
const mockPrisma = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  subscriptionEvent: {
    create: vi.fn(),
  },
}));

const mockStripe = vi.hoisted(() => ({
  customers: {
    create: vi.fn(),
  },
  checkout: {
    sessions: {
      create: vi.fn(),
    },
  },
  billingPortal: {
    sessions: {
      create: vi.fn(),
    },
  },
  subscriptions: {
    retrieve: vi.fn(),
  },
}));

const mockEmailService = vi.hoisted(() => ({
  sendSubscriptionConfirmedEmail: vi.fn(),
  sendPaymentFailedEmail: vi.fn(),
  sendSubscriptionCanceledEmail: vi.fn(),
}));

vi.mock('../../../db/client.js', () => ({
  prisma: mockPrisma,
}));

vi.mock('stripe', () => {
  class MockStripe {
    constructor() {
      return mockStripe;
    }
  }
  return { default: MockStripe };
});

vi.mock('../../../services/emailService.js', () => mockEmailService);

describe('Stripe Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createCheckoutSession', () => {
    it('should create checkout session for user with existing Stripe customer', async () => {
      const mockUser = {
        email: 'test@example.com',
        stripeCustomerId: 'cus_existing123',
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockStripe.checkout.sessions.create.mockResolvedValue({
        url: 'https://checkout.stripe.com/session-123',
      });

      const result = await stripeService.createCheckoutSession('user-123', 'price_pro_monthly');

      expect(result.url).toBe('https://checkout.stripe.com/session-123');
      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith({
        customer: 'cus_existing123',
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [{ price: 'price_pro_monthly', quantity: 1 }],
        success_url: expect.stringContaining('/app/settings/billing'),
        cancel_url: expect.stringContaining('/app/settings/billing'),
        subscription_data: {
          metadata: { userId: 'user-123' },
        },
        metadata: { userId: 'user-123' },
      });
      expect(mockStripe.customers.create).not.toHaveBeenCalled();
    });

    it('should create Stripe customer for user without one', async () => {
      const mockUser = {
        email: 'test@example.com',
        stripeCustomerId: null,
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockStripe.customers.create.mockResolvedValue({
        id: 'cus_new123',
      });
      mockPrisma.user.update.mockResolvedValue({});
      mockStripe.checkout.sessions.create.mockResolvedValue({
        url: 'https://checkout.stripe.com/session-123',
      });

      const result = await stripeService.createCheckoutSession('user-123', 'price_pro_monthly');

      expect(mockStripe.customers.create).toHaveBeenCalledWith({
        email: 'test@example.com',
        metadata: { userId: 'user-123' },
      });
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: { stripeCustomerId: 'cus_new123' },
      });
      expect(result.url).toBe('https://checkout.stripe.com/session-123');
    });

    it('should throw error if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        stripeService.createCheckoutSession('nonexistent-user', 'price_pro_monthly')
      ).rejects.toThrow('User not found');
    });

    it('should throw error if checkout session has no URL', async () => {
      const mockUser = {
        email: 'test@example.com',
        stripeCustomerId: 'cus_existing123',
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockStripe.checkout.sessions.create.mockResolvedValue({
        url: null,
      });

      await expect(
        stripeService.createCheckoutSession('user-123', 'price_pro_monthly')
      ).rejects.toThrow('Failed to create checkout session');
    });
  });

  describe('createCustomerPortalSession', () => {
    it('should create customer portal session', async () => {
      const mockUser = {
        stripeCustomerId: 'cus_123',
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockStripe.billingPortal.sessions.create.mockResolvedValue({
        url: 'https://billing.stripe.com/portal-123',
      });

      const result = await stripeService.createCustomerPortalSession('user-123');

      expect(result.url).toBe('https://billing.stripe.com/portal-123');
      expect(mockStripe.billingPortal.sessions.create).toHaveBeenCalledWith({
        customer: 'cus_123',
        return_url: expect.stringContaining('/app/settings/billing'),
      });
    });

    it('should throw error if user has no Stripe customer', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        stripeCustomerId: null,
      });

      await expect(
        stripeService.createCustomerPortalSession('user-123')
      ).rejects.toThrow('No Stripe customer found');
    });

    it('should throw error if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        stripeService.createCustomerPortalSession('nonexistent-user')
      ).rejects.toThrow('No Stripe customer found');
    });
  });

  describe('handleSubscriptionCreated', () => {
    it('should update user to pro tier and send confirmation email', async () => {
      const mockSubscription = {
        id: 'sub_123',
        customer: 'cus_123',
        status: 'active',
        items: {
          data: [{ price: { id: 'price_pro_monthly' } }],
        },
        current_period_start: 1672531200,
        current_period_end: 1675209600,
        metadata: {
          userId: 'user-123',
        },
      } as any;

      const mockUser = {
        email: 'test@example.com',
        name: 'Test User',
      };

      mockPrisma.user.update.mockResolvedValue({});
      mockPrisma.subscriptionEvent.create.mockResolvedValue({});
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockEmailService.sendSubscriptionConfirmedEmail.mockResolvedValue(undefined);

      await stripeService.handleSubscriptionCreated(mockSubscription);

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: {
          tier: 'pro',
          stripeSubscriptionId: 'sub_123',
          stripeSubscriptionStatus: 'active',
          stripePriceId: 'price_pro_monthly',
          subscriptionStartedAt: new Date(1672531200 * 1000),
          subscriptionExpiresAt: new Date(1675209600 * 1000),
          subscriptionCanceledAt: null,
        },
      });

      expect(mockPrisma.subscriptionEvent.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-123',
          eventType: 'subscribed',
          fromTier: 'free',
          toTier: 'pro',
          stripeEventId: 'sub_123',
        },
      });

      expect(mockEmailService.sendSubscriptionConfirmedEmail).toHaveBeenCalledWith(
        'test@example.com',
        'Test User',
        'pro'
      );
    });

    it('should handle subscription without userId in metadata', async () => {
      const mockSubscription = {
        id: 'sub_123',
        customer: 'cus_123',
        status: 'active',
        items: { data: [{ price: { id: 'price_pro_monthly' } }] },
        current_period_start: 1672531200,
        current_period_end: 1675209600,
        metadata: {},
      } as any;

      await stripeService.handleSubscriptionCreated(mockSubscription);

      expect(mockPrisma.user.update).not.toHaveBeenCalled();
      expect(mockPrisma.subscriptionEvent.create).not.toHaveBeenCalled();
    });
  });

  describe('handleSubscriptionUpdated', () => {
    it('should update subscription status with userId in metadata', async () => {
      const mockSubscription = {
        id: 'sub_123',
        customer: 'cus_123',
        status: 'active',
        items: {
          data: [{ price: { id: 'price_pro_monthly' } }],
        },
        current_period_end: 1675209600,
        cancel_at_period_end: false,
        metadata: {
          userId: 'user-123',
        },
      } as any;

      mockPrisma.user.update.mockResolvedValue({});

      await stripeService.handleSubscriptionUpdated(mockSubscription);

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: {
          stripeSubscriptionStatus: 'active',
          stripePriceId: 'price_pro_monthly',
          subscriptionExpiresAt: new Date(1675209600 * 1000),
        },
      });
    });

    it('should find user by customer ID if userId not in metadata', async () => {
      const mockSubscription = {
        id: 'sub_123',
        customer: 'cus_123',
        status: 'active',
        items: {
          data: [{ price: { id: 'price_pro_monthly' } }],
        },
        current_period_end: 1675209600,
        cancel_at_period_end: false,
        metadata: {},
      } as any;

      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-123' });
      mockPrisma.user.update.mockResolvedValue({});

      await stripeService.handleSubscriptionUpdated(mockSubscription);

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { stripeCustomerId: 'cus_123' },
        select: { id: true },
      });

      expect(mockPrisma.user.update).toHaveBeenCalled();
    });

    it('should set cancellation date when subscription is set to cancel at period end', async () => {
      const mockSubscription = {
        id: 'sub_123',
        customer: 'cus_123',
        status: 'active',
        items: {
          data: [{ price: { id: 'price_pro_monthly' } }],
        },
        current_period_end: 1675209600,
        cancel_at_period_end: true,
        metadata: {
          userId: 'user-123',
        },
      } as any;

      mockPrisma.user.update.mockResolvedValue({});

      await stripeService.handleSubscriptionUpdated(mockSubscription);

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: expect.objectContaining({
          subscriptionCanceledAt: new Date(1675209600 * 1000),
        }),
      });
    });
  });

  describe('handleSubscriptionDeleted', () => {
    it('should downgrade user to free tier and send cancellation email', async () => {
      const mockSubscription = {
        id: 'sub_123',
        customer: 'cus_123',
        metadata: {
          userId: 'user-123',
        },
      } as any;

      const mockUser = {
        tier: 'pro',
        email: 'test@example.com',
        name: 'Test User',
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.user.update.mockResolvedValue({});
      mockPrisma.subscriptionEvent.create.mockResolvedValue({});
      mockEmailService.sendSubscriptionCanceledEmail.mockResolvedValue(undefined);

      await stripeService.handleSubscriptionDeleted(mockSubscription);

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: {
          tier: 'free',
          stripeSubscriptionStatus: null,
          stripeSubscriptionId: null,
          stripePriceId: null,
          subscriptionCanceledAt: expect.any(Date),
        },
      });

      expect(mockPrisma.subscriptionEvent.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-123',
          eventType: 'canceled',
          fromTier: 'pro',
          toTier: 'free',
          stripeEventId: 'sub_123',
        },
      });

      expect(mockEmailService.sendSubscriptionCanceledEmail).toHaveBeenCalledWith(
        'test@example.com',
        'Test User'
      );
    });

    it('should handle deletion without userId by finding user via customer ID', async () => {
      const mockSubscription = {
        id: 'sub_123',
        customer: 'cus_123',
        metadata: {},
      } as any;

      const mockUser = {
        id: 'user-123',
        tier: 'pro',
        email: 'test@example.com',
        name: 'Test User',
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.user.update.mockResolvedValue({});
      mockPrisma.subscriptionEvent.create.mockResolvedValue({});
      mockEmailService.sendSubscriptionCanceledEmail.mockResolvedValue(undefined);

      await stripeService.handleSubscriptionDeleted(mockSubscription);

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { stripeCustomerId: 'cus_123' },
        select: { id: true, tier: true, email: true, name: true },
      });

      expect(mockPrisma.user.update).toHaveBeenCalled();
      expect(mockEmailService.sendSubscriptionCanceledEmail).toHaveBeenCalled();
    });
  });

  describe('handleInvoicePaymentFailed', () => {
    it('should send payment failed email to user', async () => {
      const mockInvoice = {
        id: 'in_123',
        customer: 'cus_123',
      } as any;

      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockEmailService.sendPaymentFailedEmail.mockResolvedValue(undefined);

      await stripeService.handleInvoicePaymentFailed(mockInvoice);

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { stripeCustomerId: 'cus_123' },
        select: { id: true, email: true, name: true },
      });

      expect(mockEmailService.sendPaymentFailedEmail).toHaveBeenCalledWith(
        'test@example.com',
        'Test User'
      );
    });

    it('should handle invoice for non-existent user', async () => {
      const mockInvoice = {
        id: 'in_123',
        customer: 'cus_nonexistent',
      } as any;

      mockPrisma.user.findUnique.mockResolvedValue(null);

      await stripeService.handleInvoicePaymentFailed(mockInvoice);

      expect(mockEmailService.sendPaymentFailedEmail).not.toHaveBeenCalled();
    });
  });

  describe('getSubscriptionStatus', () => {
    it('should return subscription status for user with active subscription', async () => {
      const mockUser = {
        tier: 'pro',
        stripeSubscriptionStatus: 'active',
        stripeSubscriptionId: 'sub_123',
        subscriptionExpiresAt: new Date('2025-01-15'),
      };

      const mockSubscription = {
        cancel_at_period_end: false,
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockStripe.subscriptions.retrieve.mockResolvedValue(mockSubscription);

      const result = await stripeService.getSubscriptionStatus('user-123');

      expect(result).toEqual({
        tier: 'pro',
        status: 'active',
        cancelAtPeriodEnd: false,
        currentPeriodEnd: new Date('2025-01-15'),
      });

      expect(mockStripe.subscriptions.retrieve).toHaveBeenCalledWith('sub_123');
    });

    it('should return status without checking cancelAtPeriodEnd if no subscription ID', async () => {
      const mockUser = {
        tier: 'free',
        stripeSubscriptionStatus: null,
        stripeSubscriptionId: null,
        subscriptionExpiresAt: null,
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await stripeService.getSubscriptionStatus('user-123');

      expect(result).toEqual({
        tier: 'free',
        status: null,
        cancelAtPeriodEnd: false,
        currentPeriodEnd: null,
      });

      expect(mockStripe.subscriptions.retrieve).not.toHaveBeenCalled();
    });

    it('should handle subscription retrieval error gracefully', async () => {
      const mockUser = {
        tier: 'pro',
        stripeSubscriptionStatus: 'active',
        stripeSubscriptionId: 'sub_123',
        subscriptionExpiresAt: new Date('2025-01-15'),
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockStripe.subscriptions.retrieve.mockRejectedValue(new Error('Stripe API error'));

      const result = await stripeService.getSubscriptionStatus('user-123');

      expect(result.cancelAtPeriodEnd).toBe(false);
    });

    it('should throw error if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        stripeService.getSubscriptionStatus('nonexistent-user')
      ).rejects.toThrow('User not found');
    });
  });
});
