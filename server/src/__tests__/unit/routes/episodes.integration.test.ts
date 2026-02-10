/* eslint-disable import/no-named-as-default-member */
import express, { Response, NextFunction } from 'express';
import request from 'supertest';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { AuthRequest } from '../../../middleware/auth.js';
import { errorHandler } from '../../../middleware/errorHandler.js';
import episodesRouter from '../../../routes/episodes.js';

// Create hoisted mocks
const mockPrisma = vi.hoisted(() => ({
  episode: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
  },
}));

const mockGetLibraryUserId = vi.hoisted(() => vi.fn());
const mockGetEffectiveUserId = vi.hoisted(() => vi.fn());
const mockBlockDemoUser = vi.hoisted(() =>
  vi.fn((req: AuthRequest, res: Response, next: NextFunction) => next())
);

vi.mock('../../../db/client.js', () => ({
  prisma: mockPrisma,
}));

vi.mock('../../../middleware/demoAuth.js', () => ({
  blockDemoUser: mockBlockDemoUser,
  getLibraryUserId: mockGetLibraryUserId,
}));

vi.mock('../../../middleware/impersonation.js', () => ({
  getEffectiveUserId: mockGetEffectiveUserId,
}));

vi.mock('../../../middleware/auth.js', () => ({
  requireAuth: vi.fn((req: AuthRequest, res: Response, next: NextFunction) => {
    req.userId = 'test-user-id';
    next();
  }),
  AuthRequest: class {},
}));

vi.mock('../../../i18n/index.js', () => ({
  default: {
    t: (key: string, params?: Record<string, unknown>) => {
      if (key === 'server:content.notFound') return `${params?.type} not found`;
      if (key === 'server:content.missingFields') return 'Missing required fields';
      if (key === 'server:content.updateSuccess') return `${params?.type} updated successfully`;
      if (key === 'server:content.deleteSuccess') return `${params?.type} deleted successfully`;
      return key;
    },
  },
}));

describe('Episodes Routes Integration', () => {
  let app: express.Application;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetLibraryUserId.mockResolvedValue('test-user-id');
    mockGetEffectiveUserId.mockResolvedValue('test-user-id');
    mockBlockDemoUser.mockImplementation((req: AuthRequest, res: Response, next: NextFunction) =>
      next()
    );

    app = express();
    app.use(express.json());
    app.use('/api/episodes', episodesRouter);
    app.use(errorHandler);
  });

  describe('GET /api/episodes - List Episodes', () => {
    it('should return episodes in library mode', async () => {
      const mockEpisodes = [
        {
          id: 'ep-1',
          title: 'Episode 1',
          sourceText: 'Source 1',
          targetLanguage: 'ja',
          status: 'ready',
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-02'),
          dialogue: { speakers: [{ proficiency: 'intermediate' }] },
        },
        {
          id: 'ep-2',
          title: 'Episode 2',
          sourceText: 'Source 2',
          targetLanguage: 'ja',
          status: 'ready',
          createdAt: new Date('2024-01-03'),
          updatedAt: new Date('2024-01-04'),
          dialogue: { speakers: [{ proficiency: 'beginner' }] },
        },
      ];

      mockPrisma.episode.findMany.mockResolvedValue(mockEpisodes);

      const response = await request(app).get('/api/episodes?library=true').expect(200);

      // JSON serializes dates to ISO strings
      expect(response.body).toEqual([
        {
          ...mockEpisodes[0],
          createdAt: mockEpisodes[0].createdAt.toISOString(),
          updatedAt: mockEpisodes[0].updatedAt.toISOString(),
        },
        {
          ...mockEpisodes[1],
          createdAt: mockEpisodes[1].createdAt.toISOString(),
          updatedAt: mockEpisodes[1].updatedAt.toISOString(),
        },
      ]);
      expect(mockPrisma.episode.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'test-user-id',
          dialogue: { isNot: null },
        },
        select: {
          id: true,
          title: true,
          sourceText: true,
          targetLanguage: true,
          status: true,
          isSampleContent: true,
          createdAt: true,
          updatedAt: true,
          dialogue: {
            select: {
              speakers: {
                select: {
                  proficiency: true,
                },
              },
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
        take: 50,
        skip: 0,
      });
    });

    it('should return episodes in full mode with includes', async () => {
      const mockEpisodes = [
        {
          id: 'ep-1',
          title: 'Episode 1',
          dialogue: {
            sentences: [{ id: 's1', text: 'Hello' }],
            speakers: [{ id: 'sp1', name: 'Speaker 1' }],
          },
          images: [{ id: 'img1', url: 'http://example.com/img1.jpg' }],
        },
      ];

      mockPrisma.episode.findMany.mockResolvedValue(mockEpisodes);

      const response = await request(app).get('/api/episodes').expect(200);

      expect(response.body).toEqual(mockEpisodes);
      expect(mockPrisma.episode.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'test-user-id',
          dialogue: { isNot: null },
        },
        include: {
          dialogue: {
            include: {
              sentences: true,
              speakers: true,
            },
          },
          images: true,
        },
        orderBy: { updatedAt: 'desc' },
        take: 50,
        skip: 0,
      });
    });

    it('should support custom limit and offset', async () => {
      mockPrisma.episode.findMany.mockResolvedValue([]);

      await request(app).get('/api/episodes?limit=20&offset=40').expect(200);

      expect(mockPrisma.episode.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 20,
          skip: 40,
        })
      );
    });

    it('should handle errors gracefully', async () => {
      mockPrisma.episode.findMany.mockRejectedValue(new Error('Database error'));

      const response = await request(app).get('/api/episodes').expect(500);

      expect(response.body.error).toBeDefined();
    });
  });

  describe('GET /api/episodes/:id - Single Episode', () => {
    it('should return episode with full details', async () => {
      const mockEpisode = {
        id: 'ep-123',
        title: 'Test Episode',
        userId: 'test-user-id',
        dialogue: {
          sentences: [
            { id: 's1', text: 'Hello', order: 1 },
            { id: 's2', text: 'World', order: 2 },
          ],
          speakers: [{ id: 'sp1', name: 'Speaker 1' }],
        },
        images: [{ id: 'img1', url: 'http://example.com/img1.jpg', order: 1 }],
      };

      mockPrisma.episode.findFirst.mockResolvedValue(mockEpisode);

      const response = await request(app).get('/api/episodes/ep-123').expect(200);

      expect(response.body).toEqual(mockEpisode);
      expect(response.headers['cache-control']).toBe('private, max-age=60');
      expect(mockPrisma.episode.findFirst).toHaveBeenCalledWith({
        where: { id: 'ep-123', userId: 'test-user-id' },
        include: {
          dialogue: {
            include: {
              sentences: { orderBy: { order: 'asc' } },
              speakers: true,
            },
          },
          images: { orderBy: { order: 'asc' } },
          courseEpisodes: {
            select: {
              courseId: true,
            },
          },
        },
      });
    });

    it('should return 404 when episode not found', async () => {
      mockPrisma.episode.findFirst.mockResolvedValue(null);

      const response = await request(app).get('/api/episodes/non-existent').expect(404);

      expect(response.body.error.message).toBe('Episode not found');
    });

    it('should use effective user ID for demo users', async () => {
      mockGetEffectiveUserId.mockResolvedValue('admin-user-id');
      mockPrisma.episode.findFirst.mockResolvedValue({
        id: 'ep-123',
        userId: 'admin-user-id',
        dialogue: { sentences: [], speakers: [] },
        images: [],
      });

      await request(app).get('/api/episodes/ep-123').expect(200);

      expect(mockGetEffectiveUserId).toHaveBeenCalled();
      expect(mockPrisma.episode.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ep-123', userId: 'admin-user-id' },
        })
      );
    });
  });

  describe('POST /api/episodes - Create Episode', () => {
    it('should create episode with required fields', async () => {
      const newEpisode = {
        id: 'new-ep',
        userId: 'test-user-id',
        title: 'New Episode',
        sourceText: 'Test source text',
        targetLanguage: 'ja',
        nativeLanguage: 'en',
        audioSpeed: 'medium',
        status: 'draft',
        jlptLevel: null,
        autoGenerateAudio: true,
      };

      mockPrisma.episode.create.mockResolvedValue(newEpisode);

      const response = await request(app)
        .post('/api/episodes')
        .send({
          title: 'New Episode',
          sourceText: 'Test source text',
          targetLanguage: 'ja',
          nativeLanguage: 'en',
        })
        .expect(200);

      expect(response.body).toEqual(newEpisode);
      expect(mockPrisma.episode.create).toHaveBeenCalledWith({
        data: {
          userId: 'test-user-id',
          title: 'New Episode',
          sourceText: 'Test source text',
          targetLanguage: 'ja',
          nativeLanguage: 'en',
          audioSpeed: 'medium',
          status: 'draft',
          jlptLevel: null,
          autoGenerateAudio: true,
        },
      });
    });

    it('should use custom audioSpeed when provided', async () => {
      mockPrisma.episode.create.mockResolvedValue({
        id: 'new-ep',
        audioSpeed: 'slow',
      });

      await request(app)
        .post('/api/episodes')
        .send({
          title: 'Test',
          sourceText: 'Source',
          targetLanguage: 'ja',
          nativeLanguage: 'en',
          audioSpeed: 'slow',
        })
        .expect(200);

      expect(mockPrisma.episode.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          audioSpeed: 'slow',
        }),
      });
    });

    it('should return 400 when title is missing', async () => {
      const response = await request(app)
        .post('/api/episodes')
        .send({
          sourceText: 'Source',
          targetLanguage: 'ja',
          nativeLanguage: 'en',
        })
        .expect(400);

      expect(response.body.error.message).toBe('Missing required fields');
      expect(mockPrisma.episode.create).not.toHaveBeenCalled();
    });

    it('should return 400 when sourceText is missing', async () => {
      const response = await request(app)
        .post('/api/episodes')
        .send({
          title: 'Test',
          targetLanguage: 'ja',
          nativeLanguage: 'en',
        })
        .expect(400);

      expect(response.body.error.message).toBe('Missing required fields');
    });

    it('should return 400 when targetLanguage is missing', async () => {
      const response = await request(app)
        .post('/api/episodes')
        .send({
          title: 'Test',
          sourceText: 'Source',
          nativeLanguage: 'en',
        })
        .expect(400);

      expect(response.body.error.message).toBe('Missing required fields');
    });

    it('should return 400 when nativeLanguage is missing', async () => {
      const response = await request(app)
        .post('/api/episodes')
        .send({
          title: 'Test',
          sourceText: 'Source',
          targetLanguage: 'ja',
        })
        .expect(400);

      expect(response.body.error.message).toBe('Missing required fields');
    });

    it('should block demo users from creating episodes', async () => {
      mockBlockDemoUser.mockImplementation((req: AuthRequest, res: Response) => {
        res.status(403).json({ error: { message: 'Demo users cannot perform this action' } });
      });

      const response = await request(app)
        .post('/api/episodes')
        .send({
          title: 'Test',
          sourceText: 'Source',
          targetLanguage: 'ja',
          nativeLanguage: 'en',
        })
        .expect(403);

      expect(response.body.error.message).toBe('Demo users cannot perform this action');
    });
  });

  describe('PATCH /api/episodes/:id - Update Episode', () => {
    it('should update episode title', async () => {
      mockPrisma.episode.updateMany.mockResolvedValue({ count: 1 });

      const response = await request(app)
        .patch('/api/episodes/ep-123')
        .send({ title: 'Updated Title' })
        .expect(200);

      expect(response.body.message).toBe('Episode updated successfully');
      expect(mockPrisma.episode.updateMany).toHaveBeenCalledWith({
        where: { id: 'ep-123', userId: 'test-user-id' },
        data: expect.objectContaining({
          title: 'Updated Title',
          updatedAt: expect.any(Date),
        }),
      });
    });

    it('should update episode status', async () => {
      mockPrisma.episode.updateMany.mockResolvedValue({ count: 1 });

      await request(app).patch('/api/episodes/ep-123').send({ status: 'ready' }).expect(200);

      expect(mockPrisma.episode.updateMany).toHaveBeenCalledWith({
        where: { id: 'ep-123', userId: 'test-user-id' },
        data: expect.objectContaining({
          status: 'ready',
        }),
      });
    });

    it('should update both title and status', async () => {
      mockPrisma.episode.updateMany.mockResolvedValue({ count: 1 });

      await request(app)
        .patch('/api/episodes/ep-123')
        .send({ title: 'New Title', status: 'ready' })
        .expect(200);

      expect(mockPrisma.episode.updateMany).toHaveBeenCalledWith({
        where: { id: 'ep-123', userId: 'test-user-id' },
        data: expect.objectContaining({
          title: 'New Title',
          status: 'ready',
        }),
      });
    });

    it('should return 404 when episode not found', async () => {
      mockPrisma.episode.updateMany.mockResolvedValue({ count: 0 });

      const response = await request(app)
        .patch('/api/episodes/non-existent')
        .send({ title: 'Updated' })
        .expect(404);

      expect(response.body.error.message).toBe('Episode not found');
    });

    it('should only update provided fields', async () => {
      mockPrisma.episode.updateMany.mockResolvedValue({ count: 1 });

      await request(app).patch('/api/episodes/ep-123').send({ title: 'Only Title' }).expect(200);

      const callArgs = mockPrisma.episode.updateMany.mock.calls[0][0];
      expect(callArgs.data.title).toBe('Only Title');
      expect(callArgs.data.status).toBeUndefined();
    });
  });

  describe('DELETE /api/episodes/:id - Delete Episode', () => {
    it('should delete episode successfully', async () => {
      mockPrisma.episode.deleteMany.mockResolvedValue({ count: 1 });

      const response = await request(app).delete('/api/episodes/ep-123').expect(200);

      expect(response.body.message).toBe('Episode deleted successfully');
      expect(mockPrisma.episode.deleteMany).toHaveBeenCalledWith({
        where: { id: 'ep-123', userId: 'test-user-id' },
      });
    });

    it('should return 404 when episode not found', async () => {
      mockPrisma.episode.deleteMany.mockResolvedValue({ count: 0 });

      const response = await request(app).delete('/api/episodes/non-existent').expect(404);

      expect(response.body.error.message).toBe('Episode not found');
    });

    it('should block demo users from deleting episodes', async () => {
      mockBlockDemoUser.mockImplementation((req: AuthRequest, res: Response) => {
        res.status(403).json({ error: { message: 'Demo users cannot perform this action' } });
      });

      const response = await request(app).delete('/api/episodes/ep-123').expect(403);

      expect(response.body.error.message).toBe('Demo users cannot perform this action');
      expect(mockPrisma.episode.deleteMany).not.toHaveBeenCalled();
    });

    it('should verify userId to prevent unauthorized deletion', async () => {
      mockPrisma.episode.deleteMany.mockResolvedValue({ count: 0 });

      await request(app).delete('/api/episodes/ep-123').expect(404);

      expect(mockPrisma.episode.deleteMany).toHaveBeenCalledWith({
        where: {
          id: 'ep-123',
          userId: 'test-user-id', // Ensures only owner can delete
        },
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors in GET /', async () => {
      mockPrisma.episode.findMany.mockRejectedValue(new Error('DB connection failed'));

      const response = await request(app).get('/api/episodes').expect(500);

      expect(response.body.error).toBeDefined();
    });

    it('should handle database errors in POST', async () => {
      mockPrisma.episode.create.mockRejectedValue(new Error('DB error'));

      const response = await request(app)
        .post('/api/episodes')
        .send({
          title: 'Test',
          sourceText: 'Source',
          targetLanguage: 'ja',
          nativeLanguage: 'en',
        })
        .expect(500);

      expect(response.body.error).toBeDefined();
    });

    it('should handle database errors in PATCH', async () => {
      mockPrisma.episode.updateMany.mockRejectedValue(new Error('DB error'));

      const response = await request(app)
        .patch('/api/episodes/ep-123')
        .send({ title: 'Updated' })
        .expect(500);

      expect(response.body.error).toBeDefined();
    });

    it('should handle database errors in DELETE', async () => {
      mockPrisma.episode.deleteMany.mockRejectedValue(new Error('DB error'));

      const response = await request(app).delete('/api/episodes/ep-123').expect(500);

      expect(response.body.error).toBeDefined();
    });
  });
});
