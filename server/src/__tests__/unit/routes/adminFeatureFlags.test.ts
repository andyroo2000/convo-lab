import express, {
  json as expressJson,
  type NextFunction,
  type Request,
  type Response,
} from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { errorHandler } from '../../../middleware/errorHandler.js';

const mockRequireAuth = vi.hoisted(() =>
  vi.fn((req: Request & { userId?: string }, _res: Response, next: NextFunction) => {
    req.userId = 'admin-user';
    next();
  })
);
const mockRequireAdmin = vi.hoisted(() =>
  vi.fn((_req: Request, _res: Response, next: NextFunction) => next())
);
const mockGetLearningOsFeatureFlags = vi.hoisted(() => vi.fn());
const mockUpdateLearningOsFeatureFlags = vi.hoisted(() => vi.fn());

vi.mock('../../../middleware/auth.js', () => ({
  requireAuth: mockRequireAuth,
}));
vi.mock('../../../middleware/roleAuth.js', () => ({
  requireAdmin: mockRequireAdmin,
}));
vi.mock('../../../services/featureFlagsProxy.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../../services/featureFlagsProxy.js')>();

  return {
    ...original,
    getLearningOsFeatureFlags: mockGetLearningOsFeatureFlags,
    updateLearningOsFeatureFlags: mockUpdateLearningOsFeatureFlags,
  };
});

const featureFlags = {
  id: 'flag-1',
  dialoguesEnabled: true,
  scriptsEnabled: false,
  audioCourseEnabled: true,
  flashcardsEnabled: false,
  updatedAt: '2026-07-20T18:15:12.345Z',
};

describe('Admin Feature Flags Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetLearningOsFeatureFlags.mockResolvedValue(featureFlags);
    mockUpdateLearningOsFeatureFlags.mockResolvedValue({
      ...featureFlags,
      dialoguesEnabled: false,
    });
  });

  async function createApp() {
    const { default: router } = await import('../../../routes/adminFeatureFlags.js');
    const app = express();

    app.use(expressJson());
    app.use('/admin/feature-flags', router);
    app.use(errorHandler);

    return app;
  }

  it('authorizes and proxies the Learning OS feature-flag contract', async () => {
    const response = await request(await createApp()).get('/admin/feature-flags');

    expect(response.status).toBe(200);
    expect(response.body).toEqual(featureFlags);
    expect(response.headers['ratelimit-limit']).toBe('60');
    expect(mockRequireAuth).toHaveBeenCalledOnce();
    expect(mockRequireAdmin).toHaveBeenCalledOnce();
    expect(mockGetLearningOsFeatureFlags).toHaveBeenCalledOnce();
  });

  it('forwards only validated sparse boolean updates', async () => {
    const response = await request(await createApp())
      .patch('/admin/feature-flags')
      .send({ dialoguesEnabled: false, internalValue: true });

    expect(response.status).toBe(200);
    expect(response.body.dialoguesEnabled).toBe(false);
    expect(mockUpdateLearningOsFeatureFlags).toHaveBeenCalledWith({
      dialoguesEnabled: false,
    });
  });

  it('rejects invalid flag values before calling Learning OS', async () => {
    const response = await request(await createApp())
      .patch('/admin/feature-flags')
      .send({ dialoguesEnabled: 'false' });

    expect(response.status).toBe(400);
    expect(response.body.error.message).toBe('dialoguesEnabled must be a boolean');
    expect(mockUpdateLearningOsFeatureFlags).not.toHaveBeenCalled();
  });
});
