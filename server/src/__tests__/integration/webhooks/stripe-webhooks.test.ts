import { describe, it, expect, vi, beforeEach } from 'vitest';
import Stripe from 'stripe';
import {
  handleSubscriptionCreated,
  handleSubscriptionUpdated,
  handleSubscriptionDeleted,
  handleInvoicePaymentFailed
} from '../../../services/stripeService.js';
import { mockPrisma } from '../../setup.js';

import {
  sendSubscriptionConfirmedEmail,
  sendPaymentFailedEmail,
  sendSubscriptionCanceledEmail
} from '../../../services/emailService.js';

// Mock email service
vi.mock('../../../services/emailService.js', () => ({
  sendSubscriptionConfirmedEmail: vi.fn(),
  sendPaymentFailedEmail: vi.fn(),
  sendSubscriptionCanceledEmail: vi.fn()
}));

describe('Stripe Webhook Handlers - Integration Tests', () => {
  const mockUserId = 'user-123';
  const mockCustomerId = 'cus_123';
  const mockSubscriptionId = 'sub_123';
  const mockPriceId = 'price_123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handleSubscriptionCreated', () => {
    it('should create subscription with correct tier and send confirmation email', async () => {
      const subscription = {
        id: mockSubscriptionId,
        customer: mockCustomerId,
        status: 'active',
        metadata: { userId: mockUserId },
        items: {
          data: [{ price: { id: mockPriceId } }]
        },
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60
      } as any;

      mockPrisma.user.update.mockResolvedValue({
        id: mockUserId,
        tier: 'pro'
      });

      mockPrisma.user.findUnique.mockResolvedValue({
        id: mockUserId,
        email: 'test@example.com',
        name: 'Test User'
      });

      mockPrisma.subscriptionEvent.create.mockResolvedValue({});

      await handleSubscriptionCreated(subscription);

      // Verify user update
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUserId },
        data: expect.objectContaining({
          tier: 'pro',
          stripeSubscriptionId: mockSubscriptionId,
          stripeSubscriptionStatus: 'active',
          stripePriceId: mockPriceId,
          subscriptionCanceledAt: null
        })
      });

      // Verify subscription event logged
      expect(mockPrisma.subscriptionEvent.create).toHaveBeenCalledWith({
        data: {
          userId: mockUserId,
          eventType: 'subscribed',
          fromTier: 'free',
          toTier: 'pro',
          stripeEventId: mockSubscriptionId
        }
      });

      // Verify confirmation email sent
      expect(sendSubscriptionConfirmedEmail).toHaveBeenCalledWith(
        'test@example.com',
        'Test User',
        'pro'
      );
    });

    it('should handle missing userId in metadata gracefully', async () => {
      const subscription = {
        id: mockSubscriptionId,
        customer: mockCustomerId,
        status: 'active',
        metadata: {}, // No userId
        items: {
          data: [{ price: { id: mockPriceId } }]
        }
      } as any;

      await handleSubscriptionCreated(subscription);

      // Should not attempt to update user
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
      expect(mockPrisma.subscriptionEvent.create).not.toHaveBeenCalled();
    });
  });

  describe('handleSubscriptionUpdated', () => {
    it('should update subscription status when userId provided', async () => {
      const subscription = {
        id: mockSubscriptionId,
        customer: mockCustomerId,
        status: 'active',
        metadata: { userId: mockUserId },
        items: {
          data: [{ price: { id: mockPriceId } }]
        },
        current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
        cancel_at_period_end: false
      } as any;

      mockPrisma.user.update.mockResolvedValue({});

      await handleSubscriptionUpdated(subscription);

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUserId },
        data: expect.objectContaining({
          stripeSubscriptionStatus: 'active',
          stripePriceId: mockPriceId
        })
      });
    });

    it('should lookup user by customerId when userId missing', async () => {
      const subscription = {
        id: mockSubscriptionId,
        customer: mockCustomerId,
        status: 'active',
        metadata: {}, // No userId
        items: {
          data: [{ price: { id: mockPriceId } }]
        },
        current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
        cancel_at_period_end: false
      } as any;

      mockPrisma.user.findUnique.mockResolvedValue({
        id: mockUserId
      });

      mockPrisma.user.update.mockResolvedValue({});

      await handleSubscriptionUpdated(subscription);

      // Verify lookup by customerId
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { stripeCustomerId: mockCustomerId },
        select: { id: true }
      });

      // Verify update by customerId
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { stripeCustomerId: mockCustomerId },
        data: expect.any(Object)
      });
    });

    it('should set subscriptionCanceledAt when cancel_at_period_end is true', async () => {
      const periodEnd = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
      const subscription = {
        id: mockSubscriptionId,
        customer: mockCustomerId,
        status: 'active',
        metadata: { userId: mockUserId },
        items: {
          data: [{ price: { id: mockPriceId } }]
        },
        current_period_end: periodEnd,
        cancel_at_period_end: true
      } as any;

      mockPrisma.user.update.mockResolvedValue({});

      await handleSubscriptionUpdated(subscription);

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUserId },
        data: expect.objectContaining({
          stripeSubscriptionStatus: 'active',
          subscriptionCanceledAt: new Date(periodEnd * 1000)
        })
      });
    });

    it('should handle user not found gracefully', async () => {
      const subscription = {
        id: mockSubscriptionId,
        customer: mockCustomerId,
        status: 'active',
        metadata: {}, // No userId
        items: {
          data: [{ price: { id: mockPriceId } }]
        },
        current_period_end: Math.floor(Date.now() / 1000),
        cancel_at_period_end: false
      } as any;

      mockPrisma.user.findUnique.mockResolvedValue(null);

      await handleSubscriptionUpdated(subscription);

      // Should not throw or update
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });
  });

  describe('handleSubscriptionDeleted', () => {
    it('should downgrade to free tier and send cancellation email when userId provided', async () => {
      const subscription = {
        id: mockSubscriptionId,
        customer: mockCustomerId,
        metadata: { userId: mockUserId }
      } as any;

      mockPrisma.user.findUnique.mockResolvedValue({
        id: mockUserId,
        tier: 'pro',
        email: 'test@example.com',
        name: 'Test User'
      });

      mockPrisma.user.update.mockResolvedValue({});
      mockPrisma.subscriptionEvent.create.mockResolvedValue({});

      await handleSubscriptionDeleted(subscription);

      // Verify downgrade to free
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUserId },
        data: {
          tier: 'free',
          stripeSubscriptionStatus: null,
          stripeSubscriptionId: null,
          stripePriceId: null,
          subscriptionCanceledAt: expect.any(Date)
        }
      });

      // Verify event logged
      expect(mockPrisma.subscriptionEvent.create).toHaveBeenCalledWith({
        data: {
          userId: mockUserId,
          eventType: 'canceled',
          fromTier: 'pro',
          toTier: 'free',
          stripeEventId: mockSubscriptionId
        }
      });

      // Verify cancellation email
      expect(sendSubscriptionCanceledEmail).toHaveBeenCalledWith(
        'test@example.com',
        'Test User'
      );
    });

    it('should lookup user by customerId when userId missing', async () => {
      const subscription = {
        id: mockSubscriptionId,
        customer: mockCustomerId,
        metadata: {} // No userId
      } as any;

      mockPrisma.user.findUnique.mockResolvedValue({
        id: mockUserId,
        tier: 'pro',
        email: 'test@example.com',
        name: 'Test User'
      });

      mockPrisma.user.update.mockResolvedValue({});
      mockPrisma.subscriptionEvent.create.mockResolvedValue({});

      await handleSubscriptionDeleted(subscription);

      // Verify lookup by customerId
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { stripeCustomerId: mockCustomerId },
        select: { id: true, tier: true, email: true, name: true }
      });

      // Verify downgrade
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUserId },
        data: expect.objectContaining({
          tier: 'free'
        })
      });
    });

    it('should handle user not found gracefully', async () => {
      const subscription = {
        id: mockSubscriptionId,
        customer: mockCustomerId,
        metadata: {}
      } as any;

      mockPrisma.user.findUnique.mockResolvedValue(null);

      await handleSubscriptionDeleted(subscription);

      // Should not throw or update
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
      expect(mockPrisma.subscriptionEvent.create).not.toHaveBeenCalled();
    });

    it('should preserve historical data when downgrading', async () => {
      const subscription = {
        id: mockSubscriptionId,
        customer: mockCustomerId,
        metadata: { userId: mockUserId }
      } as any;

      mockPrisma.user.findUnique.mockResolvedValue({
        id: mockUserId,
        tier: 'pro',
        email: 'test@example.com',
        name: 'Test User'
      });

      mockPrisma.user.update.mockResolvedValue({});
      mockPrisma.subscriptionEvent.create.mockResolvedValue({});

      await handleSubscriptionDeleted(subscription);

      // Verify data preservation by checking subscriptionEvent was created
      expect(mockPrisma.subscriptionEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          eventType: 'canceled',
          fromTier: 'pro',
          toTier: 'free'
        })
      });
    });
  });

  describe('handleInvoicePaymentFailed', () => {
    it('should send payment failed email to user', async () => {
      const invoice = {
        id: 'inv_123',
        customer: mockCustomerId
      } as any;

      mockPrisma.user.findUnique.mockResolvedValue({
        id: mockUserId,
        email: 'test@example.com',
        name: 'Test User'
      });

      await handleInvoicePaymentFailed(invoice);

      // Verify user lookup
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { stripeCustomerId: mockCustomerId },
        select: { id: true, email: true, name: true }
      });

      // Verify email sent
      expect(sendPaymentFailedEmail).toHaveBeenCalledWith(
        'test@example.com',
        'Test User'
      );
    });

    it('should handle user without subscription gracefully', async () => {
      const invoice = {
        id: 'inv_123',
        customer: mockCustomerId
      } as any;

      mockPrisma.user.findUnique.mockResolvedValue(null);

      await handleInvoicePaymentFailed(invoice);

      // Should not throw or send email
      expect(sendPaymentFailedEmail).not.toHaveBeenCalled();
    });

    it('should not immediately downgrade user on payment failure', async () => {
      const invoice = {
        id: 'inv_123',
        customer: mockCustomerId
      } as any;

      mockPrisma.user.findUnique.mockResolvedValue({
        id: mockUserId,
        email: 'test@example.com',
        name: 'Test User'
      });

      await handleInvoicePaymentFailed(invoice);

      // Verify no user update (Stripe retries failed payments)
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases & Race Conditions', () => {
    it('should handle concurrent subscription updates with same data', async () => {
      const subscription = {
        id: mockSubscriptionId,
        customer: mockCustomerId,
        status: 'active',
        metadata: { userId: mockUserId },
        items: {
          data: [{ price: { id: mockPriceId } }]
        },
        current_period_end: Math.floor(Date.now() / 1000),
        cancel_at_period_end: false
      } as any;

      mockPrisma.user.update.mockResolvedValue({});

      // Simulate concurrent updates
      await Promise.all([
        handleSubscriptionUpdated(subscription),
        handleSubscriptionUpdated(subscription)
      ]);

      // Both should complete successfully (last write wins)
      expect(mockPrisma.user.update).toHaveBeenCalledTimes(2);
    });

    it('should handle subscription deleted arriving before user created', async () => {
      const subscription = {
        id: mockSubscriptionId,
        customer: mockCustomerId,
        metadata: {}
      } as any;

      mockPrisma.user.findUnique.mockResolvedValue(null);

      // Should handle gracefully without error
      await expect(handleSubscriptionDeleted(subscription)).resolves.not.toThrow();
    });

    it('should handle subscription updates with changing price IDs', async () => {
      const newPriceId = 'price_456';
      const subscription = {
        id: mockSubscriptionId,
        customer: mockCustomerId,
        status: 'active',
        metadata: { userId: mockUserId },
        items: {
          data: [{ price: { id: newPriceId } }]
        },
        current_period_end: Math.floor(Date.now() / 1000),
        cancel_at_period_end: false
      } as any;

      mockPrisma.user.update.mockResolvedValue({});

      await handleSubscriptionUpdated(subscription);

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUserId },
        data: expect.objectContaining({
          stripePriceId: newPriceId
        })
      });
    });
  });
});
