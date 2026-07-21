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

const upstreamJson = (body: unknown, status = 200): globalThis.Response =>
  new globalThis.Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const EPISODE_ID = '11111111-1111-4111-8111-111111111111';

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

  describe('Learning OS Episode writes', () => {
    const createBody = {
      title: 'New Episode',
      sourceText: 'Test source text',
      targetLanguage: 'ja',
      nativeLanguage: 'en',
      audioSpeed: 'slow',
      jlptLevel: 'N3',
      autoGenerateAudio: false,
    };

    it('proxies create for the effective user and filters unsupported fields', async () => {
      const episode = { id: EPISODE_ID, ...createBody, status: 'draft' };
      mocks.fetchLearningOsProxy.mockResolvedValue(upstreamJson(episode));

      const response = await request(app)
        .post('/api/episodes')
        .send({ ...createBody, userId: 'other-user', role: 'admin' })
        .expect(200);

      expect(response.body).toEqual(episode);
      expect(mocks.getEffectiveUserId).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'test-user-id' })
      );
      expect(mocks.fetchLearningOsProxy).toHaveBeenCalledWith(
        expect.objectContaining({
          upstreamUrl: new URL('http://learning-os.test/api/convolab/episodes'),
          method: 'POST',
          body: createBody,
          timeoutMs: 10_000,
        })
      );
      expect(mockPrisma.episode.create).not.toHaveBeenCalled();
      expect(mockBlockDemoUser).toHaveBeenCalledOnce();
    });

    it('proxies only legacy mutable fields on update and preserves the acknowledgment', async () => {
      mocks.fetchLearningOsProxy.mockResolvedValue(upstreamJson({ message: 'Episode updated' }));

      const response = await request(app)
        .patch(`/api/episodes/${EPISODE_ID}`)
        .send({
          title: 'Updated Episode',
          status: 'ready',
          sourceText: 'Create-only field',
          userId: 'other-user',
        })
        .expect(200);

      expect(response.body).toEqual({ message: 'Episode updated successfully' });
      expect(mocks.fetchLearningOsProxy).toHaveBeenCalledWith(
        expect.objectContaining({
          upstreamUrl: new URL(`http://learning-os.test/api/convolab/episodes/${EPISODE_ID}`),
          method: 'PATCH',
          body: { title: 'Updated Episode', status: 'ready' },
        })
      );
      expect(mockPrisma.episode.updateMany).not.toHaveBeenCalled();
    });

    it('proxies delete and preserves the legacy acknowledgment', async () => {
      mocks.fetchLearningOsProxy.mockResolvedValue(upstreamJson({ message: 'Episode deleted' }));

      const response = await request(app).delete(`/api/episodes/${EPISODE_ID}`).expect(200);

      expect(response.body).toEqual({ message: 'Episode deleted successfully' });
      expect(mocks.fetchLearningOsProxy).toHaveBeenCalledWith(
        expect.objectContaining({
          upstreamUrl: new URL(`http://learning-os.test/api/convolab/episodes/${EPISODE_ID}`),
          method: 'DELETE',
          body: undefined,
        })
      );
      expect(mockPrisma.episode.deleteMany).not.toHaveBeenCalled();
      expect(mockBlockDemoUser).toHaveBeenCalledOnce();
    });

    it.each([
      ['create', () => request(app).post('/api/episodes').send({ title: 'Episode' })],
      [
        'update',
        () => request(app).patch(`/api/episodes/${EPISODE_ID}`).send({ title: 'Episode' }),
      ],
      ['delete', () => request(app).delete(`/api/episodes/${EPISODE_ID}`)],
    ])('preserves a safe %s client error from Learning OS', async (_operation, makeRequest) => {
      mocks.fetchLearningOsProxy.mockResolvedValue(
        upstreamJson({ message: 'Safe compatibility message' }, 422)
      );

      const response = await makeRequest().expect(422);

      expect(response.body.error.message).toBe('Safe compatibility message');
    });

    it.each([401, 403, 500])('redacts sensitive upstream HTTP %s write errors', async (status) => {
      mocks.fetchLearningOsProxy.mockResolvedValue(
        upstreamJson({ message: 'private upstream details' }, status)
      );

      const response = await request(app)
        .patch(`/api/episodes/${EPISODE_ID}`)
        .send({ title: 'Episode' })
        .expect(502);

      expect(response.body.error.message).toBe('Learning OS Episode API request failed.');
      expect(JSON.stringify(response.body)).not.toContain('private upstream details');
    });

    it('rejects malformed create and acknowledgment responses', async () => {
      mocks.fetchLearningOsProxy
        .mockResolvedValueOnce(
          upstreamJson({ id: 'not-a-uuid', title: 'Episode', status: 'draft' })
        )
        .mockResolvedValueOnce(
          upstreamJson({ id: EPISODE_ID, title: 'Episode', status: 'unknown' })
        )
        .mockResolvedValueOnce(upstreamJson([]))
        .mockResolvedValueOnce(upstreamJson({ message: '' }));

      await request(app).post('/api/episodes').send(createBody).expect(502);
      await request(app).post('/api/episodes').send(createBody).expect(502);
      await request(app)
        .patch(`/api/episodes/${EPISODE_ID}`)
        .send({ title: 'Episode' })
        .expect(502);
      await request(app).delete(`/api/episodes/${EPISODE_ID}`).expect(502);
    });

    it.each(['create', 'delete'])('keeps demo-user blocking on %s', async (operation) => {
      mockBlockDemoUser.mockImplementation((_req: AuthRequest, res: Response) => {
        res.status(403).json({ error: { message: 'Demo users cannot perform this action' } });
      });

      const response =
        operation === 'create'
          ? await request(app).post('/api/episodes').send(createBody).expect(403)
          : await request(app).delete(`/api/episodes/${EPISODE_ID}`).expect(403);

      expect(response.body.error.message).toBe('Demo users cannot perform this action');
      expect(mocks.fetchLearningOsProxy).not.toHaveBeenCalled();
    });
  });
});
