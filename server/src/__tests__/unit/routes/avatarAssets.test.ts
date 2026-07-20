import express, { type Application } from 'express';
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

describe('avatarAssets route', () => {
  let app: Application;
  const originalEnv = process.env;
  const fetchMock = vi.fn();

  const mountAvatarAssetsApp = async () => {
    vi.resetModules();
    const { default: avatarAssetRoutes } = await import('../../../routes/avatarAssets.js');
    const { errorHandler } = await import('../../../middleware/errorHandler.js');
    app = express();
    app.use('/api/avatars', avatarAssetRoutes);
    app.use(errorHandler);
    storageClientMocks.gcsFileExists.mockResolvedValue(true);
    storageClientMocks.getSignedReadUrl.mockResolvedValue({
      url: 'https://signed.example/ja-shohei.jpg',
      expiresAt: '2100-01-01T00:00:00.000Z',
    });
  };

  beforeEach(async () => {
    process.env = { ...originalEnv };
    process.env.LEARNING_OS_STATIC_MEDIA_PROXY_ENABLED = 'false';
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
    await mountAvatarAssetsApp();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.unstubAllGlobals();
  });

  it('redirects valid avatar requests to signed GCS URLs', async () => {
    process.env.GCS_BUCKET_NAME = 'convolab-storage';
    process.env.AVATARS_GCS_ROOT = 'avatars';

    const response = await request(app).get('/api/avatars/voices/ja-shohei.jpg').expect(302);

    expect(response.headers.location).toBe('https://signed.example/ja-shohei.jpg');
    expect(storageClientMocks.gcsFileExists).toHaveBeenCalledWith('avatars/voices/ja-shohei.jpg');
    expect(storageClientMocks.getSignedReadUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        filePath: 'avatars/voices/ja-shohei.jpg',
        responseType: 'image/jpeg',
      })
    );
  });

  it('rejects unsafe avatar paths', async () => {
    await request(app).get('/api/avatars/../secrets.jpg').expect(404);

    expect(storageClientMocks.getSignedReadUrl).not.toHaveBeenCalled();
  });

  it('returns 404 when the avatar object is missing', async () => {
    process.env.GCS_BUCKET_NAME = 'convolab-storage';
    storageClientMocks.gcsFileExists.mockResolvedValueOnce(false);

    await request(app).get('/api/avatars/voices/ja-missing.jpg').expect(404);

    expect(storageClientMocks.getSignedReadUrl).not.toHaveBeenCalled();
  });

  it('falls back to deterministic GCS URLs when signing is unavailable', async () => {
    process.env.GCS_BUCKET_NAME = 'convolab-storage';
    storageClientMocks.getSignedReadUrl.mockRejectedValueOnce(new Error('missing signer'));

    const response = await request(app).get('/api/avatars/voices/ja-shohei.jpg').expect(302);

    expect(response.headers.location).toBe(
      'https://storage.googleapis.com/convolab-storage/avatars/voices/ja-shohei.jpg'
    );
  });

  it('falls back to local static paths when signing is disabled', async () => {
    process.env.AVATAR_SIGNED_URLS_ENABLED = 'false';

    const response = await request(app).get('/api/avatars/ja-male-casual.jpg').expect(302);

    expect(response.headers.location).toBe('/avatars/ja-male-casual.jpg');
    expect(storageClientMocks.getSignedReadUrl).not.toHaveBeenCalled();
  });

  it('proxies signed avatar redirects through Learning OS without service credentials', async () => {
    process.env.LEARNING_OS_STATIC_MEDIA_PROXY_ENABLED = 'true';
    process.env.LEARNING_OS_API_URL = 'https://learning-os.example/';
    fetchMock.mockResolvedValueOnce(
      new Response(null, {
        status: 302,
        headers: {
          'cache-control': 'max-age=300, private',
          location:
            'https://storage.googleapis.com/convolab-storage/avatars/voices/ja-shohei.jpg?signature=secret',
        },
      })
    );

    const response = await request(app).get('/api/avatars/voices/ja-shohei.jpg').expect(302);

    expect(response.headers.location).toContain(
      'https://storage.googleapis.com/convolab-storage/avatars/voices/ja-shohei.jpg'
    );
    expect(response.headers['cache-control']).toBe('max-age=300, private');
    expect(fetchMock).toHaveBeenCalledWith(
      new URL('https://learning-os.example/api/avatars/voices/ja-shohei.jpg'),
      expect.objectContaining({
        method: 'GET',
        redirect: 'manual',
        headers: { Accept: 'application/json' },
      })
    );
    expect(fetchMock.mock.calls[0]?.[1]?.headers).not.toHaveProperty('Authorization');
    expect(storageClientMocks.gcsFileExists).not.toHaveBeenCalled();
  });

  it('rejects unsafe avatar paths before contacting Learning OS', async () => {
    process.env.LEARNING_OS_STATIC_MEDIA_PROXY_ENABLED = 'true';
    process.env.LEARNING_OS_API_URL = 'https://learning-os.example';

    await request(app).get('/api/avatars/voices/ja-shohei.jpg%0A').expect(404);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('maps invalid Learning OS redirects to a gateway error', async () => {
    process.env.LEARNING_OS_STATIC_MEDIA_PROXY_ENABLED = 'true';
    process.env.LEARNING_OS_API_URL = 'https://learning-os.example';
    fetchMock.mockResolvedValueOnce(
      new Response(null, {
        status: 302,
        headers: { location: 'https://attacker.example/avatar.jpg' },
      })
    );

    const response = await request(app).get('/api/avatars/voices/ja-shohei.jpg').expect(502);

    expect(response.body.error.message).toContain('invalid redirect');
  });

  it('returns a gateway error when Learning OS is unavailable', async () => {
    process.env.LEARNING_OS_STATIC_MEDIA_PROXY_ENABLED = 'true';
    process.env.LEARNING_OS_API_URL = 'https://learning-os.example';
    fetchMock.mockRejectedValueOnce(new Error('network down'));

    const response = await request(app).get('/api/avatars/voices/ja-shohei.jpg').expect(502);

    expect(response.body).toEqual({
      error: {
        message: 'Learning OS Static Media API is unavailable.',
        statusCode: 502,
      },
    });
  });
});
