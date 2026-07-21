/* eslint-disable import/no-named-as-default-member */
import express, { NextFunction, Response } from 'express';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthRequest } from '../../../middleware/auth.js';
import { AppError, errorHandler } from '../../../middleware/errorHandler.js';
import coursesRouter from '../../../routes/courses.js';

const mocks = vi.hoisted(() => ({
  authRole: { value: 'user' as string | undefined },
  fetchLearningOsProxy: vi.fn(),
  getEffectiveUserId: vi.fn(),
  resolveLearningOsProxyContext: vi.fn(),
}));

const mockPrisma = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  episode: { create: vi.fn(), findMany: vi.fn() },
  course: {
    create: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  courseEpisode: { create: vi.fn() },
  $transaction: vi.fn(),
}));

const mockCourseQueue = vi.hoisted(() => ({ add: vi.fn(), getJobs: vi.fn() }));

vi.mock('../../../db/client.js', () => ({ prisma: mockPrisma }));
vi.mock('../../../jobs/courseQueue.js', () => ({ courseQueue: mockCourseQueue }));
vi.mock('../../../services/learningOsProxy.js', () => ({
  fetchLearningOsProxy: mocks.fetchLearningOsProxy,
  resolveLearningOsProxyContext: mocks.resolveLearningOsProxyContext,
}));
vi.mock('../../../middleware/impersonation.js', () => ({
  getEffectiveUserId: mocks.getEffectiveUserId,
}));
vi.mock('../../../middleware/auth.js', () => ({
  requireAuth: vi.fn((req: AuthRequest, _res: Response, next: NextFunction) => {
    req.userId = 'actor-user-id';
    req.role = mocks.authRole.value;
    next();
  }),
  AuthRequest: class {},
}));
vi.mock('../../../middleware/demoAuth.js', () => ({
  blockDemoUser: vi.fn((_req: AuthRequest, _res: Response, next: NextFunction) => next()),
}));
vi.mock('../../../middleware/emailVerification.js', () => ({
  requireEmailVerified: vi.fn((_req: AuthRequest, _res: Response, next: NextFunction) => next()),
}));
vi.mock('../../../middleware/rateLimit.js', () => ({
  rateLimitGeneration: vi.fn(
    () => (_req: AuthRequest, _res: Response, next: NextFunction) => next()
  ),
}));
vi.mock('../../../services/coreLlmClient.js', () => ({ generateCoreLlmText: vi.fn() }));
vi.mock('../../../services/usageTracker.js', () => ({ logGeneration: vi.fn() }));
vi.mock('../../../services/workerTrigger.js', () => ({ triggerWorkerJob: vi.fn() }));
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

const originalCourseGenerationProxyEnabled =
  process.env.LEARNING_OS_COURSE_GENERATION_PROXY_ENABLED;

describe('Courses Routes Integration', () => {
  let app: express.Application;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.LEARNING_OS_COURSE_GENERATION_PROXY_ENABLED = 'false';
    mocks.authRole.value = 'user';
    mocks.getEffectiveUserId.mockResolvedValue('effective-user-id');
    mocks.resolveLearningOsProxyContext.mockResolvedValue({
      config: { apiUrl: 'http://learning-os.test', apiToken: 'proxy-token' },
      user: { id: 'effective-user-id', email: 'learner@example.com', role: 'user' },
    });

    app = express();
    app.use(express.json());
    app.use('/api/courses', coursesRouter);
    app.use(errorHandler);
  });

  afterAll(() => {
    if (originalCourseGenerationProxyEnabled === undefined) {
      delete process.env.LEARNING_OS_COURSE_GENERATION_PROXY_ENABLED;
    } else {
      process.env.LEARNING_OS_COURSE_GENERATION_PROXY_ENABLED =
        originalCourseGenerationProxyEnabled;
    }
  });

  it('proxies list reads for the effective user with only supported query parameters', async () => {
    const courses = [{ id: 'course-1', title: 'Course 1' }];
    mocks.fetchLearningOsProxy.mockResolvedValue(upstreamJson(courses));

    const response = await request(app)
      .get('/api/courses?library=true&limit=20&offset=40&status=all&ignored=value')
      .expect(200);

    expect(response.body).toEqual(courses);
    expect(mocks.getEffectiveUserId).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'actor-user-id' })
    );
    expect(mocks.resolveLearningOsProxyContext).toHaveBeenCalledWith(
      'effective-user-id',
      'Learning OS Course API'
    );
    expect(mocks.fetchLearningOsProxy).toHaveBeenCalledWith(
      expect.objectContaining({
        upstreamUrl: new URL(
          'http://learning-os.test/api/convolab/courses?library=true&limit=20&offset=40'
        ),
        apiToken: 'proxy-token',
        method: 'GET',
        timeoutMs: 10_000,
      })
    );
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
  });

  it.each(['all', 'draft'])('forwards the %s status filter for admins', async (status) => {
    mocks.authRole.value = 'admin';
    mocks.fetchLearningOsProxy.mockResolvedValue(upstreamJson([]));

    await request(app).get(`/api/courses?status=${status}`).expect(200);

    expect(mocks.fetchLearningOsProxy).toHaveBeenCalledWith(
      expect.objectContaining({
        upstreamUrl: new URL(`http://learning-os.test/api/convolab/courses?status=${status}`),
      })
    );
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('looks up old JWT roles before forwarding an admin status filter', async () => {
    mocks.authRole.value = undefined;
    mockPrisma.user.findUnique.mockResolvedValue({ role: 'admin' });
    mocks.fetchLearningOsProxy.mockResolvedValue(upstreamJson([]));

    await request(app).get('/api/courses?status=all').expect(200);

    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'actor-user-id' },
      select: { role: true },
    });
    expect(mocks.fetchLearningOsProxy).toHaveBeenCalledWith(
      expect.objectContaining({
        upstreamUrl: new URL('http://learning-os.test/api/convolab/courses?status=all'),
      })
    );
  });

  it('does not forward unrecognized status values even for admins', async () => {
    mocks.authRole.value = 'admin';
    mocks.fetchLearningOsProxy.mockResolvedValue(upstreamJson([]));

    await request(app).get('/api/courses?status=archived').expect(200);

    expect(mocks.fetchLearningOsProxy).toHaveBeenCalledWith(
      expect.objectContaining({
        upstreamUrl: new URL('http://learning-os.test/api/convolab/courses'),
      })
    );
  });

  it('proxies detail reads, encodes the path, and preserves private caching', async () => {
    const course = { id: 'course/id', title: 'Course detail' };
    mocks.fetchLearningOsProxy.mockResolvedValue(upstreamJson(course));

    const response = await request(app).get('/api/courses/course%2Fid').expect(200);

    expect(response.body).toEqual(course);
    expect(response.headers['cache-control']).toBe('private, max-age=60');
    expect(mocks.fetchLearningOsProxy).toHaveBeenCalledWith(
      expect.objectContaining({
        upstreamUrl: new URL('http://learning-os.test/api/convolab/courses/course%2Fid'),
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

    const response = await request(app).get('/api/courses/missing').expect(clientStatus);

    expect(response.body.error.message).toBe('Learning OS Course API request failed.');
    expect(JSON.stringify(response.body)).not.toContain('upstream details');
  });

  it('rejects malformed upstream list, detail, and JSON responses', async () => {
    mocks.fetchLearningOsProxy
      .mockResolvedValueOnce(upstreamJson({ data: [] }))
      .mockResolvedValueOnce(upstreamJson([]))
      .mockResolvedValueOnce(new globalThis.Response('not-json', { status: 200 }));

    await request(app).get('/api/courses').expect(502);
    await request(app).get('/api/courses/course-id').expect(502);
    const invalidJson = await request(app).get('/api/courses').expect(502);

    expect(invalidJson.body.error.message).toBe(
      'Learning OS Course API returned an invalid JSON response.'
    );
  });

  it('passes controlled proxy transport failures to the API error handler', async () => {
    mocks.fetchLearningOsProxy.mockRejectedValue(
      new AppError('Learning OS Course API is unavailable.', 502)
    );

    const response = await request(app).get('/api/courses').expect(502);

    expect(response.body.error.message).toBe('Learning OS Course API is unavailable.');
  });

  it('keeps course creation Express-owned', async () => {
    const episode = { id: 'episode-1', title: 'Episode', dialogue: null };
    const course = { id: 'course-1', title: 'Course', status: 'draft' };
    mockPrisma.episode.create.mockResolvedValue(episode);
    mockPrisma.course.create.mockResolvedValue(course);
    mockPrisma.courseEpisode.create.mockResolvedValue({ id: 'link-1' });

    const response = await request(app)
      .post('/api/courses')
      .send({
        title: 'Course',
        description: 'Description',
        sourceText: 'Source text',
        nativeLanguage: 'en',
        targetLanguage: 'ja',
        l1VoiceId: 'en-US-Neural2-J',
      })
      .expect(200);

    expect(response.body).toEqual(course);
    expect(mockPrisma.course.create).toHaveBeenCalled();
    expect(mocks.fetchLearningOsProxy).not.toHaveBeenCalled();
  });

  it.each([
    [
      'generate',
      {
        message: 'Course generation started',
        jobId: 'job-generate',
        courseId: 'course-id',
      },
    ],
    [
      'retry',
      {
        message: 'Course generation retried',
        jobId: 'job-retry',
        courseId: 'course-id',
      },
    ],
  ])('proxies the %s action when course generation routing is enabled', async (operation, body) => {
    process.env.LEARNING_OS_COURSE_GENERATION_PROXY_ENABLED = 'true';
    mocks.fetchLearningOsProxy.mockResolvedValue(upstreamJson(body));

    const response = await request(app).post(`/api/courses/course-id/${operation}`).expect(200);

    expect(response.body).toEqual(body);
    expect(mocks.getEffectiveUserId).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'actor-user-id' })
    );
    expect(mocks.fetchLearningOsProxy).toHaveBeenCalledWith(
      expect.objectContaining({
        upstreamUrl: new URL(`http://learning-os.test/api/convolab/courses/course-id/${operation}`),
        apiToken: 'proxy-token',
        method: 'POST',
        timeoutMs: 10_000,
      })
    );
    expect(mockPrisma.course.findFirst).not.toHaveBeenCalled();
    expect(mockCourseQueue.add).not.toHaveBeenCalled();
  });

  it('proxies reset and preserves its compatibility response', async () => {
    process.env.LEARNING_OS_COURSE_GENERATION_PROXY_ENABLED = 'true';
    const body = {
      message: 'Course reset successfully. You can now start generation again.',
      courseId: 'course-id',
    };
    mocks.fetchLearningOsProxy.mockResolvedValue(upstreamJson(body));

    const response = await request(app).post('/api/courses/course-id/reset').expect(200);

    expect(response.body).toEqual(body);
    expect(mocks.fetchLearningOsProxy).toHaveBeenCalledWith(
      expect.objectContaining({
        upstreamUrl: new URL('http://learning-os.test/api/convolab/courses/course-id/reset'),
        method: 'POST',
      })
    );
    expect(mockPrisma.course.update).not.toHaveBeenCalled();
  });

  it('proxies uncached generation status including the sanitized error detail', async () => {
    process.env.LEARNING_OS_COURSE_GENERATION_PROXY_ENABLED = 'true';
    const body = {
      status: 'error',
      progress: 75,
      isStuck: false,
      errorMessage: 'Course generation failed. Please retry.',
    };
    mocks.fetchLearningOsProxy.mockResolvedValue(upstreamJson(body));

    const response = await request(app).get('/api/courses/course-id/status').expect(200);

    expect(response.body).toEqual(body);
    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(mocks.fetchLearningOsProxy).toHaveBeenCalledWith(
      expect.objectContaining({
        upstreamUrl: new URL('http://learning-os.test/api/convolab/courses/course-id/status'),
        method: 'GET',
      })
    );
    expect(mockPrisma.course.findFirst).not.toHaveBeenCalled();
  });

  it('encodes the course identifier in lifecycle upstream paths', async () => {
    process.env.LEARNING_OS_COURSE_GENERATION_PROXY_ENABLED = 'true';
    mocks.fetchLearningOsProxy.mockResolvedValue(
      upstreamJson({ status: 'ready', progress: null, isStuck: false, errorMessage: null })
    );

    await request(app).get('/api/courses/course%2Fid/status').expect(200);

    expect(mocks.fetchLearningOsProxy).toHaveBeenCalledWith(
      expect.objectContaining({
        upstreamUrl: new URL('http://learning-os.test/api/convolab/courses/course%2Fid/status'),
      })
    );
  });

  it.each([400, 404, 409, 422, 429])(
    'preserves a safe lifecycle message for upstream HTTP %s',
    async (upstreamStatus) => {
      process.env.LEARNING_OS_COURSE_GENERATION_PROXY_ENABLED = 'true';
      mocks.fetchLearningOsProxy.mockResolvedValue(
        upstreamJson({ message: 'Safe compatibility message' }, upstreamStatus)
      );

      const response = await request(app)
        .post('/api/courses/course-id/generate')
        .expect(upstreamStatus);

      expect(response.body.error.message).toBe('Safe compatibility message');
    }
  );

  it.each([401, 403, 500, 503])(
    'hides lifecycle details and maps upstream HTTP %s to 502',
    async (upstreamStatus) => {
      process.env.LEARNING_OS_COURSE_GENERATION_PROXY_ENABLED = 'true';
      mocks.fetchLearningOsProxy.mockResolvedValue(
        upstreamJson({ message: 'sensitive upstream details' }, upstreamStatus)
      );

      const response = await request(app).post('/api/courses/course-id/retry').expect(502);

      expect(response.body.error.message).toBe('Learning OS Course API request failed.');
      expect(JSON.stringify(response.body)).not.toContain('sensitive upstream details');
    }
  );

  it.each([
    ['generate', { message: 'missing identifiers' }],
    ['retry', { message: 'missing job', courseId: 'course-id' }],
    ['reset', { message: 'missing course' }],
  ])('rejects a malformed %s success response', async (operation, body) => {
    process.env.LEARNING_OS_COURSE_GENERATION_PROXY_ENABLED = 'true';
    mocks.fetchLearningOsProxy.mockResolvedValue(upstreamJson(body));

    const response = await request(app).post(`/api/courses/course-id/${operation}`).expect(502);

    expect(response.body.error.message).toBe(
      `Learning OS Course API returned an invalid ${operation} response.`
    );
  });

  it.each([
    { status: 'unknown', progress: null, isStuck: false, errorMessage: null },
    { status: 'generating', progress: 101, isStuck: false, errorMessage: null },
    { status: 'generating', progress: 20, isStuck: 'false', errorMessage: null },
    { status: 'error', progress: null, isStuck: false },
  ])('rejects a malformed status success response', async (body) => {
    process.env.LEARNING_OS_COURSE_GENERATION_PROXY_ENABLED = 'true';
    mocks.fetchLearningOsProxy.mockResolvedValue(upstreamJson(body));

    const response = await request(app).get('/api/courses/course-id/status').expect(502);

    expect(response.body.error.message).toBe(
      'Learning OS Course API returned an invalid status response.'
    );
  });

  it('keeps lifecycle requests on Express when course generation routing is disabled', async () => {
    mockPrisma.course.findFirst.mockResolvedValue({ id: 'course-id', status: 'ready' });

    const response = await request(app).get('/api/courses/course-id/status').expect(200);

    expect(response.body).toEqual({ status: 'ready', progress: null, isStuck: false });
    expect(mockPrisma.course.findFirst).toHaveBeenCalledWith({
      where: { id: 'course-id', userId: 'effective-user-id' },
    });
    expect(mocks.fetchLearningOsProxy).not.toHaveBeenCalled();
  });
});
