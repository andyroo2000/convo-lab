import express, {
  json as expressJson,
  type ErrorRequestHandler,
  type NextFunction,
  type Request,
  type Response,
} from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CLIENT_FEATURE_FLAG_SELECT,
  DEFAULT_CLIENT_FEATURE_FLAGS,
} from '../../../services/featureFlags.js';
import { mockPrisma } from '../../setup.js';

const mockRequireAuth = vi.hoisted(() =>
  vi.fn((_req: Request, _res: Response, next: NextFunction) => next())
);

vi.mock('../../../middleware/auth.js', () => ({
  requireAuth: mockRequireAuth,
}));

const existingFlags = {
  id: 'flag-1',
  dialoguesEnabled: true,
  scriptsEnabled: false,
  audioCourseEnabled: true,
  flashcardsEnabled: false,
  updatedAt: new Date('2026-07-19T12:00:00.000Z'),
};

describe('Feature Flags Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function createApp() {
    const { default: featureFlagsRouter } = await import('../../../routes/featureFlags.js');
    const app = express();

    app.use(expressJson());
    app.use('/feature-flags', featureFlagsRouter);
    app.use(((error: Error, _req: Request, res: Response, _next: NextFunction) => {
      res.status(500).json({ error: error.message });
    }) as ErrorRequestHandler);

    return app;
  }

  it('requires authentication and returns only the client feature-flag projection', async () => {
    mockPrisma.featureFlag.findFirst.mockResolvedValue(existingFlags);
    const app = await createApp();

    const response = await request(app).get('/feature-flags');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      ...existingFlags,
      updatedAt: existingFlags.updatedAt.toISOString(),
    });
    expect(mockRequireAuth).toHaveBeenCalledOnce();
    expect(mockPrisma.featureFlag.findFirst).toHaveBeenCalledWith({
      select: CLIENT_FEATURE_FLAG_SELECT,
    });
    expect(CLIENT_FEATURE_FLAG_SELECT).toEqual({
      id: true,
      dialoguesEnabled: true,
      scriptsEnabled: true,
      audioCourseEnabled: true,
      flashcardsEnabled: true,
      updatedAt: true,
    });
  });

  it('creates and returns the client defaults when no row exists', async () => {
    mockPrisma.featureFlag.findFirst.mockResolvedValue(null);
    mockPrisma.featureFlag.create.mockResolvedValue({
      ...existingFlags,
      scriptsEnabled: true,
      flashcardsEnabled: true,
    });
    const app = await createApp();

    const response = await request(app).get('/feature-flags');

    expect(response.status).toBe(200);
    expect(mockPrisma.featureFlag.create).toHaveBeenCalledWith({
      data: DEFAULT_CLIENT_FEATURE_FLAGS,
      select: CLIENT_FEATURE_FLAG_SELECT,
    });
    expect(DEFAULT_CLIENT_FEATURE_FLAGS).toEqual({
      dialoguesEnabled: true,
      scriptsEnabled: true,
      audioCourseEnabled: true,
      flashcardsEnabled: true,
    });
  });

  it('does not create a second row when flags already exist', async () => {
    mockPrisma.featureFlag.findFirst.mockResolvedValue(existingFlags);
    const app = await createApp();

    await request(app).get('/feature-flags').expect(200);

    expect(mockPrisma.featureFlag.create).not.toHaveBeenCalled();
  });

  it('forwards lookup failures to the application error handler', async () => {
    mockPrisma.featureFlag.findFirst.mockRejectedValue(new Error('Database connection failed'));
    const app = await createApp();

    const response = await request(app).get('/feature-flags');

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: 'Database connection failed' });
    expect(mockPrisma.featureFlag.create).not.toHaveBeenCalled();
  });

  it('forwards default creation failures to the application error handler', async () => {
    mockPrisma.featureFlag.findFirst.mockResolvedValue(null);
    mockPrisma.featureFlag.create.mockRejectedValue(new Error('Unique constraint violation'));
    const app = await createApp();

    const response = await request(app).get('/feature-flags');

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: 'Unique constraint violation' });
  });
});
