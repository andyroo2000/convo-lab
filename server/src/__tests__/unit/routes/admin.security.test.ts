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
  requireAuth: (req: AuthRequest, _res: Response, next: NextFunction) => {
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
}));
const mockAdminReads = vi.hoisted(() => ({
  listInviteCodes: vi.fn(),
  listSpeakerAvatars: vi.fn(),
  listUsers: vi.fn(),
  showPronunciationDictionary: vi.fn(),
  showSpeakerAvatarOriginal: vi.fn(),
  showStats: vi.fn(),
  showUser: vi.fn(),
}));
const mockAdminMutations = vi.hoisted(() => ({
  createInviteCode: vi.fn(),
  deleteInviteCode: vi.fn(),
  deleteUser: vi.fn(),
  recropSpeakerAvatar: vi.fn(),
  uploadSpeakerAvatar: vi.fn(),
  uploadUserAvatar: vi.fn(),
  updatePronunciationDictionary: vi.fn(),
}));

vi.mock('../../../db/client.js', () => ({
  prisma: mockPrisma,
}));
vi.mock('../../../routes/learningOs/admin.js', () => ({
  createLearningOsAdminInviteCode: mockAdminMutations.createInviteCode,
  deleteLearningOsAdminInviteCode: mockAdminMutations.deleteInviteCode,
  deleteLearningOsAdminUser: mockAdminMutations.deleteUser,
  listLearningOsAdminInviteCodes: mockAdminReads.listInviteCodes,
  listLearningOsAdminSpeakerAvatars: mockAdminReads.listSpeakerAvatars,
  listLearningOsAdminUsers: mockAdminReads.listUsers,
  showLearningOsAdminPronunciationDictionary: mockAdminReads.showPronunciationDictionary,
  showLearningOsAdminSpeakerAvatarOriginal: mockAdminReads.showSpeakerAvatarOriginal,
  showLearningOsAdminStats: mockAdminReads.showStats,
  showLearningOsAdminUser: mockAdminReads.showUser,
  recropLearningOsAdminSpeakerAvatar: mockAdminMutations.recropSpeakerAvatar,
  uploadLearningOsAdminSpeakerAvatar: mockAdminMutations.uploadSpeakerAvatar,
  uploadLearningOsAdminUserAvatar: mockAdminMutations.uploadUserAvatar,
  updateLearningOsAdminPronunciationDictionary: mockAdminMutations.updatePronunciationDictionary,
}));

vi.mock('../../../services/japanesePronunciationOverrides.js', () => ({
  getJapanesePronunciationDictionary: vi.fn(() => ({ keepKanji: [], forceKana: {}, verbKana: {} })),
  updateJapanesePronunciationDictionary: vi.fn(async () => ({
    keepKanji: [],
    forceKana: {},
    verbKana: {},
  })),
}));

describe('Admin Security Tests', () => {
  let app: express.Application;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdminReads.listInviteCodes.mockImplementation((_req, res) => res.json([]));
    mockAdminReads.listSpeakerAvatars.mockImplementation((_req, res) => res.json([]));
    mockAdminReads.showSpeakerAvatarOriginal.mockImplementation((_req, res) =>
      res.json({ originalUrl: 'https://storage.example/original.jpg' })
    );
    mockAdminReads.showPronunciationDictionary.mockImplementation((_req, res) =>
      res.json({ keepKanji: [], forceKana: {}, verbKana: {} })
    );
    mockAdminMutations.updatePronunciationDictionary.mockImplementation((_req, res) =>
      res.json({ keepKanji: [], forceKana: {}, verbKana: {} })
    );
    mockAdminReads.listUsers.mockImplementation((_req, res) =>
      res.json({ users: [], pagination: { page: 1, limit: 50, total: 0, pages: 1 } })
    );
    mockAdminReads.showStats.mockImplementation((_req, res) =>
      res.json({
        users: 10,
        episodes: 50,
        courses: 20,
        inviteCodes: { total: 15, used: 8, available: 7 },
      })
    );
    mockAdminReads.showUser.mockImplementation((_req, res) => res.json({}));
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

      const response = await request(app).get('/api/admin/users').expect(200);

      expect(response.body).toHaveProperty('users');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.pagination).toHaveProperty('total');
      expect(mockAdminReads.listUsers).toHaveBeenCalled();
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

      await request(app).get('/api/admin/stats').expect(200);

      // Verify role was checked via database lookup
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: currentUserId },
        select: { role: true },
      });
    });
  });
});
