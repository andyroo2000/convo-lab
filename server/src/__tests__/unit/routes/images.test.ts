/* eslint-disable import/no-named-as-default-member */
import express, { NextFunction, Response } from 'express';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthRequest } from '../../../middleware/auth.js';
import { errorHandler } from '../../../middleware/errorHandler.js';
import imageRouter from '../../../routes/images.js';

const mocks = vi.hoisted(() => ({
  fetchLearningOsProxy: vi.fn(),
  resolveLearningOsProxyContext: vi.fn(),
  triggerWorkerJob: vi.fn(),
}));

const mockImageQueue = vi.hoisted(() => ({
  add: vi.fn(),
  getJob: vi.fn(),
}));

vi.mock('../../../jobs/imageQueue.js', () => ({ imageQueue: mockImageQueue }));
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
vi.mock('../../../services/workerTrigger.js', () => ({
  triggerWorkerJob: mocks.triggerWorkerJob,
}));
vi.mock('../../../i18n/index.js', () => ({
  default: {
    t: (key: string, params?: Record<string, unknown>) => {
      if (key === 'server:content.missingFields') return 'Missing required fields';
      if (key === 'server:content.jobNotFound') return 'Job not found';
      if (key === 'server:content.generationStarted') {
        return `${params?.type} generation started`;
      }
      return key;
    },
  },
}));

const originalImageGenerationProxyEnabled = process.env.LEARNING_OS_IMAGE_GENERATION_PROXY_ENABLED;
const EPISODE_ID = '018f47ea-4b37-7f21-8d5a-90e157176b8a';
const DIALOGUE_ID = '019c8e80-f73f-78e8-96e8-c5b462053ee0';
const JOB_ID = '019c8e7f-5c48-7d32-ae6b-a1f268287c9b';
const IMAGE_ID = '019c8e8d-a71c-7604-88b0-346fb8897226';
const START_SENTENCE_ID = '019c8e91-9f22-7d45-9710-422255d83f26';
const END_SENTENCE_ID = '019c8e92-b65e-7991-bbf6-e825049088c5';

const upstreamJson = (
  body: unknown,
  status = 200,
  headers: Record<string, string> = {}
): globalThis.Response =>
  new globalThis.Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });

const generateBody = () => ({
  episodeId: EPISODE_ID,
  dialogueId: DIALOGUE_ID,
  imageCount: 4,
});

const jobBody = (state = 'active', progress = 35) => ({
  id: JOB_ID,
  state,
  progress,
  result: null,
});

const imageResult = () => ({
  id: IMAGE_ID,
  episodeId: EPISODE_ID,
  url: 'https://placehold.co/800x600/EEF3FB/5E6AD8?text=Scene+1',
  prompt: 'A detailed visual scene for the dialogue.',
  order: 0,
  sentenceStartId: START_SENTENCE_ID,
  sentenceEndId: END_SENTENCE_ID,
  createdAt: '2026-07-21T12:00:00.000Z',
});

describe('Image routes', () => {
  let app: express.Application;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.LEARNING_OS_IMAGE_GENERATION_PROXY_ENABLED = 'false';
    mocks.resolveLearningOsProxyContext.mockResolvedValue({
      config: { apiUrl: 'http://learning-os.test', apiToken: 'proxy-token' },
      user: { id: 'actor-user-id', email: 'learner@example.com', role: 'user' },
    });
    mocks.triggerWorkerJob.mockResolvedValue(undefined);

    app = express();
    app.use(express.json());
    app.use('/api/images', imageRouter);
    app.use(errorHandler);
  });

  afterAll(() => {
    if (originalImageGenerationProxyEnabled === undefined) {
      delete process.env.LEARNING_OS_IMAGE_GENERATION_PROXY_ENABLED;
    } else {
      process.env.LEARNING_OS_IMAGE_GENERATION_PROXY_ENABLED = originalImageGenerationProxyEnabled;
    }
  });

  it('keeps generation on BullMQ while Learning OS routing is disabled', async () => {
    mockImageQueue.add.mockResolvedValue({ id: 'legacy-job-123' });

    const response = await request(app)
      .post('/api/images/generate')
      .send(generateBody())
      .expect(200);

    expect(response.body).toEqual({
      jobId: 'legacy-job-123',
      message: 'Image generation started',
    });
    expect(mockImageQueue.add).toHaveBeenCalledWith('generate-images', {
      userId: 'actor-user-id',
      ...generateBody(),
    });
    expect(mocks.triggerWorkerJob).toHaveBeenCalledOnce();
    expect(mocks.fetchLearningOsProxy).not.toHaveBeenCalled();
  });

  it('uses the legacy default image count while routing is disabled', async () => {
    mockImageQueue.add.mockResolvedValue({ id: 'legacy-job-123' });

    await request(app)
      .post('/api/images/generate')
      .send({ episodeId: EPISODE_ID, dialogueId: DIALOGUE_ID })
      .expect(200);

    expect(mockImageQueue.add).toHaveBeenCalledWith('generate-images', {
      userId: 'actor-user-id',
      episodeId: EPISODE_ID,
      dialogueId: DIALOGUE_ID,
      imageCount: 3,
    });
  });

  it('keeps polling on BullMQ while Learning OS routing is disabled', async () => {
    mockImageQueue.getJob.mockResolvedValue({
      id: 'legacy-job-123',
      getState: vi.fn().mockResolvedValue('active'),
      progress: 42,
      returnvalue: null,
    });

    const response = await request(app).get('/api/images/job/legacy-job-123').expect(200);

    expect(response.body).toEqual({
      id: 'legacy-job-123',
      state: 'active',
      progress: 42,
      result: null,
    });
    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(mockImageQueue.getJob).toHaveBeenCalledWith('legacy-job-123');
    expect(mocks.fetchLearningOsProxy).not.toHaveBeenCalled();
  });

  it('preserves legacy validation and missing-job errors while routing is disabled', async () => {
    const generateResponse = await request(app)
      .post('/api/images/generate')
      .send({ episodeId: EPISODE_ID })
      .expect(400);
    expect(generateResponse.body.error.message).toBe('Missing required fields');

    mockImageQueue.getJob.mockResolvedValue(null);
    const jobResponse = await request(app).get('/api/images/job/missing').expect(404);
    expect(jobResponse.body.error.message).toBe('Job not found');
  });

  it('proxies generation with only supported fields when routing is enabled', async () => {
    process.env.LEARNING_OS_IMAGE_GENERATION_PROXY_ENABLED = 'true';
    mocks.fetchLearningOsProxy.mockResolvedValue(
      upstreamJson({ jobId: JOB_ID, message: 'Image generation started' })
    );
    const body = { ...generateBody(), userId: 'spoofed', ignored: 'do not forward' };

    const response = await request(app).post('/api/images/generate').send(body).expect(200);

    expect(response.body).toEqual({ jobId: JOB_ID, message: 'Image generation started' });
    expect(mocks.resolveLearningOsProxyContext).toHaveBeenCalledWith(
      'actor-user-id',
      'Learning OS Image API'
    );
    expect(mocks.fetchLearningOsProxy).toHaveBeenCalledWith({
      upstreamUrl: new URL('http://learning-os.test/api/convolab/images/generate'),
      apiToken: 'proxy-token',
      user: { id: 'actor-user-id', email: 'learner@example.com', role: 'user' },
      method: 'POST',
      body: generateBody(),
      timeoutMs: 10_000,
      timeoutMessage: 'Learning OS Image API request timed out.',
      networkErrorMessage: 'Learning OS Image API is unavailable.',
    });
    expect(mockImageQueue.add).not.toHaveBeenCalled();
    expect(mocks.triggerWorkerJob).not.toHaveBeenCalled();
  });

  it('proxies a pending job poll without consulting BullMQ', async () => {
    process.env.LEARNING_OS_IMAGE_GENERATION_PROXY_ENABLED = 'true';
    mocks.fetchLearningOsProxy.mockResolvedValue(upstreamJson(jobBody()));

    const response = await request(app).get(`/api/images/job/${JOB_ID}`).expect(200);

    expect(response.body).toEqual(jobBody());
    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(mocks.fetchLearningOsProxy).toHaveBeenCalledWith(
      expect.objectContaining({
        upstreamUrl: new URL(`http://learning-os.test/api/convolab/images/job/${JOB_ID}`),
        method: 'GET',
        body: undefined,
      })
    );
    expect(mockImageQueue.getJob).not.toHaveBeenCalled();
  });

  it('accepts completed image results with nullable sentence bounds', async () => {
    process.env.LEARNING_OS_IMAGE_GENERATION_PROXY_ENABLED = 'true';
    const completed = {
      id: JOB_ID,
      state: 'completed',
      progress: 100,
      result: [imageResult(), { ...imageResult(), id: END_SENTENCE_ID, sentenceEndId: null }],
    };
    mocks.fetchLearningOsProxy.mockResolvedValue(upstreamJson(completed));

    const response = await request(app).get(`/api/images/job/${JOB_ID}`).expect(200);

    expect(response.body).toEqual(completed);
  });

  it('accepts an empty completed result for a dialogue without image sections', async () => {
    process.env.LEARNING_OS_IMAGE_GENERATION_PROXY_ENABLED = 'true';
    const completed = { ...jobBody('completed', 100), result: [] };
    mocks.fetchLearningOsProxy.mockResolvedValue(upstreamJson(completed));

    await request(app).get(`/api/images/job/${JOB_ID}`).expect(200, completed);
  });

  it.each([400, 404, 409, 422])(
    'preserves a safe compatibility message for upstream HTTP %s',
    async (upstreamStatus) => {
      process.env.LEARNING_OS_IMAGE_GENERATION_PROXY_ENABLED = 'true';
      mocks.fetchLearningOsProxy.mockResolvedValue(
        upstreamJson({ message: 'Safe compatibility message' }, upstreamStatus)
      );

      const response = await request(app)
        .post('/api/images/generate')
        .send(generateBody())
        .expect(upstreamStatus);

      expect(response.body.error.message).toBe('Safe compatibility message');
    }
  );

  it('preserves a bounded upstream retry window for rate limits', async () => {
    process.env.LEARNING_OS_IMAGE_GENERATION_PROXY_ENABLED = 'true';
    mocks.fetchLearningOsProxy.mockResolvedValue(
      upstreamJson({ message: 'Too many attempts.' }, 429, { 'Retry-After': '27' })
    );

    const response = await request(app)
      .post('/api/images/generate')
      .send(generateBody())
      .expect(429);

    expect(response.headers['retry-after']).toBe('27');
    expect(response.body.error).toMatchObject({
      message: 'Too many attempts.',
      cooldown: { remainingSeconds: 27 },
    });
  });

  it.each([401, 403, 500, 503])(
    'hides upstream details and maps HTTP %s to 502',
    async (upstreamStatus) => {
      process.env.LEARNING_OS_IMAGE_GENERATION_PROXY_ENABLED = 'true';
      mocks.fetchLearningOsProxy.mockResolvedValue(
        upstreamJson({ message: 'sensitive upstream details' }, upstreamStatus)
      );

      const response = await request(app).get(`/api/images/job/${JOB_ID}`).expect(502);

      expect(response.body.error.message).toBe('Learning OS Image API request failed.');
      expect(JSON.stringify(response.body)).not.toContain('sensitive upstream details');
    }
  );

  it.each([
    {},
    { message: 'missing job' },
    { message: 'wrong job type', jobId: 123 },
    { message: 'not a UUID', jobId: 'legacy-job' },
  ])('rejects a malformed generate success response %#', async (body) => {
    process.env.LEARNING_OS_IMAGE_GENERATION_PROXY_ENABLED = 'true';
    mocks.fetchLearningOsProxy.mockResolvedValue(upstreamJson(body));

    const response = await request(app)
      .post('/api/images/generate')
      .send(generateBody())
      .expect(502);

    expect(response.body.error.message).toBe(
      'Learning OS Image API returned an invalid generate response.'
    );
  });

  it.each([
    { ...jobBody(), id: EPISODE_ID },
    { ...jobBody(), state: 'delayed' },
    { ...jobBody(), progress: -1 },
    { ...jobBody(), progress: 1.5 },
    { ...jobBody(), result: [] },
    { ...jobBody('completed', 100), result: null },
    { ...jobBody('completed', 100), result: [{ ...imageResult(), id: 'bad-id' }] },
    { ...jobBody('completed', 100), result: [{ ...imageResult(), url: 'javascript:alert(1)' }] },
    { ...jobBody('completed', 100), result: [{ ...imageResult(), createdAt: 'next Tuesday' }] },
    { ...jobBody('completed', 100), result: [{ ...imageResult(), order: -1 }] },
    { ...jobBody('completed', 100), result: [{ ...imageResult(), sentenceStartId: 'bad-id' }] },
  ])('rejects a malformed job success response %#', async (body) => {
    process.env.LEARNING_OS_IMAGE_GENERATION_PROXY_ENABLED = 'true';
    mocks.fetchLearningOsProxy.mockResolvedValue(upstreamJson(body));

    const response = await request(app).get(`/api/images/job/${JOB_ID}`).expect(502);

    expect(response.body.error.message).toBe(
      'Learning OS Image API returned an invalid job response.'
    );
  });

  it('rejects invalid JSON from a successful upstream response', async () => {
    process.env.LEARNING_OS_IMAGE_GENERATION_PROXY_ENABLED = 'true';
    mocks.fetchLearningOsProxy.mockResolvedValue(
      new globalThis.Response('not-json', {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      })
    );

    const response = await request(app).get(`/api/images/job/${JOB_ID}`).expect(502);

    expect(response.body.error.message).toBe(
      'Learning OS Image API returned an invalid JSON response.'
    );
  });
});
