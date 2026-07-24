/* eslint-disable import/no-named-as-default-member */
import express, { NextFunction, Response } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthRequest } from '../../../middleware/auth.js';
import { errorHandler } from '../../../middleware/errorHandler.js';
import audioRouter from '../../../routes/audio.js';

const mocks = vi.hoisted(() => ({
  fetchLearningOsProxy: vi.fn(),
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
const EPISODE_ID = '018f47ea-4b37-7f21-8d5a-90e157176b8a';
const DIALOGUE_ID = '019c8e80-f73f-78e8-96e8-c5b462053ee0';
const JOB_ID = '019c8e7f-5c48-7d32-ae6b-a1f268287c9b';
const AUDIO_URL = `/api/convolab/episodes/${EPISODE_ID}/audio/1.0`;
const DEFAULT_AUDIO_URL = `/api/convolab/episodes/${EPISODE_ID}/audio/default`;

const upstreamJson = (body: unknown, status = 200): globalThis.Response =>
  new globalThis.Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const generateBody = () => ({
  episodeId: EPISODE_ID,
  dialogueId: DIALOGUE_ID,
  speed: 'medium',
  pauseMode: true,
});

const jobBody = (state = 'active', progress = 35, result: unknown = null) => ({
  id: JOB_ID,
  state,
  progress,
  result,
});

const singleResult = () => ({
  audioUrl: DEFAULT_AUDIO_URL,
  duration: 12_345,
  sentenceTimings: {
    '019c8e90-673f-73a8-86e8-c5b462053ee0': { startTime: 0, endTime: 1234 },
  },
});

const allSpeedsResult = () => [
  {
    speed: 'slow',
    audioUrl: `/api/convolab/episodes/${EPISODE_ID}/audio/0.7`,
    duration: 15_000,
  },
  {
    speed: 'medium',
    audioUrl: `/api/convolab/episodes/${EPISODE_ID}/audio/0.85`,
    duration: 13_000,
  },
  { speed: 'normal', audioUrl: AUDIO_URL, duration: 11_000 },
];

describe('Audio routes', () => {
  let app: express.Application;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveLearningOsProxyContext.mockResolvedValue({
      config: { apiUrl: 'http://learning-os.test', apiToken: 'proxy-token' },
      user: { id: 'actor-user-id', email: 'learner@example.com', role: 'user' },
    });
    app = express();
    app.use(express.json());
    app.use('/api/audio', audioRouter);
    app.use(errorHandler);
  });

  it('forwards only allowlisted single-generation fields to Learning OS', async () => {
    mocks.fetchLearningOsProxy.mockResolvedValue(
      upstreamJson({ jobId: JOB_ID, message: 'Audio generation started' })
    );

    const response = await request(app)
      .post('/api/audio/generate')
      .send({ ...generateBody(), userId: 'attacker', mode: 'all-speeds' })
      .expect(200);

    expect(response.body).toEqual({ jobId: JOB_ID, message: 'Audio generation started' });
    expect(mocks.resolveLearningOsProxyContext).toHaveBeenCalledWith(
      'actor-user-id',
      'Learning OS Audio API'
    );
    expect(mocks.fetchLearningOsProxy).toHaveBeenCalledWith({
      upstreamUrl: new URL('http://learning-os.test/api/convolab/audio/generate'),
      apiToken: 'proxy-token',
      user: { id: 'actor-user-id', email: 'learner@example.com', role: 'user' },
      method: 'POST',
      body: generateBody(),
      timeoutMs: 10_000,
      timeoutMessage: 'Learning OS Audio API request timed out.',
      networkErrorMessage: 'Learning OS Audio API is unavailable.',
    });
  });

  it('forwards only episode and dialogue IDs for all-speed generation', async () => {
    mocks.fetchLearningOsProxy.mockResolvedValue(
      upstreamJson({
        jobId: JOB_ID,
        message: 'Audio generation already in progress',
        existing: true,
      })
    );

    const response = await request(app)
      .post('/api/audio/generate-all-speeds')
      .send(generateBody())
      .expect(200);

    expect(response.body.existing).toBe(true);
    expect(mocks.fetchLearningOsProxy).toHaveBeenCalledWith(
      expect.objectContaining({
        upstreamUrl: new URL('http://learning-os.test/api/convolab/audio/generate-all-speeds'),
        method: 'POST',
        body: { episodeId: EPISODE_ID, dialogueId: DIALOGUE_ID },
      })
    );
  });

  it.each([
    ['active', 35, null],
    ['completed', 100, singleResult()],
    ['completed', 100, allSpeedsResult()],
  ])('validates and returns a %s Learning OS job response', async (state, progress, result) => {
    mocks.fetchLearningOsProxy.mockResolvedValue(upstreamJson(jobBody(state, progress, result)));

    const response = await request(app).get(`/api/audio/job/${JOB_ID}`).expect(200);

    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(response.body).toEqual(jobBody(state, progress, result));
    expect(mocks.fetchLearningOsProxy).toHaveBeenCalledWith(
      expect.objectContaining({
        upstreamUrl: new URL(`http://learning-os.test/api/convolab/audio/job/${JOB_ID}`),
        method: 'GET',
      })
    );
  });

  it.each([400, 404, 409, 422, 429])(
    'forwards safe Learning OS client errors with status %s',
    async (upstreamStatus) => {
      mocks.fetchLearningOsProxy.mockResolvedValue(
        upstreamJson({ message: 'Safe audio request error' }, upstreamStatus)
      );

      const pending = request(app).post('/api/audio/generate').send(generateBody());
      const response = await pending.expect(upstreamStatus);

      expect(response.body.error.message).toBe('Safe audio request error');
      if (upstreamStatus === 429) {
        expect(response.headers['retry-after']).toBeUndefined();
      }
    }
  );

  it.each([401, 403, 500, 503])(
    'maps upstream auth and server status %s to a sanitized gateway error',
    async (upstreamStatus) => {
      mocks.fetchLearningOsProxy.mockResolvedValue(
        upstreamJson({ message: 'sensitive upstream details' }, upstreamStatus)
      );

      const response = await request(app).get(`/api/audio/job/${JOB_ID}`).expect(502);

      expect(response.body.error.message).toBe('Learning OS Audio API request failed.');
      expect(JSON.stringify(response.body)).not.toContain('sensitive upstream details');
    }
  );

  it.each([
    {},
    { message: 'missing job' },
    { message: 'wrong job type', jobId: 123 },
    { message: 'not a UUID', jobId: 'legacy-job' },
    { jobId: JOB_ID, message: 'started', existing: false },
  ])('rejects a malformed generate success response %#', async (body) => {
    mocks.fetchLearningOsProxy.mockResolvedValue(upstreamJson(body));

    const response = await request(app)
      .post('/api/audio/generate')
      .send(generateBody())
      .expect(502);

    expect(response.body.error.message).toBe(
      'Learning OS Audio API returned an invalid generate response.'
    );
  });

  it.each([
    { ...jobBody(), id: EPISODE_ID },
    { ...jobBody(), state: 'delayed' },
    { ...jobBody(), progress: 101 },
    { ...jobBody(), progress: 1.5 },
    jobBody('completed', 100, null),
    jobBody('completed', 100, { ...singleResult(), audioUrl: 'https://attacker.example/a.mp3' }),
    jobBody('completed', 100, { ...singleResult(), sentenceTimings: [] }),
    jobBody('completed', 100, allSpeedsResult().slice(0, 2)),
    jobBody('completed', 100, [
      { ...allSpeedsResult()[0], speed: 0.7 },
      ...allSpeedsResult().slice(1),
    ]),
    jobBody('completed', 100, [allSpeedsResult()[0], ...allSpeedsResult().slice(0, 2)]),
    jobBody('completed', 100, [
      { ...allSpeedsResult()[0], audioUrl: AUDIO_URL },
      ...allSpeedsResult().slice(1),
    ]),
  ])('rejects a malformed job success response %#', async (body) => {
    mocks.fetchLearningOsProxy.mockResolvedValue(upstreamJson(body));

    const response = await request(app).get(`/api/audio/job/${JOB_ID}`).expect(502);

    expect(response.body.error.message).toBe(
      'Learning OS Audio API returned an invalid job response.'
    );
  });

  it('rejects invalid JSON from a successful upstream response', async () => {
    mocks.fetchLearningOsProxy.mockResolvedValue(
      new globalThis.Response('not-json', {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      })
    );

    const response = await request(app).get(`/api/audio/job/${JOB_ID}`).expect(502);

    expect(response.body.error.message).toBe(
      'Learning OS Audio API returned an invalid JSON response.'
    );
  });

  it('preserves a bounded numeric Retry-After from Learning OS rate limiting', async () => {
    mocks.fetchLearningOsProxy.mockResolvedValue(
      new globalThis.Response(JSON.stringify({ message: 'Slow down' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json', 'Retry-After': '17' },
      })
    );

    const response = await request(app)
      .post('/api/audio/generate')
      .send(generateBody())
      .expect(429);

    expect(response.headers['retry-after']).toBe('17');
    expect(response.body.error.cooldown).toEqual({ remainingSeconds: 17 });
  });
});
