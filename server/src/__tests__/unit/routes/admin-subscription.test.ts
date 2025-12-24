import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import adminRouter from '../../../routes/admin.js';
import { errorHandler } from '../../../middleware/errorHandler.js';

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
  subscriptions: {
    cancel: vi.fn(),
  },
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

// Mock auth middleware to simulate admin user
vi.mock('../../../middleware/auth.js', () => ({
  requireAuth: (req: any, res: any, next: any) => {
    req.userId = 'admin-user-id';
    next();
  },
  AuthRequest: class {},
}));

// Mock role auth middleware
vi.mock('../../../middleware/roleAuth.js', () => ({
  requireAdmin: (req: any, res: any, next: any) => {
    next();
  },
  requireRole: (role: string) => (req: any, res: any, next: any) => {
    next();
  },
}));

describe('Admin Subscription Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    vi.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/admin', adminRouter);
    app.use(errorHandler);
  });

  describe('GET /api/admin/users/:id/subscription', () => {
    it('should return subscription details for a user', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        tier: 'pro',
        stripeCustomerId: 'cus_123',
        stripeSubscriptionId: 'sub_123',
        stripeSubscriptionStatus: 'active',
        stripePriceId: 'price_pro_monthly',
        subscriptionStartedAt: new Date('2024-12-01'),
        subscriptionExpiresAt: new Date('2025-01-01'),
        subscriptionCanceledAt: null,
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const response = await request(app)
        .get('/api/admin/users/user-123/subscription')
        .expect(200);

      expect(response.body).toMatchObject({
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        tier: 'pro',
        stripeSubscriptionStatus: 'active',
      });
    });

    it('should return 404 if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/admin/users/nonexistent/subscription')
        .expect(404);

      expect(response.body.error.message).toBe('User not found');
    });
  });

  describe('POST /api/admin/users/:id/tier', () => {
    it('should update user tier from free to pro', async () => {
      const existingUser = {
        id: 'user-123',
        email: 'test@example.com',
        tier: 'free',
      };

      const updatedUser = {
        id: 'user-123',
        email: 'test@example.com',
        tier: 'pro',
      };

      mockPrisma.user.findUnique.mockResolvedValue(existingUser);
      mockPrisma.user.update.mockResolvedValue(updatedUser);
      mockPrisma.subscriptionEvent.create.mockResolvedValue({});

      const response = await request(app)
        .post('/api/admin/users/user-123/tier')
        .send({ tier: 'pro', reason: 'Manual upgrade for beta tester' })
        .expect(200);

      expect(response.body.message).toBe('User tier updated from free to pro');
      expect(response.body.user).toMatchObject({
        id: 'user-123',
        email: 'test@example.com',
        tier: 'pro',
      });

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: { tier: 'pro' },
      });

      expect(mockPrisma.subscriptionEvent.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-123',
          eventType: 'admin_override',
          fromTier: 'free',
          toTier: 'pro',
          stripeEventId: expect.stringContaining('admin:admin-user-id:Manual upgrade for beta tester'),
        },
      });
    });

    it('should update user tier from pro to free', async () => {
      const existingUser = {
        id: 'user-123',
        email: 'test@example.com',
        tier: 'pro',
      };

      const updatedUser = {
        id: 'user-123',
        email: 'test@example.com',
        tier: 'free',
      };

      mockPrisma.user.findUnique.mockResolvedValue(existingUser);
      mockPrisma.user.update.mockResolvedValue(updatedUser);
      mockPrisma.subscriptionEvent.create.mockResolvedValue({});

      const response = await request(app)
        .post('/api/admin/users/user-123/tier')
        .send({ tier: 'free' })
        .expect(200);

      expect(response.body.message).toBe('User tier updated from pro to free');
      expect(mockPrisma.subscriptionEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          fromTier: 'pro',
          toTier: 'free',
        }),
      });
    });

    it('should reject invalid tier values', async () => {
      const response = await request(app)
        .post('/api/admin/users/user-123/tier')
        .send({ tier: 'premium' })
        .expect(400);

      expect(response.body.error.message).toBe('Invalid tier. Must be "free" or "pro"');
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('should return 404 if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/admin/users/nonexistent/tier')
        .send({ tier: 'pro' })
        .expect(404);

      expect(response.body.error.message).toBe('User not found');
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('should log admin action with reason', async () => {
      const existingUser = {
        id: 'user-123',
        email: 'test@example.com',
        tier: 'free',
      };

      mockPrisma.user.findUnique.mockResolvedValue(existingUser);
      mockPrisma.user.update.mockResolvedValue({ ...existingUser, tier: 'pro' });
      mockPrisma.subscriptionEvent.create.mockResolvedValue({});

      await request(app)
        .post('/api/admin/users/user-123/tier')
        .send({ tier: 'pro', reason: 'Compensation for service outage' })
        .expect(200);

      expect(mockPrisma.subscriptionEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          stripeEventId: expect.stringContaining('Compensation for service outage'),
        }),
      });
    });

    it('should handle missing reason gracefully', async () => {
      const existingUser = {
        id: 'user-123',
        email: 'test@example.com',
        tier: 'free',
      };

      mockPrisma.user.findUnique.mockResolvedValue(existingUser);
      mockPrisma.user.update.mockResolvedValue({ ...existingUser, tier: 'pro' });
      mockPrisma.subscriptionEvent.create.mockResolvedValue({});

      await request(app)
        .post('/api/admin/users/user-123/tier')
        .send({ tier: 'pro' })
        .expect(200);

      expect(mockPrisma.subscriptionEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          stripeEventId: expect.stringContaining('manual override'),
        }),
      });
    });
  });

  describe('POST /api/admin/users/:id/subscription/cancel', () => {
    it('should cancel user subscription', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        tier: 'pro',
        stripeSubscriptionId: 'sub_123',
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockStripe.subscriptions.cancel.mockResolvedValue({});
      mockPrisma.user.update.mockResolvedValue({
        ...mockUser,
        tier: 'free',
        stripeSubscriptionId: null,
      });
      mockPrisma.subscriptionEvent.create.mockResolvedValue({});

      const response = await request(app)
        .post('/api/admin/users/user-123/subscription/cancel')
        .send({ reason: 'User requested refund' })
        .expect(200);

      expect(response.body.message).toBe('Subscription canceled successfully');
      expect(response.body.user).toMatchObject({
        id: 'user-123',
        email: 'test@example.com',
        tier: 'free',
      });

      expect(mockStripe.subscriptions.cancel).toHaveBeenCalledWith('sub_123');

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
          eventType: 'admin_canceled',
          fromTier: 'pro',
          toTier: 'free',
          stripeEventId: expect.stringContaining('User requested refund'),
        },
      });
    });

    it('should return 404 if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/admin/users/nonexistent/subscription/cancel')
        .expect(404);

      expect(response.body.error.message).toBe('User not found');
      expect(mockStripe.subscriptions.cancel).not.toHaveBeenCalled();
    });

    it('should return 400 if user has no active subscription', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        tier: 'free',
        stripeSubscriptionId: null,
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const response = await request(app)
        .post('/api/admin/users/user-123/subscription/cancel')
        .expect(400);

      expect(response.body.error.message).toBe('User has no active subscription');
      expect(mockStripe.subscriptions.cancel).not.toHaveBeenCalled();
    });

    it('should handle missing cancellation reason', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        tier: 'pro',
        stripeSubscriptionId: 'sub_123',
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockStripe.subscriptions.cancel.mockResolvedValue({});
      mockPrisma.user.update.mockResolvedValue({});
      mockPrisma.subscriptionEvent.create.mockResolvedValue({});

      await request(app)
        .post('/api/admin/users/user-123/subscription/cancel')
        .send({})
        .expect(200);

      expect(mockPrisma.subscriptionEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          stripeEventId: expect.stringContaining('admin cancellation'),
        }),
      });
    });
  });
});
