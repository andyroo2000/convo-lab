import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import billingRouter from '../../../routes/billing.js';
import { errorHandler } from '../../../middleware/errorHandler.js';

// Create hoisted mocks
const mockStripeService = vi.hoisted(() => ({
  createCheckoutSession: vi.fn(),
  createCustomerPortalSession: vi.fn(),
  getSubscriptionStatus: vi.fn(),
  handleSubscriptionCreated: vi.fn(),
  handleSubscriptionUpdated: vi.fn(),
  handleSubscriptionDeleted: vi.fn(),
  handleInvoicePaymentFailed: vi.fn(),
}));

const mockStripe = vi.hoisted(() => ({
  webhooks: {
    constructEvent: vi.fn(),
  },
}));

vi.mock('../../../services/stripeService.js', () => mockStripeService);

vi.mock('stripe', () => {
  class MockStripe {
    constructor() {
      return mockStripe;
    }
  }
  return { default: MockStripe };
});

// Mock auth middleware
vi.mock('../../../middleware/auth.js', () => ({
  requireAuth: (req: any, res: any, next: any) => {
    req.userId = 'test-user-id';
    next();
  },
  AuthRequest: class {},
}));

describe('Billing Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    vi.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api', billingRouter);
    app.use(errorHandler);
  });

  describe('POST /api/billing/create-checkout-session', () => {
    it('should create checkout session with valid price ID', async () => {
      const originalEnv = process.env.STRIPE_PRICE_PRO_MONTHLY;
      process.env.STRIPE_PRICE_PRO_MONTHLY = 'price_test_123';

      mockStripeService.createCheckoutSession.mockResolvedValue({
        url: 'https://checkout.stripe.com/session-123',
      });

      const response = await request(app)
        .post('/api/billing/create-checkout-session')
        .send({ priceId: 'price_test_123' })
        .expect(200);

      expect(response.body).toEqual({
        url: 'https://checkout.stripe.com/session-123',
      });
      expect(mockStripeService.createCheckoutSession).toHaveBeenCalledWith(
        'test-user-id',
        'price_test_123'
      );

      process.env.STRIPE_PRICE_PRO_MONTHLY = originalEnv;
    });

    it('should reject request without price ID', async () => {
      const response = await request(app)
        .post('/api/billing/create-checkout-session')
        .send({})
        .expect(400);

      expect(response.body.error.message).toBe('Price ID is required');
      expect(mockStripeService.createCheckoutSession).not.toHaveBeenCalled();
    });

    it('should reject invalid price ID', async () => {
      const originalEnv = process.env.STRIPE_PRICE_PRO_MONTHLY;
      process.env.STRIPE_PRICE_PRO_MONTHLY = 'price_test_123';

      const response = await request(app)
        .post('/api/billing/create-checkout-session')
        .send({ priceId: 'price_invalid' })
        .expect(400);

      expect(response.body.error.message).toBe('Invalid price ID');
      expect(mockStripeService.createCheckoutSession).not.toHaveBeenCalled();

      process.env.STRIPE_PRICE_PRO_MONTHLY = originalEnv;
    });

    it('should handle checkout session creation error', async () => {
      const originalEnv = process.env.STRIPE_PRICE_PRO_MONTHLY;
      process.env.STRIPE_PRICE_PRO_MONTHLY = 'price_test_123';

      mockStripeService.createCheckoutSession.mockRejectedValue(
        new Error('Stripe API error')
      );

      const response = await request(app)
        .post('/api/billing/create-checkout-session')
        .send({ priceId: 'price_test_123' })
        .expect(500);

      expect(response.body.error.message).toBe('Stripe API error');

      process.env.STRIPE_PRICE_PRO_MONTHLY = originalEnv;
    });
  });

  describe('POST /api/billing/create-portal-session', () => {
    it('should create customer portal session', async () => {
      mockStripeService.createCustomerPortalSession.mockResolvedValue({
        url: 'https://billing.stripe.com/session-123',
      });

      const response = await request(app)
        .post('/api/billing/create-portal-session')
        .expect(200);

      expect(response.body).toEqual({
        url: 'https://billing.stripe.com/session-123',
      });
      expect(mockStripeService.createCustomerPortalSession).toHaveBeenCalledWith(
        'test-user-id'
      );
    });

    it('should handle portal session creation error', async () => {
      mockStripeService.createCustomerPortalSession.mockRejectedValue(
        new Error('No Stripe customer found')
      );

      const response = await request(app)
        .post('/api/billing/create-portal-session')
        .expect(500);

      expect(response.body.error.message).toBe('No Stripe customer found');
    });
  });

  describe('GET /api/billing/subscription-status', () => {
    it('should return subscription status', async () => {
      const mockStatus = {
        tier: 'pro',
        status: 'active',
        currentPeriodEnd: new Date('2025-01-15'),
      };

      mockStripeService.getSubscriptionStatus.mockResolvedValue(mockStatus);

      const response = await request(app)
        .get('/api/billing/subscription-status')
        .expect(200);

      expect(response.body).toEqual({
        tier: 'pro',
        status: 'active',
        currentPeriodEnd: '2025-01-15T00:00:00.000Z',
      });
      expect(mockStripeService.getSubscriptionStatus).toHaveBeenCalledWith('test-user-id');
    });

    it('should handle error getting subscription status', async () => {
      mockStripeService.getSubscriptionStatus.mockRejectedValue(
        new Error('Database error')
      );

      const response = await request(app)
        .get('/api/billing/subscription-status')
        .expect(500);

      expect(response.body.error.message).toBe('Database error');
    });
  });

  describe('POST /api/webhooks/stripe', () => {
    beforeEach(() => {
      process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_123';
    });

    it('should process subscription created event', async () => {
      const mockEvent = {
        type: 'customer.subscription.created',
        data: {
          object: {
            id: 'sub_123',
            customer: 'cus_123',
            status: 'active',
          },
        },
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);
      mockStripeService.handleSubscriptionCreated.mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/webhooks/stripe')
        .set('stripe-signature', 'valid-signature')
        .send({ type: 'customer.subscription.created' })
        .expect(200);

      expect(response.body).toEqual({ received: true });
      expect(mockStripeService.handleSubscriptionCreated).toHaveBeenCalledWith(
        mockEvent.data.object
      );
    });

    it('should process subscription updated event', async () => {
      const mockEvent = {
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_123',
            customer: 'cus_123',
            status: 'active',
          },
        },
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);
      mockStripeService.handleSubscriptionUpdated.mockResolvedValue(undefined);

      await request(app)
        .post('/api/webhooks/stripe')
        .set('stripe-signature', 'valid-signature')
        .send({ type: 'customer.subscription.updated' })
        .expect(200);

      expect(mockStripeService.handleSubscriptionUpdated).toHaveBeenCalledWith(
        mockEvent.data.object
      );
    });

    it('should process subscription deleted event', async () => {
      const mockEvent = {
        type: 'customer.subscription.deleted',
        data: {
          object: {
            id: 'sub_123',
            customer: 'cus_123',
            status: 'canceled',
          },
        },
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);
      mockStripeService.handleSubscriptionDeleted.mockResolvedValue(undefined);

      await request(app)
        .post('/api/webhooks/stripe')
        .set('stripe-signature', 'valid-signature')
        .send({ type: 'customer.subscription.deleted' })
        .expect(200);

      expect(mockStripeService.handleSubscriptionDeleted).toHaveBeenCalledWith(
        mockEvent.data.object
      );
    });

    it('should process invoice payment failed event', async () => {
      const mockEvent = {
        type: 'invoice.payment_failed',
        data: {
          object: {
            id: 'in_123',
            customer: 'cus_123',
          },
        },
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);
      mockStripeService.handleInvoicePaymentFailed.mockResolvedValue(undefined);

      await request(app)
        .post('/api/webhooks/stripe')
        .set('stripe-signature', 'valid-signature')
        .send({ type: 'invoice.payment_failed' })
        .expect(200);

      expect(mockStripeService.handleInvoicePaymentFailed).toHaveBeenCalledWith(
        mockEvent.data.object
      );
    });

    it('should handle unrecognized event types gracefully', async () => {
      const mockEvent = {
        type: 'unknown.event.type',
        data: {
          object: {},
        },
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);

      await request(app)
        .post('/api/webhooks/stripe')
        .set('stripe-signature', 'valid-signature')
        .send({ type: 'unknown.event.type' })
        .expect(200);

      expect(mockStripeService.handleSubscriptionCreated).not.toHaveBeenCalled();
      expect(mockStripeService.handleSubscriptionUpdated).not.toHaveBeenCalled();
    });

    it('should reject webhook without signature', async () => {
      const response = await request(app)
        .post('/api/webhooks/stripe')
        .send({ type: 'customer.subscription.created' })
        .expect(400);

      expect(response.body.error.message).toBe('No signature provided');
      expect(mockStripe.webhooks.constructEvent).not.toHaveBeenCalled();
    });

    it('should reject webhook with invalid signature', async () => {
      mockStripe.webhooks.constructEvent.mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      const response = await request(app)
        .post('/api/webhooks/stripe')
        .set('stripe-signature', 'invalid-signature')
        .send({ type: 'customer.subscription.created' })
        .expect(400);

      expect(response.body.error.message).toBe('Invalid signature');
    });

    it('should handle webhook processing errors', async () => {
      const mockEvent = {
        type: 'customer.subscription.created',
        data: {
          object: { id: 'sub_123' },
        },
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);
      mockStripeService.handleSubscriptionCreated.mockRejectedValue(
        new Error('Database error')
      );

      const response = await request(app)
        .post('/api/webhooks/stripe')
        .set('stripe-signature', 'valid-signature')
        .send({ type: 'customer.subscription.created' })
        .expect(500);

      expect(response.body.error.message).toBe('Database error');
    });

    it('should return error if webhook secret not configured', async () => {
      delete process.env.STRIPE_WEBHOOK_SECRET;

      const response = await request(app)
        .post('/api/webhooks/stripe')
        .set('stripe-signature', 'valid-signature')
        .send({ type: 'customer.subscription.created' })
        .expect(500);

      expect(response.body.error.message).toBe('Webhook secret not configured');

      process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_123';
    });
  });
});
