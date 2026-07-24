/* eslint-disable import/no-named-as-default-member */
import express, { type NextFunction, type Request, type Response } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthRequest } from '../../../middleware/auth.js';
import { errorHandler } from '../../../middleware/errorHandler.js';
import scriptsRouter from '../../../routes/scripts.js';

const mocks = vi.hoisted(() => ({
  fetchLearningOsProxy: vi.fn(),
  resolveLearningOsProxyContext: vi.fn(),
}));

vi.mock('../../../services/learningOsProxy.js', () => ({
  fetchLearningOsProxy: mocks.fetchLearningOsProxy,
  resolveLearningOsProxyContext: mocks.resolveLearningOsProxyContext,
}));
vi.mock('../../../middleware/auth.js', () => ({
  requireAuth: (req: Request, _res: Response, next: NextFunction) => {
    (req as AuthRequest).userId = USER_ID;
    next();
  },
  AuthRequest: class {},
}));
vi.mock('../../../middleware/emailVerification.js', () => ({
  requireEmailVerified: (_req: Request, _res: Response, next: NextFunction) => next(),
}));
vi.mock('../../../middleware/demoAuth.js', () => ({
  blockDemoUser: (_req: Request, _res: Response, next: NextFunction) => next(),
}));
vi.mock('../../../middleware/studyRateLimit.js', () => ({
  rateLimitStudyRoute: () => (_req: Request, _res: Response, next: NextFunction) => next(),
}));

const USER_ID = '018f47ea-4b37-7f21-8d5a-90e157176b8a';
const EPISODE_ID = '019c8e80-f73f-78e8-96e8-c5b462053ee0';
const SCRIPT_ID = '019c8e81-f73f-78e8-96e8-c5b462053ee0';
const SEGMENT_ID = '019c8e82-f73f-78e8-96e8-c5b462053ee0';
const MEDIA_ID = '019c8e83-f73f-78e8-96e8-c5b462053ee0';
const RENDER_ID = '019c8e84-f73f-78e8-96e8-c5b462053ee0';
const JOB_ID = '019c8e85-f73f-78e8-96e8-c5b462053ee0';

const upstreamJson = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new globalThis.Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });

const scriptBody = () => ({
  id: SCRIPT_ID,
  episodeId: EPISODE_ID,
  status: 'ready',
  imageStatus: 'ready',
  imageErrorMessage: null,
  voiceId: 'ja-JP-Neural2-D',
  voiceProvider: 'google',
  generationMetadataJson: null,
  errorMessage: null,
  createdAt: '2026-07-21T12:00:00.000000Z',
  updatedAt: '2026-07-21T12:00:00.000000Z',
  segments: [
    {
      id: SEGMENT_ID,
      scriptId: SCRIPT_ID,
      order: 0,
      text: '駅に行きます。',
      reading: '駅[えき]に行[い]きます。',
      translation: 'I am going to the station.',
      imagePrompt: 'A station.',
      imageStatus: 'ready',
      imageErrorMessage: null,
      imageMediaId: MEDIA_ID,
      imageGeneratedAt: '2026-07-21T12:00:00.000000Z',
      metadata: {},
      createdAt: '2026-07-21T12:00:00.000000Z',
      updatedAt: '2026-07-21T12:00:00.000000Z',
      imageMedia: {
        id: MEDIA_ID,
        mediaKind: 'image',
        contentType: 'image/webp',
        publicUrl: `/api/convolab/scripts/media/${MEDIA_ID}`,
        sourceFilename: 'station.webp',
      },
    },
  ],
  renders: [
    {
      id: RENDER_ID,
      scriptId: SCRIPT_ID,
      speed: '0.85',
      numericSpeed: 0.85,
      status: 'ready',
      audioUrl: `/api/convolab/scripts/${EPISODE_ID}/audio/${RENDER_ID}`,
      timingData: [{ unitIndex: 0, startTime: 0, endTime: 1000 }],
      approxDurationSeconds: 1,
      errorMessage: null,
      createdAt: '2026-07-21T12:00:00.000000Z',
      updatedAt: '2026-07-21T12:00:00.000000Z',
    },
  ],
});

const episodeBody = () => {
  const { segments: _segments, renders: _renders, ...script } = scriptBody();

  return {
    id: EPISODE_ID,
    userId: USER_ID,
    title: 'Japanese Script',
    sourceText: '駅に行きます。',
    targetLanguage: 'ja',
    nativeLanguage: 'en',
    contentType: 'script',
    status: 'draft',
    audioScript: script,
  };
};

describe('Learning OS script routes', () => {
  let app: express.Application;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveLearningOsProxyContext.mockResolvedValue({
      config: { apiUrl: 'http://learning-os.test', apiToken: 'proxy-token' },
      user: { id: USER_ID, email: 'learner@example.com', role: 'user' },
    });
    app = express();
    app.use(express.json());
    app.use('/api/scripts', scriptsRouter);
    app.use(errorHandler);
  });

  it('allowlists create fields and leaves quota ownership with Learning OS', async () => {
    const longSourceText = '駅に行きます。'.repeat(200);
    mocks.fetchLearningOsProxy.mockResolvedValue(
      upstreamJson({ ...episodeBody(), sourceText: longSourceText })
    );

    const response = await request(app)
      .post('/api/scripts')
      .send({ sourceText: longSourceText, voiceId: 'ja-JP-Neural2-D', userId: 'attacker' })
      .expect(200);

    expect(mocks.fetchLearningOsProxy).toHaveBeenCalledWith({
      upstreamUrl: new URL('http://learning-os.test/api/convolab/scripts'),
      apiToken: 'proxy-token',
      user: { id: USER_ID, email: 'learner@example.com', role: 'user' },
      method: 'POST',
      body: { sourceText: longSourceText, voiceId: 'ja-JP-Neural2-D' },
      timeoutMs: 10_000,
      timeoutMessage: 'Learning OS Script API request timed out.',
      networkErrorMessage: 'Learning OS Script API is unavailable.',
    });
    expect(response.body.audioScript.segments).toEqual([]);
    expect(response.body.audioScript.renders).toEqual([]);
  });

  it('routes annotation and segment updates with operation-specific bodies and timeouts', async () => {
    mocks.fetchLearningOsProxy.mockResolvedValue(upstreamJson(scriptBody()));
    await request(app)
      .post(`/api/scripts/${EPISODE_ID}/annotate`)
      .send({ ignored: true })
      .expect(200);

    expect(mocks.fetchLearningOsProxy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        upstreamUrl: new URL(`http://learning-os.test/api/convolab/scripts/${EPISODE_ID}/annotate`),
        method: 'POST',
        body: undefined,
        timeoutMs: 120_000,
      })
    );

    mocks.fetchLearningOsProxy.mockResolvedValue(upstreamJson(scriptBody()));
    const segments = [{ text: '駅です。', reading: '駅[えき]です。', translation: 'Station.' }];
    await request(app)
      .patch(`/api/scripts/${EPISODE_ID}/segments`)
      .send({ title: '  Script  ', voiceId: 'ja-JP-Neural2-D', segments, admin: true })
      .expect(200);

    expect(mocks.fetchLearningOsProxy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        upstreamUrl: new URL(`http://learning-os.test/api/convolab/scripts/${EPISODE_ID}/segments`),
        method: 'PATCH',
        body: { title: '  Script  ', voiceId: 'ja-JP-Neural2-D', segments },
        timeoutMs: 10_000,
      })
    );
  });

  it('queues render and image jobs without forwarding untrusted fields', async () => {
    mocks.fetchLearningOsProxy.mockResolvedValue(
      upstreamJson({ jobId: JOB_ID, message: 'Script audio rendering started.' })
    );
    await request(app).post(`/api/scripts/${EPISODE_ID}/render`).send({ force: true }).expect(200);
    expect(mocks.fetchLearningOsProxy).toHaveBeenLastCalledWith(
      expect.objectContaining({ method: 'POST', body: undefined })
    );

    mocks.fetchLearningOsProxy.mockResolvedValue(
      upstreamJson({ jobId: JOB_ID, message: 'Script image generation started.', existing: true })
    );
    await request(app)
      .post(`/api/scripts/${EPISODE_ID}/images`)
      .send({ force: false, userId: 'attacker' })
      .expect(200);
    expect(mocks.fetchLearningOsProxy).toHaveBeenLastCalledWith(
      expect.objectContaining({ method: 'POST', body: { force: false } })
    );
  });

  it('returns rewritten no-store status and durable job responses', async () => {
    mocks.fetchLearningOsProxy
      .mockResolvedValueOnce(upstreamJson(scriptBody()))
      .mockResolvedValueOnce(
        upstreamJson({
          id: JOB_ID,
          state: 'completed',
          progress: 100,
          result: { episodeId: EPISODE_ID, status: 'ready' },
        })
      );

    const status = await request(app).get(`/api/scripts/${EPISODE_ID}/status`).expect(200);
    expect(status.headers['cache-control']).toBe('private, no-store');
    expect(status.body.renders[0].audioUrl).toBe(`/api/scripts/${EPISODE_ID}/audio/${RENDER_ID}`);

    const job = await request(app).get(`/api/scripts/job/${JOB_ID}`).expect(200);
    expect(job.headers['cache-control']).toBe('private, no-store');
    expect(job.body).toEqual({
      id: JOB_ID,
      state: 'completed',
      progress: 100,
      result: { episodeId: EPISODE_ID, status: 'ready' },
    });
  });

  it('streams owner-scoped images with hardened response headers', async () => {
    mocks.fetchLearningOsProxy.mockResolvedValue(
      new globalThis.Response('webp-bytes', {
        status: 200,
        headers: {
          'Cache-Control': 'private, max-age=15552000, immutable',
          'Content-Disposition': 'inline; filename="station.webp"',
          'Content-Type': 'image/webp',
        },
      })
    );

    const response = await request(app).get(`/api/scripts/media/${MEDIA_ID}`).expect(200);

    expect(response.body).toEqual(Buffer.from('webp-bytes'));
    expect(response.headers['content-type']).toMatch(/^image\/webp/);
    expect(response.headers['content-security-policy']).toBe("sandbox; default-src 'none'");
    expect(response.headers['cross-origin-resource-policy']).toBe('same-origin');
    expect(mocks.fetchLearningOsProxy).toHaveBeenCalledWith(
      expect.objectContaining({
        upstreamUrl: new URL(`http://learning-os.test/api/convolab/scripts/media/${MEDIA_ID}`),
        additionalHeaders: { Accept: 'image/avif,image/webp,image/png,image/jpeg,image/gif' },
      })
    );
  });

  it('forwards validated audio ranges and preserves partial response headers', async () => {
    mocks.fetchLearningOsProxy.mockResolvedValue(
      new globalThis.Response('audio', {
        status: 206,
        headers: {
          'Accept-Ranges': 'bytes',
          'Content-Length': '5',
          'Content-Range': 'bytes 0-4/10',
          'Content-Type': 'audio/mpeg',
        },
      })
    );

    const response = await request(app)
      .get(`/api/scripts/${EPISODE_ID}/audio/${RENDER_ID}`)
      .set('Range', 'bytes=0-4')
      .expect(206);

    expect(response.body).toEqual(Buffer.from('audio'));
    expect(response.headers['content-range']).toBe('bytes 0-4/10');
    expect(mocks.fetchLearningOsProxy).toHaveBeenCalledWith(
      expect.objectContaining({ additionalHeaders: { Accept: 'audio/mpeg', Range: 'bytes=0-4' } })
    );
  });

  it('rejects malformed ranges and normalizes legacy upstream media paths', async () => {
    await request(app)
      .get(`/api/scripts/${EPISODE_ID}/audio/${RENDER_ID}`)
      .set('Range', 'items=0-4')
      .expect(400);
    expect(mocks.fetchLearningOsProxy).not.toHaveBeenCalled();

    const mismatched = scriptBody();
    mismatched.renders[0].audioUrl = 'https://legacy-storage.example.com/render.mp3';
    mismatched.segments[0].imageMedia.publicUrl = `/api/scripts/media/${MEDIA_ID}`;
    mocks.fetchLearningOsProxy.mockResolvedValue(upstreamJson(mismatched));
    const response = await request(app).get(`/api/scripts/${EPISODE_ID}/status`).expect(200);
    expect(response.body.renders[0].audioUrl).toBe(`/api/scripts/${EPISODE_ID}/audio/${RENDER_ID}`);
    expect(response.body.segments[0].imageMedia.publicUrl).toBe(
      `/api/convolab/scripts/media/${MEDIA_ID}`
    );
  });

  it('maps hidden upstream misses through while shielding auth and infrastructure failures', async () => {
    mocks.fetchLearningOsProxy.mockResolvedValueOnce(upstreamJson({ message: 'Not found.' }, 404));
    await request(app).get(`/api/scripts/${EPISODE_ID}/status`).expect(404);

    mocks.fetchLearningOsProxy.mockResolvedValueOnce(
      upstreamJson({ message: 'Token details' }, 401)
    );
    const response = await request(app).get(`/api/scripts/job/${JOB_ID}`).expect(502);
    expect(response.body.error.message).not.toContain('Token details');
  });
});
