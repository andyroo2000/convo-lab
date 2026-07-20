import express, { type Application, json } from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const storageClientMocks = vi.hoisted(() => ({
  gcsFileExists: vi.fn(),
  getSignedReadUrl: vi.fn(),
}));

vi.mock('../../../services/storageClient.js', () => ({
  gcsFileExists: storageClientMocks.gcsFileExists,
  getSignedReadUrl: storageClientMocks.getSignedReadUrl,
}));

describe('toolAudio route', () => {
  let app: Application;
  const originalEnv = process.env;
  const fetchMock = vi.fn();

  const mountToolAudioApp = async () => {
    vi.resetModules();
    const { default: toolAudioRoutes } = await import('../../../routes/toolAudio.js');
    const { errorHandler } = await import('../../../middleware/errorHandler.js');
    app = express();
    app.use(json());
    app.use('/api/tools-audio', toolAudioRoutes);
    app.use(errorHandler);
    storageClientMocks.gcsFileExists.mockResolvedValue(true);
    storageClientMocks.getSignedReadUrl.mockReset();
  };

  beforeEach(async () => {
    process.env = { ...originalEnv };
    process.env.LEARNING_OS_STATIC_MEDIA_PROXY_ENABLED = 'false';
    process.env.GCS_BUCKET_NAME = 'convolab-storage';
    process.env.TOOLS_AUDIO_GCS_ROOT = 'tools-audio';
    process.env.TOOLS_AUDIO_SIGNED_URL_RATE_LIMIT_MAX_REQUESTS = '500';
    process.env.TOOLS_AUDIO_SIGNED_URL_RATE_LIMIT_WINDOW_MS = '60000';
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
    await mountToolAudioApp();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.unstubAllGlobals();
  });

  it('returns passthrough URLs when signing is disabled', async () => {
    process.env.TOOLS_AUDIO_SIGNED_URLS_ENABLED = 'false';

    const response = await request(app)
      .post('/api/tools-audio/signed-urls')
      .send({
        paths: ['/tools-audio/japanese-time/google-kento-professional/time/minute/44.mp3'],
      })
      .expect(200);

    expect(response.body.mode).toBe('passthrough');
    expect(response.body.urls).toHaveProperty(
      '/tools-audio/japanese-time/google-kento-professional/time/minute/44.mp3'
    );
    expect(storageClientMocks.getSignedReadUrl).not.toHaveBeenCalled();
  });

  it('returns signed URLs when signing is enabled', async () => {
    process.env.TOOLS_AUDIO_SIGNED_URLS_ENABLED = 'true';
    process.env.TOOLS_AUDIO_GCS_ROOT = 'tools-audio';
    storageClientMocks.getSignedReadUrl.mockResolvedValue({
      url: 'https://signed.example/minute-44.mp3',
      expiresAt: '2100-01-01T00:00:00.000Z',
    });

    const response = await request(app)
      .post('/api/tools-audio/signed-urls')
      .send({
        paths: ['/tools-audio/japanese-time/google-kento-professional/time/minute/44.mp3'],
      })
      .expect(200);

    expect(response.body.mode).toBe('signed');
    expect(
      response.body.urls['/tools-audio/japanese-time/google-kento-professional/time/minute/44.mp3']
        .url
    ).toBe('https://signed.example/minute-44.mp3');
    expect(storageClientMocks.getSignedReadUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        filePath: 'tools-audio/japanese-time/google-kento-professional/time/minute/44.mp3',
      })
    );
  });

  it('falls back to passthrough URL when object is missing in GCS', async () => {
    process.env.TOOLS_AUDIO_SIGNED_URLS_ENABLED = 'true';
    storageClientMocks.gcsFileExists.mockResolvedValue(false);

    const path =
      '/tools-audio/japanese-counters/google-kento-professional/phrase/hon/banana/03.mp3';
    const response = await request(app)
      .post('/api/tools-audio/signed-urls')
      .send({
        paths: [path],
      });

    expect(response.status).toBe(200);
    expect(response.body.urls[path].url).toBe(path);
    expect(storageClientMocks.getSignedReadUrl).not.toHaveBeenCalled();
  });

  it('rejects invalid paths', async () => {
    await request(app)
      .post('/api/tools-audio/signed-urls')
      .send({
        paths: ['/tools-audio/../../secrets.txt'],
      })
      .expect(400);
  });

  it('rejects malformed absolute URLs instead of throwing', async () => {
    const response = await request(app)
      .post('/api/tools-audio/signed-urls')
      .send({
        paths: ['https://[bad'],
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('valid /tools-audio/*.mp3 values');
  });

  it('rejects requests with more than 60 paths', async () => {
    const paths = Array.from(
      { length: 61 },
      (_, index) => `/tools-audio/japanese-time/google-kento-professional/time/minute/${index}.mp3`
    );

    const response = await request(app).post('/api/tools-audio/signed-urls').send({ paths });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('1-60');
  });

  it('rejects paths that exceed max length', async () => {
    const tooLongPath = `/tools-audio/${'a'.repeat(320)}.mp3`;

    const response = await request(app)
      .post('/api/tools-audio/signed-urls')
      .send({ paths: [tooLongPath] });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('valid /tools-audio/*.mp3 values');
  });

  it('rate-limits repeated signed-url requests by client IP', async () => {
    process.env.TOOLS_AUDIO_SIGNED_URL_RATE_LIMIT_MAX_REQUESTS = '2';
    process.env.TOOLS_AUDIO_SIGNED_URL_RATE_LIMIT_WINDOW_MS = '60000';
    process.env.TOOLS_AUDIO_SIGNED_URLS_ENABLED = 'false';
    await mountToolAudioApp();

    const payload = {
      paths: ['/tools-audio/japanese-time/google-kento-professional/time/minute/44.mp3'],
    };

    await request(app).post('/api/tools-audio/signed-urls').send(payload).expect(200);
    await request(app).post('/api/tools-audio/signed-urls').send(payload).expect(200);

    const response = await request(app)
      .post('/api/tools-audio/signed-urls')
      .send(payload)
      .expect(429);

    expect(response.body.error).toContain('Too many signed-url requests');
    expect(response.headers['retry-after']).toBeDefined();
    expect(Number(response.headers['retry-after'])).toBeGreaterThanOrEqual(1);
  });

  it('ignores x-forwarded-for when trust proxy is disabled', async () => {
    process.env.TOOLS_AUDIO_SIGNED_URL_RATE_LIMIT_MAX_REQUESTS = '1';
    process.env.TOOLS_AUDIO_SIGNED_URL_RATE_LIMIT_WINDOW_MS = '60000';
    process.env.TOOLS_AUDIO_SIGNED_URLS_ENABLED = 'false';
    await mountToolAudioApp();

    const payload = {
      paths: ['/tools-audio/japanese-time/google-kento-professional/time/minute/44.mp3'],
    };

    await request(app)
      .post('/api/tools-audio/signed-urls')
      .set('x-forwarded-for', '203.0.113.10')
      .send(payload)
      .expect(200);

    await request(app)
      .post('/api/tools-audio/signed-urls')
      .set('x-forwarded-for', '198.51.100.4')
      .send(payload)
      .expect(429);

    const response = await request(app)
      .post('/api/tools-audio/signed-urls')
      .set('x-forwarded-for', '198.51.100.5')
      .send(payload)
      .expect(429);

    expect(response.headers['retry-after']).toBeDefined();
  });

  it('uses x-forwarded-for when trust proxy is enabled', async () => {
    process.env.TOOLS_AUDIO_SIGNED_URL_RATE_LIMIT_MAX_REQUESTS = '1';
    process.env.TOOLS_AUDIO_SIGNED_URL_RATE_LIMIT_WINDOW_MS = '60000';
    process.env.TOOLS_AUDIO_SIGNED_URLS_ENABLED = 'false';
    await mountToolAudioApp();
    app.set('trust proxy', true);

    const payload = {
      paths: ['/tools-audio/japanese-time/google-kento-professional/time/minute/44.mp3'],
    };

    await request(app)
      .post('/api/tools-audio/signed-urls')
      .set('x-forwarded-for', '203.0.113.10')
      .send(payload)
      .expect(200);

    await request(app)
      .post('/api/tools-audio/signed-urls')
      .set('x-forwarded-for', '198.51.100.4')
      .send(payload)
      .expect(200);

    await request(app)
      .post('/api/tools-audio/signed-urls')
      .set('x-forwarded-for', '203.0.113.10')
      .send(payload)
      .expect(429)
      .expect('Retry-After', /.+/);
  });

  it('proxies signed URL batches through Learning OS without service credentials', async () => {
    process.env.LEARNING_OS_STATIC_MEDIA_PROXY_ENABLED = 'true';
    process.env.LEARNING_OS_API_URL = 'https://learning-os.example/';
    const path = '/tools-audio/japanese-time/google-kento-professional/time/minute/44.mp3';
    const upstreamBody = {
      mode: 'signed',
      ttlSeconds: 43_200,
      urls: {
        [path]: {
          url: `https://storage.googleapis.com/convolab-storage${path}?signature=secret`,
          expiresAt: '2100-01-01T00:00:00.000000Z',
        },
      },
    };
    fetchMock.mockResolvedValueOnce(Response.json(upstreamBody));

    const response = await request(app)
      .post('/api/tools-audio/signed-urls')
      .send({ paths: [path] })
      .expect(200);

    expect(response.body).toEqual(upstreamBody);
    expect(fetchMock).toHaveBeenCalledWith(
      new URL('https://learning-os.example/api/tools-audio/signed-urls'),
      expect.objectContaining({
        method: 'POST',
        redirect: 'manual',
        body: JSON.stringify({ paths: [path] }),
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      })
    );
    expect(fetchMock.mock.calls[0]?.[1]?.headers).not.toHaveProperty('Authorization');
    expect(storageClientMocks.gcsFileExists).not.toHaveBeenCalled();
  });

  it('preserves Learning OS validation and rate-limit contracts', async () => {
    process.env.LEARNING_OS_STATIC_MEDIA_PROXY_ENABLED = 'true';
    process.env.LEARNING_OS_API_URL = 'https://learning-os.example';
    const payload = { paths: ['/tools-audio/japanese/minute/44.mp3'] };
    fetchMock
      .mockResolvedValueOnce(Response.json({ error: 'upstream detail' }, { status: 400 }))
      .mockResolvedValueOnce(
        Response.json(
          { error: 'Too many signed-url requests. Please retry shortly.' },
          { status: 429, headers: { 'retry-after': '37' } }
        )
      );

    await request(app).post('/api/tools-audio/signed-urls').send({ paths: 'invalid' }).expect(400, {
      error: 'paths must be an array of 1-60 valid /tools-audio/*.mp3 values',
    });

    await request(app)
      .post('/api/tools-audio/signed-urls')
      .send(payload)
      .expect(429)
      .expect('Retry-After', '37')
      .expect({
        error: 'Too many signed-url requests. Please retry shortly.',
      });
  });

  it('preserves per-client rate limiting before proxying to Learning OS', async () => {
    process.env.LEARNING_OS_STATIC_MEDIA_PROXY_ENABLED = 'true';
    process.env.LEARNING_OS_API_URL = 'https://learning-os.example';
    process.env.TOOLS_AUDIO_SIGNED_URL_RATE_LIMIT_MAX_REQUESTS = '1';
    await mountToolAudioApp();
    const path = '/tools-audio/japanese/minute/44.mp3';
    fetchMock.mockResolvedValueOnce(
      Response.json({
        mode: 'passthrough',
        ttlSeconds: 43_200,
        urls: {
          [path]: {
            url: path,
            expiresAt: '2100-01-01T00:00:00.000Z',
          },
        },
      })
    );

    await request(app)
      .post('/api/tools-audio/signed-urls')
      .send({ paths: [path] })
      .expect(200);
    await request(app)
      .post('/api/tools-audio/signed-urls')
      .send({ paths: [path] })
      .expect(429)
      .expect('Retry-After', /.+/);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rejects a Learning OS URL with a path prefix instead of silently discarding it', async () => {
    process.env.LEARNING_OS_STATIC_MEDIA_PROXY_ENABLED = 'true';
    process.env.LEARNING_OS_API_URL = 'https://gateway.example/learning-os';

    const response = await request(app)
      .post('/api/tools-audio/signed-urls')
      .send({ paths: ['/tools-audio/japanese/minute/44.mp3'] })
      .expect(503);

    expect(response.body.error.message).toContain('enabled but not configured');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects malformed successful responses from Learning OS', async () => {
    process.env.LEARNING_OS_STATIC_MEDIA_PROXY_ENABLED = 'true';
    process.env.LEARNING_OS_API_URL = 'https://learning-os.example';
    fetchMock.mockResolvedValueOnce(
      Response.json({
        mode: 'signed',
        ttlSeconds: 43_200,
        urls: {
          '/tools-audio/japanese/minute/44.mp3': {
            url: 'https://attacker.example/audio.mp3',
            expiresAt: '2100-01-01T00:00:00.000Z',
          },
        },
      })
    );

    const response = await request(app)
      .post('/api/tools-audio/signed-urls')
      .send({ paths: ['/tools-audio/japanese/minute/44.mp3'] })
      .expect(502);

    expect(response.body.error.message).toContain('invalid response');
  });

  it('rejects signed URLs for a different GCS bucket', async () => {
    process.env.LEARNING_OS_STATIC_MEDIA_PROXY_ENABLED = 'true';
    process.env.LEARNING_OS_API_URL = 'https://learning-os.example';
    const path = '/tools-audio/japanese/minute/44.mp3';
    fetchMock.mockResolvedValueOnce(
      Response.json({
        mode: 'signed',
        ttlSeconds: 43_200,
        urls: {
          [path]: {
            url: `https://storage.googleapis.com/other-bucket${path}?signature=secret`,
            expiresAt: '2100-01-01T00:00:00.000Z',
          },
        },
      })
    );

    const response = await request(app)
      .post('/api/tools-audio/signed-urls')
      .send({ paths: [path] })
      .expect(502);

    expect(response.body.error.message).toContain('invalid response');
  });

  it('rejects successful responses that omit or replace requested paths', async () => {
    process.env.LEARNING_OS_STATIC_MEDIA_PROXY_ENABLED = 'true';
    process.env.LEARNING_OS_API_URL = 'https://learning-os.example';
    const requestedPath = '/tools-audio/japanese/minute/44.mp3';
    fetchMock.mockResolvedValueOnce(
      Response.json({
        mode: 'signed',
        ttlSeconds: 43_200,
        urls: {
          '/tools-audio/japanese/minute/45.mp3': {
            url: 'https://storage.googleapis.com/convolab-storage/tools-audio/japanese/minute/45.mp3?signature=secret',
            expiresAt: '2100-01-01T00:00:00.000Z',
          },
        },
      })
    );

    const response = await request(app)
      .post('/api/tools-audio/signed-urls')
      .send({ paths: [requestedPath] })
      .expect(502);

    expect(response.body.error.message).toContain('invalid response');
  });

  it('returns a gateway error when Learning OS is unavailable', async () => {
    process.env.LEARNING_OS_STATIC_MEDIA_PROXY_ENABLED = 'true';
    process.env.LEARNING_OS_API_URL = 'https://learning-os.example';
    fetchMock.mockRejectedValueOnce(new Error('network down'));

    const response = await request(app)
      .post('/api/tools-audio/signed-urls')
      .send({ paths: ['/tools-audio/japanese/minute/44.mp3'] })
      .expect(502);

    expect(response.body.error.message).toBe('Learning OS Static Media API is unavailable.');
  });
});
