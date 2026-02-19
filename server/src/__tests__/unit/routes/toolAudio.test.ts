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

import toolAudioRoutes, { resetToolAudioRateLimitForTests } from '../../../routes/toolAudio.js';

describe('toolAudio route', () => {
  let app: Application;
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.TOOLS_AUDIO_SIGNED_URL_RATE_LIMIT_MAX_REQUESTS = '500';
    process.env.TOOLS_AUDIO_SIGNED_URL_RATE_LIMIT_WINDOW_MS = '60000';
    app = express();
    app.use(json());
    app.use('/api/tools-audio', toolAudioRoutes);
    storageClientMocks.gcsFileExists.mockResolvedValue(true);
    storageClientMocks.getSignedReadUrl.mockReset();
    resetToolAudioRateLimitForTests();
  });

  afterEach(() => {
    process.env = originalEnv;
    resetToolAudioRateLimitForTests();
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
      .set('x-forwarded-for', '203.0.113.10')
      .send(payload)
      .expect(200);

    const response = await request(app)
      .post('/api/tools-audio/signed-urls')
      .set('x-forwarded-for', '203.0.113.10')
      .send(payload)
      .expect(429);

    expect(response.body.error).toContain('Too many signed-url requests');
  });
});
