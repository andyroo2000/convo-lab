import express, { Request, Response, NextFunction, json as expressJson } from 'express';
import request from 'supertest';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { errorHandler } from '../../../middleware/errorHandler.js';
import adminRouter from '../../../routes/admin.js';

interface AuthRequest extends Request {
  userId?: string;
}

// Mock auth middleware to set userId from test context
let currentUserId: string | undefined;
vi.mock('../../../middleware/auth.js', () => ({
  requireAuth: (req: AuthRequest, res: Response, next: NextFunction) => {
    req.userId = currentUserId;
    next();
  },
  AuthRequest: class {},
}));

// Create hoisted mocks
const mockPrisma = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
  episode: {
    count: vi.fn(),
  },
  course: {
    count: vi.fn(),
  },
  inviteCode: {
    findMany: vi.fn(),
    count: vi.fn(),
  },
  subscriptionEvent: {
    create: vi.fn(),
  },
}));

vi.mock('../../../db/client.js', () => ({
  prisma: mockPrisma,
}));

vi.mock('stripe', () => ({
  default: vi.fn(() => ({
    subscriptions: {
      cancel: vi.fn(),
    },
  })),
}));

vi.mock('../../../services/japanesePronunciationOverrides.js', () => ({
  getJapanesePronunciationDictionary: vi.fn(() => ({ keepKanji: [], forceKana: {} })),
  updateJapanesePronunciationDictionary: vi.fn(async () => ({ keepKanji: [], forceKana: {} })),
}));

describe('Admin Security Tests', () => {
  let app: express.Application;

  beforeEach(() => {
    vi.clearAllMocks();
    currentUserId = undefined; // Reset user ID before each test
    app = express();
    app.use(expressJson());
    app.use('/api/admin', adminRouter); // Admin router includes requireAuth and requireAdmin
    app.use(errorHandler);
  });

  describe('Role Authorization', () => {
    it('should block non-admin user from accessing admin endpoints (GET /stats)', async () => {
      currentUserId = 'regular-user-123';

      // Mock user lookup to return non-admin role
      mockPrisma.user.findUnique.mockResolvedValue({
        id: currentUserId,
        email: 'user@example.com',
        role: 'user',
      });

      const response = await request(app).get('/api/admin/stats').expect(403);

      expect(response.body.error.message).toBe('Admin access required');
    });

    it('should allow admin user to access admin endpoints (GET /stats)', async () => {
      currentUserId = 'admin-123';

      // Mock user lookup to return admin role
      mockPrisma.user.findUnique.mockResolvedValue({
        id: currentUserId,
        email: 'admin@example.com',
        role: 'admin',
      });

      // Mock stats data
      mockPrisma.user.count.mockResolvedValue(10);
      mockPrisma.episode.count.mockResolvedValue(50);
      mockPrisma.course.count.mockResolvedValue(20);
      mockPrisma.inviteCode.count
        .mockResolvedValueOnce(15) // total
        .mockResolvedValueOnce(8); // used

      const response = await request(app).get('/api/admin/stats').expect(200);

      expect(response.body).toHaveProperty('users');
      expect(response.body).toHaveProperty('episodes');
      expect(response.body).toHaveProperty('courses');
    });

    it('should enforce case-sensitive role check - "Admin" (capital A) should fail', async () => {
      currentUserId = 'user-with-capital-admin';

      // Mock user with role "Admin" instead of "admin"
      mockPrisma.user.findUnique.mockResolvedValue({
        id: currentUserId,
        email: 'capitalized@example.com',
        role: 'Admin', // Capital A
      });

      const response = await request(app).get('/api/admin/stats').expect(403);

      expect(response.body.error.message).toBe('Admin access required');
    });

    it('should block user with null role', async () => {
      currentUserId = 'user-null-role';

      mockPrisma.user.findUnique.mockResolvedValue({
        id: currentUserId,
        email: 'nullrole@example.com',
        role: null,
      });

      const response = await request(app).get('/api/admin/stats').expect(403);

      expect(response.body.error.message).toBe('Admin access required');
    });

    it('should block request for non-existent user', async () => {
      currentUserId = 'non-existent-user-id';

      // Mock user lookup returns null
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const response = await request(app).get('/api/admin/stats').expect(404);

      expect(response.body.error.message).toBe('User not found');
    });

    it('should block non-admin user from pronunciation dictionaries', async () => {
      currentUserId = 'regular-user-123';

      mockPrisma.user.findUnique.mockResolvedValue({
        id: currentUserId,
        email: 'user@example.com',
        role: 'user',
      });

      const response = await request(app).get('/api/admin/pronunciation-dictionaries').expect(403);

      expect(response.body.error.message).toBe('Admin access required');
    });

    it('should allow admin user to access pronunciation dictionaries', async () => {
      currentUserId = 'admin-123';

      mockPrisma.user.findUnique.mockResolvedValue({
        id: currentUserId,
        email: 'admin@example.com',
        role: 'admin',
      });

      const response = await request(app).get('/api/admin/pronunciation-dictionaries').expect(200);

      expect(response.body).toHaveProperty('keepKanji');
      expect(response.body).toHaveProperty('forceKana');
    });
  });

  describe('Admin Subscription Tier Management', () => {
    it('should block non-admin from updating user tier', async () => {
      currentUserId = 'non-admin-456';

      mockPrisma.user.findUnique.mockResolvedValue({
        id: currentUserId,
        email: 'user@example.com',
        role: 'user',
      });

      const response = await request(app)
        .post('/api/admin/users/target-user-123/tier')
        .send({ tier: 'pro', reason: 'Unauthorized attempt' })
        .expect(403);

      expect(response.body.error.message).toBe('Admin access required');
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('should allow admin to update user tier', async () => {
      currentUserId = 'admin-789';

      // First call: verify admin role
      // Second call: find target user
      mockPrisma.user.findUnique
        .mockResolvedValueOnce({
          id: currentUserId,
          email: 'admin@example.com',
          role: 'admin',
        })
        .mockResolvedValueOnce({
          id: 'target-user-123',
          email: 'target@example.com',
          tier: 'free',
        });

      mockPrisma.user.update.mockResolvedValue({
        id: 'target-user-123',
        email: 'target@example.com',
        tier: 'pro',
      });

      mockPrisma.subscriptionEvent.create.mockResolvedValue({
        id: 'event-1',
        userId: 'target-user-123',
        eventType: 'admin_override',
        fromTier: 'free',
        toTier: 'pro',
        stripeEventId: 'admin:admin-789:Manual upgrade',
        createdAt: new Date(),
      });

      const response = await request(app)
        .post('/api/admin/users/target-user-123/tier')
        .send({ tier: 'pro', reason: 'Manual upgrade' })
        .expect(200);

      expect(response.body.message).toBe('User tier updated from free to pro');
      expect(mockPrisma.user.update).toHaveBeenCalled();
    });
  });

  describe('Admin User Listing', () => {
    it('should block non-admin from viewing user list', async () => {
      currentUserId = 'non-admin-999';

      mockPrisma.user.findUnique.mockResolvedValue({
        id: currentUserId,
        email: 'user@example.com',
        role: 'user',
      });

      const response = await request(app).get('/api/admin/users').expect(403);

      expect(response.body.error.message).toBe('Admin access required');
      expect(mockPrisma.user.findMany).not.toHaveBeenCalled();
    });

    it('should allow admin to view user list', async () => {
      currentUserId = 'admin-111';

      mockPrisma.user.findUnique.mockResolvedValue({
        id: currentUserId,
        email: 'admin@example.com',
        role: 'admin',
      });

      mockPrisma.user.findMany.mockResolvedValue([
        {
          id: 'user-1',
          email: 'user1@example.com',
          name: 'User One',
          tier: 'free',
          role: 'user',
          createdAt: new Date(),
        },
      ]);

      mockPrisma.user.count.mockResolvedValue(1);

      const response = await request(app).get('/api/admin/users').expect(200);

      expect(response.body).toHaveProperty('users');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.pagination).toHaveProperty('total');
      expect(mockPrisma.user.findMany).toHaveBeenCalled();
    });
  });

  describe('Admin Privilege Escalation Protection', () => {
    it('should verify admin role from database on every request', async () => {
      currentUserId = 'admin-role-check';

      mockPrisma.user.findUnique.mockResolvedValue({
        id: currentUserId,
        email: 'admin@example.com',
        role: 'admin',
      });

      mockPrisma.user.count.mockResolvedValue(0);
      mockPrisma.episode.count.mockResolvedValue(0);
      mockPrisma.course.count.mockResolvedValue(0);
      mockPrisma.inviteCode.count.mockResolvedValue(0);

      await request(app).get('/api/admin/stats').expect(200);

      // Verify role was checked via database lookup
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: currentUserId },
        select: { role: true },
      });
    });
  });
});
