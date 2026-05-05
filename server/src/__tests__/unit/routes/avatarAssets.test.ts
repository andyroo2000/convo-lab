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

  const mountAvatarAssetsApp = async () => {
    vi.resetModules();
    const { default: avatarAssetRoutes } = await import('../../../routes/avatarAssets.js');
    app = express();
    app.use('/api/avatars', avatarAssetRoutes);
    storageClientMocks.gcsFileExists.mockResolvedValue(true);
    storageClientMocks.getSignedReadUrl.mockResolvedValue({
      url: 'https://signed.example/ja-shohei.jpg',
      expiresAt: '2100-01-01T00:00:00.000Z',
    });
  };

  beforeEach(async () => {
    process.env = { ...originalEnv };
    await mountAvatarAssetsApp();
  });

  afterEach(() => {
    process.env = originalEnv;
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
});
