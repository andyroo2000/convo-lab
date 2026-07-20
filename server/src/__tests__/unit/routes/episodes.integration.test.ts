/* eslint-disable import/no-named-as-default-member */
import express, { Response, NextFunction } from 'express';
import request from 'supertest';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { AuthRequest } from '../../../middleware/auth.js';
import { AppError, errorHandler } from '../../../middleware/errorHandler.js';
import episodesRouter from '../../../routes/episodes.js';

const mocks = vi.hoisted(() => ({
  fetchLearningOsProxy: vi.fn(),
  getEffectiveUserId: vi.fn(),
  resolveLearningOsProxyContext: vi.fn(),
}));

const mockPrisma = vi.hoisted(() => ({
  episode: {
    create: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
  },
}));

const mockBlockDemoUser = vi.hoisted(() =>
  vi.fn((_req: AuthRequest, _res: Response, next: NextFunction) => next())
);

vi.mock('../../../db/client.js', () => ({
  prisma: mockPrisma,
}));

vi.mock('../../../services/learningOsProxy.js', () => ({
  fetchLearningOsProxy: mocks.fetchLearningOsProxy,
  resolveLearningOsProxyContext: mocks.resolveLearningOsProxyContext,
}));

vi.mock('../../../middleware/demoAuth.js', () => ({
  blockDemoUser: mockBlockDemoUser,
}));

vi.mock('../../../middleware/impersonation.js', () => ({
  getEffectiveUserId: mocks.getEffectiveUserId,
}));

vi.mock('../../../middleware/auth.js', () => ({
  requireAuth: vi.fn((req: AuthRequest, _res: Response, next: NextFunction) => {
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

const upstreamJson = (body: unknown, status = 200): globalThis.Response =>
  new globalThis.Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

describe('Episodes Routes Integration', () => {
  let app: express.Application;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getEffectiveUserId.mockResolvedValue('effective-user-id');
    mocks.resolveLearningOsProxyContext.mockResolvedValue({
      config: {
        apiUrl: 'http://learning-os.test',
        apiToken: 'proxy-token',
      },
      user: {
        id: 'effective-user-id',
        email: 'learner@example.com',
        role: 'user',
      },
    });
    mockBlockDemoUser.mockImplementation((_req: AuthRequest, _res: Response, next: NextFunction) =>
      next()
    );

    app = express();
    app.use(express.json());
    app.use('/api/episodes', episodesRouter);
    app.use(errorHandler);
  });

  describe('Learning OS Episode reads', () => {
    it('proxies list reads for the effective user with only supported query parameters', async () => {
      const episodes = [{ id: 'episode-1', title: 'Episode 1' }];
      mocks.fetchLearningOsProxy.mockResolvedValue(upstreamJson(episodes));

      const response = await request(app)
        .get('/api/episodes?library=true&limit=20&offset=40&ignored=value')
        .expect(200);

      expect(response.body).toEqual(episodes);
      expect(mocks.getEffectiveUserId).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'test-user-id' })
      );
      expect(mocks.resolveLearningOsProxyContext).toHaveBeenCalledWith(
        'effective-user-id',
        'Learning OS Episode API'
      );
      expect(mocks.fetchLearningOsProxy).toHaveBeenCalledWith(
        expect.objectContaining({
          upstreamUrl: new URL(
            'http://learning-os.test/api/convolab/episodes?library=true&limit=20&offset=40'
          ),
          apiToken: 'proxy-token',
          method: 'GET',
          timeoutMs: 10_000,
        })
      );
      expect(mockPrisma.episode.create).not.toHaveBeenCalled();
    });

    it('proxies detail reads, encodes the path, and preserves private caching', async () => {
      const episode = { id: 'episode/id', title: 'Episode detail' };
      mocks.fetchLearningOsProxy.mockResolvedValue(upstreamJson(episode));

      const response = await request(app).get('/api/episodes/episode%2Fid').expect(200);

      expect(response.body).toEqual(episode);
      expect(response.headers['cache-control']).toBe('private, max-age=60');
      expect(mocks.fetchLearningOsProxy).toHaveBeenCalledWith(
        expect.objectContaining({
          upstreamUrl: new URL('http://learning-os.test/api/convolab/episodes/episode%2Fid'),
        })
      );
    });

    it.each([
      [401, 502],
      [500, 502],
      [404, 404],
      [422, 422],
    ])('maps upstream HTTP %s to client HTTP %s', async (upstreamStatus, clientStatus) => {
      mocks.fetchLearningOsProxy.mockResolvedValue(
        upstreamJson({ message: 'upstream details stay private' }, upstreamStatus)
      );

      const response = await request(app).get('/api/episodes/missing').expect(clientStatus);

      expect(response.body.error.message).toBe('Learning OS Episode API request failed.');
      expect(JSON.stringify(response.body)).not.toContain('upstream details');
    });

    it('rejects malformed upstream list and detail response shapes', async () => {
      mocks.fetchLearningOsProxy
        .mockResolvedValueOnce(upstreamJson({ data: [] }))
        .mockResolvedValueOnce(upstreamJson([]));

      await request(app)
        .get('/api/episodes')
        .expect(502)
        .expect(({ body }) => {
          expect(body.error.message).toBe(
            'Learning OS Episode API returned an invalid list response.'
          );
        });
      await request(app)
        .get('/api/episodes/episode-id')
        .expect(502)
        .expect(({ body }) => {
          expect(body.error.message).toBe(
            'Learning OS Episode API returned an invalid detail response.'
          );
        });
    });

    it('returns a controlled gateway error for invalid upstream JSON', async () => {
      mocks.fetchLearningOsProxy.mockResolvedValue(
        new globalThis.Response('not-json', {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const response = await request(app).get('/api/episodes').expect(502);

      expect(response.body.error.message).toBe(
        'Learning OS Episode API returned an invalid JSON response.'
      );
    });

    it('passes controlled proxy transport failures to the API error handler', async () => {
      mocks.fetchLearningOsProxy.mockRejectedValue(
        new AppError('Learning OS Episode API is unavailable.', 502)
      );

      const response = await request(app).get('/api/episodes').expect(502);

      expect(response.body.error.message).toBe('Learning OS Episode API is unavailable.');
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
      mockBlockDemoUser.mockImplementation((_req: AuthRequest, res: Response) => {
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
      mockBlockDemoUser.mockImplementation((_req: AuthRequest, res: Response) => {
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
