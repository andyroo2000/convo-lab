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

import toolAudioRoutes from '../../../routes/toolAudio.js';

describe('toolAudio route', () => {
  let app: Application;
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    app = express();
    app.use(json());
    app.use('/api/tools-audio', toolAudioRoutes);
    storageClientMocks.gcsFileExists.mockResolvedValue(true);
    storageClientMocks.getSignedReadUrl.mockReset();
  });

  afterEach(() => {
    process.env = originalEnv;
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
});
