import express, {
  json as expressJson,
  type Router,
  type Request,
  type Response,
  type NextFunction,
  type ErrorRequestHandler,
} from 'express';
import request from 'supertest';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Prisma client
const mockPrisma = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  inviteCode: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  featureFlag: {
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn(),
  },
  episode: { count: vi.fn() },
  course: { count: vi.fn() },
  subscription: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  subscriptionEvent: {
    create: vi.fn(),
  },
}));

const mockPronunciationDictionary = {
  keepKanji: ['橋'],
  forceKana: { 北海道: 'ほっかいどう' },
  updatedAt: new Date('2024-01-01').toISOString(),
};

const mockGetPronunciationDictionary = vi.hoisted(() => vi.fn(() => mockPronunciationDictionary));
const mockUpdatePronunciationDictionary = vi.hoisted(() =>
  vi.fn(async (dictionary: { keepKanji: string[]; forceKana: Record<string, string> }) => ({
    ...dictionary,
    updatedAt: new Date('2024-01-02').toISOString(),
  }))
);

vi.mock('../../../db/client.js', () => ({ prisma: mockPrisma }));

// Mock auth middleware to inject test user
vi.mock('../../../middleware/auth.js', () => ({
  requireAuth: (req: Request, res: Response, next: NextFunction) => {
    (req as Request & { user: { id: string; role: string; email: string }; userId: string }).user =
      {
        id: 'admin-user-id',
        role: 'admin',
        email: 'admin@example.com',
      };
    (req as Request & { userId: string }).userId = 'admin-user-id'; // Add userId property
    next();
  },
  AuthRequest: class {},
}));

// Mock role auth middleware
vi.mock('../../../middleware/roleAuth.js', () => ({
  requireAdmin: (req: Request, res: Response, next: NextFunction) => next(),
}));

// Mock avatar service
vi.mock('../../../services/avatarService.js', () => ({
  uploadUserAvatar: vi.fn(),
  uploadSpeakerAvatar: vi.fn(),
  recropSpeakerAvatar: vi.fn(),
  getSpeakerAvatarOriginalUrl: vi.fn(),
  getAllSpeakerAvatars: vi.fn(),
}));

vi.mock('../../../services/japanesePronunciationOverrides.js', () => ({
  getJapanesePronunciationDictionary: mockGetPronunciationDictionary,
  updateJapanesePronunciationDictionary: mockUpdatePronunciationDictionary,
}));

// Mock AppError
vi.mock('../../../middleware/errorHandler.js', () => ({
  AppError: class AppError extends Error {
    constructor(
      message: string,
      public statusCode: number = 500
    ) {
      super(message);
      this.name = 'AppError';
    }
  },
}));

describe('Admin Routes - Critical Branch Coverage', () => {
  let app: express.Application;
  let adminRouter: Router;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Create Express app with admin routes
    app = express();
    app.use(expressJson());

    // Import router after mocks are set up
    const adminModule = await import('../../../routes/admin.js');
    adminRouter = adminModule.default;
    app.use('/admin', adminRouter);

    // Error handler
    app.use(((err: unknown, req: Request, res: Response, _next: NextFunction) => {
      const error = err as { statusCode?: number; message: string };
      res.status(error.statusCode || 500).json({
        error: error.message,
        statusCode: error.statusCode,
      });
    }) as ErrorRequestHandler);
  });

  describe('DELETE /users/:id - Self-deletion prevention', () => {
    it('should prevent admin from deleting their own account', async () => {
      const response = await request(app).delete('/admin/users/admin-user-id');

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Cannot delete your own account');
      expect(mockPrisma.user.delete).not.toHaveBeenCalled();
    });

    it('should prevent deleting other admin users', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'other-admin-id',
        role: 'admin',
      });

      const response = await request(app).delete('/admin/users/other-admin-id');

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('Cannot delete admin users');
      expect(mockPrisma.user.delete).not.toHaveBeenCalled();
    });

    it('should allow deleting regular users', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'regular-user-id',
        role: 'user',
      });

      mockPrisma.user.delete.mockResolvedValue({
        id: 'regular-user-id',
      });

      const response = await request(app).delete('/admin/users/regular-user-id');

      expect(response.status).toBe(200);
      expect(mockPrisma.user.delete).toHaveBeenCalledWith({
        where: { id: 'regular-user-id' },
      });
    });

    it('should return 404 for non-existent user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const response = await request(app).delete('/admin/users/non-existent');

      expect(response.status).toBe(404);
      expect(mockPrisma.user.delete).not.toHaveBeenCalled();
    });
  });

  describe('Pronunciation Dictionaries', () => {
    it('should return pronunciation dictionary', async () => {
      const response = await request(app).get('/admin/pronunciation-dictionaries');

      expect(response.status).toBe(200);
      expect(response.body.keepKanji).toContain('橋');
      expect(mockGetPronunciationDictionary).toHaveBeenCalled();
    });

    it('should validate keepKanji payload', async () => {
      const response = await request(app)
        .put('/admin/pronunciation-dictionaries')
        .send({ forceKana: {} });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('keepKanji must be an array');
    });

    it('should validate forceKana payload', async () => {
      const response = await request(app)
        .put('/admin/pronunciation-dictionaries')
        .send({ keepKanji: ['橋'], forceKana: [] });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('forceKana must be an object');
    });

    it('should update pronunciation dictionary', async () => {
      const response = await request(app)
        .put('/admin/pronunciation-dictionaries')
        .send({ keepKanji: ['端'], forceKana: { 東京: 'とうきょう' } });

      expect(response.status).toBe(200);
      expect(response.body.keepKanji).toContain('端');
      expect(response.body.forceKana).toHaveProperty('東京', 'とうきょう');
      expect(mockUpdatePronunciationDictionary).toHaveBeenCalled();
    });
  });

  describe('DELETE /invite-codes/:id - Used code protection', () => {
    it('should prevent deleting used invite codes', async () => {
      mockPrisma.inviteCode.findUnique.mockResolvedValue({
        id: 'used-code-id',
        code: 'USED123',
        usedBy: 'user-id',
      });

      const response = await request(app).delete('/admin/invite-codes/used-code-id');

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Cannot delete used invite code');
      expect(mockPrisma.inviteCode.delete).not.toHaveBeenCalled();
    });

    it('should allow deleting unused invite codes', async () => {
      mockPrisma.inviteCode.findUnique.mockResolvedValue({
        id: 'unused-code-id',
        code: 'UNUSED123',
        usedBy: null,
      });

      mockPrisma.inviteCode.delete.mockResolvedValue({
        id: 'unused-code-id',
      });

      const response = await request(app).delete('/admin/invite-codes/unused-code-id');

      expect(response.status).toBe(200);
      expect(mockPrisma.inviteCode.delete).toHaveBeenCalled();
    });

    it('should return 404 for non-existent code', async () => {
      mockPrisma.inviteCode.findUnique.mockResolvedValue(null);

      const response = await request(app).delete('/admin/invite-codes/non-existent');

      expect(response.status).toBe(404);
      expect(mockPrisma.inviteCode.delete).not.toHaveBeenCalled();
    });
  });

  describe('GET /users - Search and pagination branches', () => {
    it('should handle search query', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);
      mockPrisma.user.count.mockResolvedValue(0);

      const response = await request(app).get('/admin/users?search=john');

      expect(response.status).toBe(200);
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: expect.arrayContaining([{ email: { contains: 'john', mode: 'insensitive' } }]),
          },
        })
      );
    });

    it('should handle no search query (empty where clause)', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);
      mockPrisma.user.count.mockResolvedValue(0);

      const response = await request(app).get('/admin/users');

      expect(response.status).toBe(200);
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {},
        })
      );
    });
  });

  describe('POST /invite-codes - Custom vs random code generation', () => {
    it('should generate random code when none provided', async () => {
      mockPrisma.inviteCode.findUnique.mockResolvedValue(null);
      mockPrisma.inviteCode.create.mockResolvedValue({
        id: 'new-code-id',
        code: 'ABCD1234',
      });

      const response = await request(app).post('/admin/invite-codes').send({});

      expect(response.status).toBe(200);
      expect(mockPrisma.inviteCode.create).toHaveBeenCalledWith({
        data: { code: expect.any(String) },
      });
    });

    it('should use custom code when provided', async () => {
      mockPrisma.inviteCode.findUnique.mockResolvedValue(null);
      mockPrisma.inviteCode.create.mockResolvedValue({
        id: 'new-code-id',
        code: 'CUSTOM123',
      });

      const response = await request(app)
        .post('/admin/invite-codes')
        .send({ customCode: 'CUSTOM123' });

      expect(response.status).toBe(200);
      expect(mockPrisma.inviteCode.create).toHaveBeenCalledWith({
        data: { code: 'CUSTOM123' },
      });
    });

    it('should handle duplicate code error', async () => {
      mockPrisma.inviteCode.findUnique.mockResolvedValue({
        id: 'existing-id',
        code: 'DUPLICATE',
      });

      const response = await request(app)
        .post('/admin/invite-codes')
        .send({ customCode: 'DUPLICATE' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('already exists');
    });
  });

  describe('GET /feature-flags - Create defaults if missing', () => {
    it('should return existing flags', async () => {
      mockPrisma.featureFlag.findFirst.mockResolvedValue({
        id: 'flags-id',
        dialoguesEnabled: true,
        audioCourseEnabled: true,
      });

      const response = await request(app).get('/admin/feature-flags');

      expect(response.status).toBe(200);
      expect(response.body.dialoguesEnabled).toBe(true);
      expect(mockPrisma.featureFlag.create).not.toHaveBeenCalled();
    });

    it('should create default flags if none exist', async () => {
      mockPrisma.featureFlag.findFirst.mockResolvedValue(null);
      mockPrisma.featureFlag.create.mockResolvedValue({
        id: 'new-flags-id',
        dialoguesEnabled: true,
        audioCourseEnabled: true,
      });

      const response = await request(app).get('/admin/feature-flags');

      expect(response.status).toBe(200);
      expect(mockPrisma.featureFlag.create).toHaveBeenCalledWith({
        data: {
          dialoguesEnabled: true,
          audioCourseEnabled: true,
        },
      });
    });
  });

  describe('PATCH /feature-flags - Update vs create', () => {
    it('should update existing flags', async () => {
      mockPrisma.featureFlag.findFirst.mockResolvedValue({
        id: 'flags-id',
        dialoguesEnabled: false,
        audioCourseEnabled: true,
      });

      mockPrisma.featureFlag.update.mockResolvedValue({
        id: 'flags-id',
        dialoguesEnabled: true,
        audioCourseEnabled: true,
      });

      const response = await request(app)
        .patch('/admin/feature-flags')
        .send({ dialoguesEnabled: true });

      expect(response.status).toBe(200);
      expect(mockPrisma.featureFlag.update).toHaveBeenCalled();
      expect(mockPrisma.featureFlag.create).not.toHaveBeenCalled();
    });

    it('should create flags on first update if none exist', async () => {
      mockPrisma.featureFlag.findFirst.mockResolvedValue(null);
      mockPrisma.featureFlag.create.mockResolvedValue({
        id: 'new-flags-id',
        dialoguesEnabled: false,
        audioCourseEnabled: true,
      });

      const response = await request(app)
        .patch('/admin/feature-flags')
        .send({ dialoguesEnabled: false });

      expect(response.status).toBe(200);
      expect(mockPrisma.featureFlag.create).toHaveBeenCalled();
      expect(mockPrisma.featureFlag.update).not.toHaveBeenCalled();
    });

    it('should validate boolean types', async () => {
      mockPrisma.featureFlag.findFirst.mockResolvedValue({
        id: 'flags-id',
        dialoguesEnabled: false,
        audioCourseEnabled: true,
      });

      const response = await request(app)
        .patch('/admin/feature-flags')
        .send({ dialoguesEnabled: 'not-a-boolean' });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /users/:id/test-user - Boolean validation', () => {
    it('should accept boolean true', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-id',
        email: 'user@example.com',
        isTestUser: false,
      });

      mockPrisma.user.update.mockResolvedValue({
        id: 'user-id',
        email: 'user@example.com',
        isTestUser: true,
      });

      const response = await request(app)
        .post('/admin/users/user-id/test-user')
        .send({ isTestUser: true });

      expect(response.status).toBe(200);
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-id' },
          data: { isTestUser: true },
        })
      );
    });

    it('should accept boolean false', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-id',
        email: 'user@example.com',
        isTestUser: true,
      });

      mockPrisma.user.update.mockResolvedValue({
        id: 'user-id',
        email: 'user@example.com',
        isTestUser: false,
      });

      const response = await request(app)
        .post('/admin/users/user-id/test-user')
        .send({ isTestUser: false });

      expect(response.status).toBe(200);
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-id' },
          data: { isTestUser: false },
        })
      );
    });

    it('should reject non-boolean values', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-id',
        email: 'user@example.com',
        isTestUser: false,
      });

      const response = await request(app)
        .post('/admin/users/user-id/test-user')
        .send({ isTestUser: 'not-boolean' });

      expect(response.status).toBe(400);
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('should return 404 for non-existent user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .post('/admin/users/user-id/test-user')
        .send({ isTestUser: true });

      expect(response.status).toBe(404);
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });
  });

  describe('GET /stats - Analytics dashboard', () => {
    it('should return analytics counts', async () => {
      mockPrisma.user.count.mockResolvedValue(42);
      mockPrisma.episode.count.mockResolvedValue(150);
      mockPrisma.course.count.mockResolvedValue(25);
      mockPrisma.inviteCode.count
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(60); // used

      const response = await request(app).get('/admin/stats');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        users: 42,
        episodes: 150,
        courses: 25,
        inviteCodes: {
          total: 100,
          used: 60,
          available: 40,
        },
      });
    });

    it('should handle zero counts', async () => {
      mockPrisma.user.count.mockResolvedValue(0);
      mockPrisma.episode.count.mockResolvedValue(0);
      mockPrisma.course.count.mockResolvedValue(0);
      mockPrisma.inviteCode.count.mockResolvedValue(0);

      const response = await request(app).get('/admin/stats');

      expect(response.status).toBe(200);
      expect(response.body.users).toBe(0);
      expect(response.body.inviteCodes.total).toBe(0);
    });
  });

  describe('GET /users/:id/info - User impersonation info', () => {
    it('should return user info for impersonation', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'target-user-id',
        email: 'target@example.com',
        name: 'Target User',
        displayName: 'TUser',
        role: 'user',
      });

      const response = await request(app).get('/admin/users/target-user-id/info');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        id: 'target-user-id',
        email: 'target@example.com',
        name: 'Target User',
        displayName: 'TUser',
        role: 'user',
      });
    });

    it('should return 404 for non-existent user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const response = await request(app).get('/admin/users/non-existent/info');

      expect(response.status).toBe(404);
    });
  });

  describe('GET /users/:id/subscription - Subscription details', () => {
    it('should return subscription details', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-id',
        email: 'user@example.com',
        name: 'User Name',
        tier: 'pro',
        stripeCustomerId: 'cus_123',
        stripeSubscriptionId: 'sub_123',
        stripeSubscriptionStatus: 'active',
        stripePriceId: 'price_123',
        subscriptionStartedAt: new Date('2024-01-01'),
        subscriptionExpiresAt: new Date('2024-12-31'),
        subscriptionCanceledAt: null,
      });

      const response = await request(app).get('/admin/users/user-id/subscription');

      expect(response.status).toBe(200);
      expect(response.body.tier).toBe('pro');
      expect(response.body.stripeCustomerId).toBe('cus_123');
      expect(response.body.stripeSubscriptionStatus).toBe('active');
    });

    it('should return 404 for non-existent user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const response = await request(app).get('/admin/users/non-existent/subscription');

      expect(response.status).toBe(404);
    });
  });

  describe('POST /users/:id/tier - Manual tier override', () => {
    it('should update user tier from free to pro', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-id',
        email: 'user@example.com',
        tier: 'free',
      });

      mockPrisma.user.update.mockResolvedValue({
        id: 'user-id',
        email: 'user@example.com',
        tier: 'pro',
      });

      mockPrisma.subscriptionEvent.create.mockResolvedValue({
        id: 'event-id',
        userId: 'user-id',
        eventType: 'admin_override',
        fromTier: 'free',
        toTier: 'pro',
        stripeEventId: 'admin:admin-user-id:testing',
        createdAt: new Date(),
      });

      const response = await request(app)
        .post('/admin/users/user-id/tier')
        .send({ tier: 'pro', reason: 'testing' });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('free to pro');
      expect(mockPrisma.subscriptionEvent.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-id',
          eventType: 'admin_override',
          fromTier: 'free',
          toTier: 'pro',
          stripeEventId: expect.stringContaining('admin:'),
        },
      });
    });

    it('should reject invalid tier value', async () => {
      const response = await request(app)
        .post('/admin/users/user-id/tier')
        .send({ tier: 'premium', reason: 'testing' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid tier');
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('should return 404 for non-existent user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .post('/admin/users/non-existent/tier')
        .send({ tier: 'pro' });

      expect(response.status).toBe(404);
    });

    it('should handle tier downgrade from pro to free', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-id',
        email: 'user@example.com',
        tier: 'pro',
      });

      mockPrisma.user.update.mockResolvedValue({
        id: 'user-id',
        email: 'user@example.com',
        tier: 'free',
      });

      mockPrisma.subscriptionEvent.create.mockResolvedValue({
        id: 'event-id',
        userId: 'user-id',
        eventType: 'admin_override',
        fromTier: 'pro',
        toTier: 'free',
        stripeEventId: 'admin:admin-user-id:abuse',
        createdAt: new Date(),
      });

      const response = await request(app)
        .post('/admin/users/user-id/tier')
        .send({ tier: 'free', reason: 'abuse' });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('pro to free');
    });
  });

  describe('POST /users/:id/subscription/cancel - Cancel subscription', () => {
    it('should return 404 for non-existent user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .post('/admin/users/non-existent/subscription/cancel')
        .send({ reason: 'testing' });

      expect(response.status).toBe(404);
    });

    it('should return 400 if user has no active subscription', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-id',
        email: 'user@example.com',
        tier: 'free',
        stripeSubscriptionId: null,
      });

      const response = await request(app)
        .post('/admin/users/user-id/subscription/cancel')
        .send({ reason: 'testing' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('no active subscription');
    });

    // Note: Success path test omitted because it requires complex Stripe SDK mocking
    // with dynamic imports. The critical error paths (404, 400) are tested above.
  });
});
