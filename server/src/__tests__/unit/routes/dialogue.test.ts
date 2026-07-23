/* eslint-disable import/no-named-as-default-member */
import express, { NextFunction, Response } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthRequest } from '../../../middleware/auth.js';
import { errorHandler } from '../../../middleware/errorHandler.js';
import dialogueRouter from '../../../routes/dialogue.js';

const mocks = vi.hoisted(() => ({
  blockDemoUser: vi.fn((_req: AuthRequest, _res: Response, next: NextFunction) => next()),
  fetchLearningOsProxy: vi.fn(),
  requireEmailVerified: vi.fn((_req: AuthRequest, _res: Response, next: NextFunction) => next()),
  resolveLearningOsProxyContext: vi.fn(),
}));

vi.mock('../../../services/learningOsProxy.js', () => ({
  fetchLearningOsProxy: mocks.fetchLearningOsProxy,
  resolveLearningOsProxyContext: mocks.resolveLearningOsProxyContext,
}));
vi.mock('../../../middleware/auth.js', () => ({
  requireAuth: vi.fn((req: AuthRequest, _res: Response, next: NextFunction) => {
    req.userId = 'actor-user-id';
    req.role = 'user';
    next();
  }),
  AuthRequest: class {},
}));
vi.mock('../../../middleware/demoAuth.js', () => ({ blockDemoUser: mocks.blockDemoUser }));
vi.mock('../../../middleware/emailVerification.js', () => ({
  requireEmailVerified: mocks.requireEmailVerified,
}));

const EPISODE_ID = '018f47ea-4b37-7f21-8d5a-90e157176b8a';
const JOB_ID = '019c8e7f-5c48-7d32-ae6b-a1f268287c9b';
const DIALOGUE_ID = '019c8e80-f73f-78e8-96e8-c5b462053ee0';

const speakers = [
  {
    name: 'Aiko [F]',
    voiceId: 'voice-aiko',
    proficiency: 'N3',
    tone: 'casual',
    color: '#d97706',
  },
  {
    name: 'Ken [M]',
    voiceId: 'voice-ken',
    proficiency: 'N2',
    tone: 'polite',
    color: '#2563eb',
  },
];

const upstreamJson = (body: unknown, status = 200): globalThis.Response =>
  new globalThis.Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const generateBody = () => ({
  episodeId: EPISODE_ID,
  speakers,
  variationCount: 4,
  dialogueLength: 8,
  jlptLevel: 'N3',
  vocabSeedOverride: 'travel',
  grammarSeedOverride: '〜ながら',
});

const jobBody = (state = 'active', progress = 35) => ({
  id: JOB_ID,
  state,
  progress,
  result: null,
});

describe('Dialogue routes', () => {
  let app: express.Application;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveLearningOsProxyContext.mockResolvedValue({
      config: { apiUrl: 'http://learning-os.test', apiToken: 'proxy-token' },
      user: { id: 'actor-user-id', email: 'learner@example.com', role: 'user' },
    });
    app = express();
    app.use(express.json());
    app.use('/api/dialogue', dialogueRouter);
    app.use(errorHandler);
  });

  it('proxies generation with only supported fields', async () => {
    mocks.fetchLearningOsProxy.mockResolvedValue(
      upstreamJson({ jobId: JOB_ID, message: 'Dialogue generation started' })
    );
    const body = { ...generateBody(), ignored: 'do not forward' };

    const response = await request(app).post('/api/dialogue/generate').send(body).expect(200);

    expect(response.body).toEqual({ jobId: JOB_ID, message: 'Dialogue generation started' });
    expect(mocks.resolveLearningOsProxyContext).toHaveBeenCalledWith(
      'actor-user-id',
      'Learning OS Dialogue API'
    );
    expect(mocks.fetchLearningOsProxy).toHaveBeenCalledWith({
      upstreamUrl: new URL('http://learning-os.test/api/convolab/dialogue/generate'),
      apiToken: 'proxy-token',
      user: { id: 'actor-user-id', email: 'learner@example.com', role: 'user' },
      method: 'POST',
      body: generateBody(),
      timeoutMs: 10_000,
      timeoutMessage: 'Learning OS Dialogue API request timed out.',
      networkErrorMessage: 'Learning OS Dialogue API is unavailable.',
    });
    expect(mocks.requireEmailVerified).toHaveBeenCalledOnce();
    expect(mocks.blockDemoUser).toHaveBeenCalledOnce();
  });

  it('proxies a pending job poll', async () => {
    mocks.fetchLearningOsProxy.mockResolvedValue(upstreamJson(jobBody()));

    const response = await request(app).get(`/api/dialogue/job/${JOB_ID}`).expect(200);

    expect(response.body).toEqual(jobBody());
    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(mocks.fetchLearningOsProxy).toHaveBeenCalledWith(
      expect.objectContaining({
        upstreamUrl: new URL(`http://learning-os.test/api/convolab/dialogue/job/${JOB_ID}`),
        method: 'GET',
        body: undefined,
      })
    );
  });

  it('accepts a completed job with the compatibility result shape', async () => {
    const completed = {
      id: JOB_ID,
      state: 'completed',
      progress: 100,
      result: {
        dialogue: {
          id: DIALOGUE_ID,
          episodeId: EPISODE_ID,
          createdAt: '2026-07-21T12:00:00.000Z',
          updatedAt: '2026-07-21T12:00:00.000Z',
        },
        speakers: [],
        sentences: [],
      },
    };
    mocks.fetchLearningOsProxy.mockResolvedValue(upstreamJson(completed));

    const response = await request(app).get(`/api/dialogue/job/${JOB_ID}`).expect(200);

    expect(response.body).toEqual(completed);
  });

  it('encodes job identifiers in the upstream path', async () => {
    mocks.fetchLearningOsProxy.mockResolvedValue(upstreamJson(jobBody()));

    await request(app).get(`/api/dialogue/job/${JOB_ID.toUpperCase()}`).expect(200);

    expect(mocks.fetchLearningOsProxy).toHaveBeenCalledWith(
      expect.objectContaining({
        upstreamUrl: new URL(
          `http://learning-os.test/api/convolab/dialogue/job/${JOB_ID.toUpperCase()}`
        ),
      })
    );
  });

  it.each([400, 404, 409, 422, 429])(
    'preserves a safe compatibility message for upstream HTTP %s',
    async (upstreamStatus) => {
      mocks.fetchLearningOsProxy.mockResolvedValue(
        upstreamJson({ message: 'Safe compatibility message' }, upstreamStatus)
      );

      const response = await request(app)
        .post('/api/dialogue/generate')
        .send(generateBody())
        .expect(upstreamStatus);

      expect(response.body.error.message).toBe('Safe compatibility message');
    }
  );

  it.each([401, 403, 500, 503])(
    'hides upstream details and maps HTTP %s to 502',
    async (upstreamStatus) => {
      mocks.fetchLearningOsProxy.mockResolvedValue(
        upstreamJson({ message: 'sensitive upstream details' }, upstreamStatus)
      );

      const response = await request(app).get(`/api/dialogue/job/${JOB_ID}`).expect(502);

      expect(response.body.error.message).toBe('Learning OS Dialogue API request failed.');
      expect(JSON.stringify(response.body)).not.toContain('sensitive upstream details');
    }
  );

  it.each([
    {},
    { message: 'missing job' },
    { message: 'wrong job type', jobId: 123 },
    { message: 'not a UUID', jobId: 'legacy-job' },
  ])('rejects a malformed generate success response %#', async (body) => {
    mocks.fetchLearningOsProxy.mockResolvedValue(upstreamJson(body));

    const response = await request(app)
      .post('/api/dialogue/generate')
      .send(generateBody())
      .expect(502);

    expect(response.body.error.message).toBe(
      'Learning OS Dialogue API returned an invalid generate response.'
    );
  });

  it.each([
    { ...jobBody(), id: EPISODE_ID },
    { ...jobBody(), state: 'delayed' },
    { ...jobBody(), progress: 101 },
    { ...jobBody(), progress: 1.5 },
    { ...jobBody('completed', 100), result: null },
    { ...jobBody(), result: {} },
  ])('rejects a malformed job success response %#', async (body) => {
    mocks.fetchLearningOsProxy.mockResolvedValue(upstreamJson(body));

    const response = await request(app).get(`/api/dialogue/job/${JOB_ID}`).expect(502);

    expect(response.body.error.message).toBe(
      'Learning OS Dialogue API returned an invalid job response.'
    );
  });

  it('rejects invalid JSON from a successful upstream response', async () => {
    mocks.fetchLearningOsProxy.mockResolvedValue(
      new globalThis.Response('not-json', {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      })
    );

    const response = await request(app).get(`/api/dialogue/job/${JOB_ID}`).expect(502);

    expect(response.body.error.message).toBe(
      'Learning OS Dialogue API returned an invalid JSON response.'
    );
  });
});
