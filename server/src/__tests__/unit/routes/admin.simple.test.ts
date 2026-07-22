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
}));
const mockAdminReads = vi.hoisted(() => ({
  createInviteCode: vi.fn(),
  deleteInviteCode: vi.fn(),
  deleteUser: vi.fn(),
  listInviteCodes: vi.fn(),
  listUsers: vi.fn(),
  showStats: vi.fn(),
  showUser: vi.fn(),
}));

const mockPronunciationDictionary = {
  keepKanji: ['橋'],
  forceKana: { 北海道: 'ほっかいどう' },
  verbKana: { 話す: 'はなす' },
  updatedAt: new Date('2024-01-01').toISOString(),
};

const mockGetPronunciationDictionary = vi.hoisted(() => vi.fn(() => mockPronunciationDictionary));
const mockUpdatePronunciationDictionary = vi.hoisted(() =>
  vi.fn(
    async (dictionary: {
      keepKanji: string[];
      forceKana: Record<string, string>;
      verbKana?: Record<string, string>;
    }) => ({
      ...dictionary,
      verbKana: dictionary.verbKana ?? mockPronunciationDictionary.verbKana,
      updatedAt: new Date('2024-01-02').toISOString(),
    })
  )
);
vi.mock('../../../db/client.js', () => ({ prisma: mockPrisma }));
vi.mock('../../../routes/learningOs/admin.js', () => ({
  createLearningOsAdminInviteCode: mockAdminReads.createInviteCode,
  deleteLearningOsAdminInviteCode: mockAdminReads.deleteInviteCode,
  deleteLearningOsAdminUser: mockAdminReads.deleteUser,
  listLearningOsAdminInviteCodes: mockAdminReads.listInviteCodes,
  listLearningOsAdminUsers: mockAdminReads.listUsers,
  showLearningOsAdminStats: mockAdminReads.showStats,
  showLearningOsAdminUser: mockAdminReads.showUser,
}));

// Mock auth middleware to inject test user
vi.mock('../../../middleware/auth.js', () => ({
  requireAuth: (req: Request, _res: Response, next: NextFunction) => {
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
  requireAdmin: (_req: Request, _res: Response, next: NextFunction) => next(),
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
    mockAdminReads.listInviteCodes.mockImplementation((_req, res) => res.json([]));
    mockAdminReads.deleteUser.mockImplementation((req, res, next) => {
      if (req.params.id === 'admin-user-id') {
        next(Object.assign(new Error('Cannot delete your own account'), { statusCode: 400 }));
      } else if (req.params.id === 'other-admin-id') {
        next(Object.assign(new Error('Cannot delete admin users'), { statusCode: 403 }));
      } else if (req.params.id === 'non-existent') {
        next(Object.assign(new Error('User not found'), { statusCode: 404 }));
      } else {
        res.json({ message: 'User deleted successfully' });
      }
    });
    mockAdminReads.createInviteCode.mockImplementation((req, res, next) => {
      if (req.body.customCode === 'DUPLICATE') {
        next(Object.assign(new Error('This code already exists'), { statusCode: 400 }));
      } else {
        res.json({ id: 'new-code-id', code: req.body.customCode ?? 'ABCD1234' });
      }
    });
    mockAdminReads.deleteInviteCode.mockImplementation((req, res, next) => {
      if (req.params.id === 'used-code-id') {
        next(Object.assign(new Error('Cannot delete used invite codes'), { statusCode: 400 }));
      } else if (req.params.id === 'non-existent') {
        next(Object.assign(new Error('Invite code not found'), { statusCode: 404 }));
      } else {
        res.json({ message: 'Invite code deleted successfully' });
      }
    });
    mockAdminReads.listUsers.mockImplementation((_req, res) =>
      res.json({ users: [], pagination: { page: 1, limit: 50, total: 0, pages: 1 } })
    );
    mockAdminReads.showStats.mockImplementation((_req, res) =>
      res.json({
        users: 42,
        episodes: 150,
        courses: 25,
        inviteCodes: { total: 100, used: 60, available: 40 },
      })
    );
    mockAdminReads.showUser.mockImplementation((req, res, next) => {
      if (req.params.id === 'non-existent') {
        next(Object.assign(new Error('User not found'), { statusCode: 404 }));
        return;
      }
      res.json({
        id: req.params.id,
        email: 'target@example.com',
        name: 'Target User',
        displayName: 'TUser',
        role: 'user',
      });
    });

    // Create Express app with admin routes
    app = express();
    app.use(expressJson());

    // Import router after mocks are set up
    const adminModule = await import('../../../routes/admin.js');
    adminRouter = adminModule.default;
    app.use('/admin', adminRouter);

    // Error handler
    app.use(((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
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
      expect(mockAdminReads.deleteUser).toHaveBeenCalledOnce();
    });

    it('should prevent deleting other admin users', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'other-admin-id',
        role: 'admin',
      });

      const response = await request(app).delete('/admin/users/other-admin-id');

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('Cannot delete admin users');
      expect(mockAdminReads.deleteUser).toHaveBeenCalledOnce();
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
      expect(mockAdminReads.deleteUser).toHaveBeenCalledOnce();
    });

    it('should return 404 for non-existent user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const response = await request(app).delete('/admin/users/non-existent');

      expect(response.status).toBe(404);
      expect(mockAdminReads.deleteUser).toHaveBeenCalledOnce();
    });
  });

  describe('Pronunciation Dictionaries', () => {
    it('should return pronunciation dictionary', async () => {
      const response = await request(app).get('/admin/pronunciation-dictionaries');

      expect(response.status).toBe(200);
      expect(response.body.keepKanji).toContain('橋');
      expect(response.body.verbKana).toHaveProperty('話す', 'はなす');
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
      expect(response.body.verbKana).toHaveProperty('話す', 'はなす');
      expect(mockUpdatePronunciationDictionary).toHaveBeenCalled();
    });

    it('should update pronunciation dictionary verbKana entries', async () => {
      const response = await request(app)
        .put('/admin/pronunciation-dictionaries')
        .send({ keepKanji: ['端'], forceKana: { 東京: 'とうきょう' }, verbKana: { 書く: 'かく' } });

      expect(response.status).toBe(200);
      expect(response.body.verbKana).toHaveProperty('書く', 'かく');
      expect(mockUpdatePronunciationDictionary).toHaveBeenCalledWith({
        keepKanji: ['端'],
        forceKana: { 東京: 'とうきょう' },
        verbKana: { 書く: 'かく' },
      });
    });

    it('should reject overly large keepKanji lists', async () => {
      const keepKanji = Array.from({ length: 501 }, (_, index) => `word-${index}`);
      const response = await request(app)
        .put('/admin/pronunciation-dictionaries')
        .send({ keepKanji, forceKana: {} });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('keepKanji must contain no more than');
    });

    it('should reject forceKana entries that exceed max length', async () => {
      const response = await request(app)
        .put('/admin/pronunciation-dictionaries')
        .send({ keepKanji: ['端'], forceKana: { 東京: 'a'.repeat(65) } });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('forceKana entries must be <=');
    });

    it('should reject invalid verbKana payloads', async () => {
      const response = await request(app)
        .put('/admin/pronunciation-dictionaries')
        .send({ keepKanji: ['端'], forceKana: {}, verbKana: [] });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('verbKana must be an object');
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
      expect(mockAdminReads.deleteInviteCode).toHaveBeenCalledOnce();
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
      expect(mockAdminReads.deleteInviteCode).toHaveBeenCalledOnce();
    });

    it('should return 404 for non-existent code', async () => {
      mockPrisma.inviteCode.findUnique.mockResolvedValue(null);

      const response = await request(app).delete('/admin/invite-codes/non-existent');

      expect(response.status).toBe(404);
      expect(mockAdminReads.deleteInviteCode).toHaveBeenCalledOnce();
    });
  });

  describe('GET /users - Search and pagination branches', () => {
    it('should handle search query', async () => {
      const response = await request(app).get('/admin/users?search=john');

      expect(response.status).toBe(200);
      expect(mockAdminReads.listUsers).toHaveBeenCalledWith(
        expect.objectContaining({ query: expect.objectContaining({ search: 'john' }) }),
        expect.anything(),
        expect.anything()
      );
    });

    it('should handle no search query (empty where clause)', async () => {
      const response = await request(app).get('/admin/users');

      expect(response.status).toBe(200);
      expect(mockAdminReads.listUsers).toHaveBeenCalledOnce();
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
      expect(mockAdminReads.createInviteCode).toHaveBeenCalledOnce();
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
      expect(mockAdminReads.createInviteCode).toHaveBeenCalledOnce();
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

  describe('GET /stats - Analytics dashboard', () => {
    it('should return analytics counts', async () => {
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
      mockAdminReads.showStats.mockImplementationOnce((_req, res) =>
        res.json({
          users: 0,
          episodes: 0,
          courses: 0,
          inviteCodes: { total: 0, used: 0, available: 0 },
        })
      );

      const response = await request(app).get('/admin/stats');

      expect(response.status).toBe(200);
      expect(response.body.users).toBe(0);
      expect(response.body.inviteCodes.total).toBe(0);
    });
  });

  describe('GET /users/:id/info - User impersonation info', () => {
    it('should return user info for impersonation', async () => {
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
      const response = await request(app).get('/admin/users/non-existent/info');

      expect(response.status).toBe(404);
    });
  });
});
