/* eslint-disable import/no-named-as-default-member */
import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppError, errorHandler } from '../../../../middleware/errorHandler.js';
import {
  listLearningOsAdminInviteCodes,
  listLearningOsAdminUsers,
  showLearningOsAdminStats,
  showLearningOsAdminUser,
} from '../../../../routes/learningOs/admin.js';

const mocks = vi.hoisted(() => ({
  fetchLearningOsProxy: vi.fn(),
  resolveLearningOsServiceProxyContext: vi.fn(),
}));

vi.mock('../../../../services/learningOsProxy.js', () => ({
  fetchLearningOsProxy: mocks.fetchLearningOsProxy,
  resolveLearningOsServiceProxyContext: mocks.resolveLearningOsServiceProxyContext,
}));

const USER_ID = '11111111-1111-4111-8111-111111111111';
const INVITE_ID = '22222222-2222-4222-8222-222222222222';
const user = {
  id: USER_ID,
  email: 'admin@example.com',
  name: 'Admin User',
  displayName: 'Admin',
  avatarColor: 'teal',
  avatarUrl: null,
  role: 'admin',
  createdAt: '2026-07-20T10:00:00.123Z',
  updatedAt: '2026-07-21T10:00:00.456Z',
  _count: { episodes: 3, courses: 2 },
};
const userInfo = {
  id: USER_ID,
  email: 'admin@example.com',
  name: 'Admin User',
  displayName: 'Admin',
  role: 'admin',
  avatarColor: 'teal',
  avatarUrl: null,
  preferredStudyLanguage: 'ja',
  preferredNativeLanguage: 'en',
  onboardingCompleted: true,
};
const invite = {
  id: INVITE_ID,
  code: 'INVITE12',
  usedBy: USER_ID,
  usedAt: '2026-07-21T11:00:00.123Z',
  createdAt: '2026-07-20T11:00:00.123Z',
  user: { id: USER_ID, email: 'admin@example.com', name: 'Admin User' },
};

const upstreamJson = (
  body: unknown,
  status = 200,
  headers: Record<string, string> = {}
): globalThis.Response =>
  new globalThis.Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });

describe('Learning OS admin read proxy', () => {
  let app: express.Application;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveLearningOsServiceProxyContext.mockResolvedValue({
      config: { apiUrl: 'http://learning-os.test', apiToken: 'proxy-token' },
      user: { id: 'proxy-user', email: 'admin@example.com', role: 'admin' },
    });

    app = express();
    app.get('/stats', showLearningOsAdminStats);
    app.get('/users', listLearningOsAdminUsers);
    app.get('/users/:id/info', showLearningOsAdminUser);
    app.get('/invite-codes', listLearningOsAdminInviteCodes);
    app.use(errorHandler);
  });

  it('proxies stats through the service identity and disables caching', async () => {
    const stats = {
      users: 4,
      episodes: 8,
      courses: 2,
      inviteCodes: { total: 5, used: 3, available: 2 },
    };
    mocks.fetchLearningOsProxy.mockResolvedValue(upstreamJson(stats));

    const response = await request(app).get('/stats').expect(200);

    expect(response.body).toEqual(stats);
    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(mocks.resolveLearningOsServiceProxyContext).toHaveBeenCalledWith(
      'Learning OS Admin API'
    );
    expect(mocks.fetchLearningOsProxy).toHaveBeenCalledWith(
      expect.objectContaining({
        upstreamUrl: new URL('http://learning-os.test/api/convolab/admin/stats'),
        apiToken: 'proxy-token',
        method: 'GET',
        timeoutMs: 10_000,
      })
    );
  });

  it('forwards only supported user-list query parameters and preserves the contract', async () => {
    const payload = {
      users: [user],
      pagination: { page: 2, limit: 25, total: 26, pages: 2 },
    };
    mocks.fetchLearningOsProxy.mockResolvedValue(upstreamJson(payload));

    const response = await request(app)
      .get('/users?page=2&limit=25&search=Admin%20User&ignored=value')
      .expect(200);

    expect(response.body).toEqual(payload);
    expect(mocks.fetchLearningOsProxy).toHaveBeenCalledWith(
      expect.objectContaining({
        upstreamUrl: new URL(
          'http://learning-os.test/api/convolab/admin/users?page=2&limit=25&search=Admin+User'
        ),
      })
    );
  });

  it('encodes user IDs and preserves a valid user-info response', async () => {
    mocks.fetchLearningOsProxy.mockResolvedValue(upstreamJson(userInfo));

    const response = await request(app).get(`/users/${USER_ID}/info`).expect(200);

    expect(response.body).toEqual(userInfo);
    expect(mocks.fetchLearningOsProxy).toHaveBeenCalledWith(
      expect.objectContaining({
        upstreamUrl: new URL(`http://learning-os.test/api/convolab/admin/users/${USER_ID}/info`),
      })
    );
  });

  it('preserves the invite array and validated pagination headers', async () => {
    mocks.fetchLearningOsProxy.mockResolvedValue(
      upstreamJson([invite], 200, {
        'X-Pagination-Page': '2',
        'X-Pagination-Limit': '50',
        'X-Pagination-Total': '51',
        'X-Pagination-Pages': '2',
      })
    );

    const response = await request(app).get('/invite-codes?page=2&limit=50&ignored=x').expect(200);

    expect(response.body).toEqual([invite]);
    expect(response.headers['x-pagination-page']).toBe('2');
    expect(response.headers['x-pagination-limit']).toBe('50');
    expect(response.headers['x-pagination-total']).toBe('51');
    expect(response.headers['x-pagination-pages']).toBe('2');
    expect(mocks.fetchLearningOsProxy).toHaveBeenCalledWith(
      expect.objectContaining({
        upstreamUrl: new URL(
          'http://learning-os.test/api/convolab/admin/invite-codes?page=2&limit=50'
        ),
      })
    );
  });

  it.each([
    [
      '/stats',
      { users: 1, episodes: 0, courses: 0, inviteCodes: { total: 1, used: 1, available: 1 } },
    ],
    [
      '/users',
      {
        users: [{ ...user, _count: { episodes: -1, courses: 0 } }],
        pagination: { page: 1, limit: 50, total: 1, pages: 1 },
      },
    ],
    [
      '/users',
      {
        users: [],
        pagination: { page: 2, limit: 50, total: 1, pages: 1 },
      },
    ],
    [`/users/${USER_ID}/info`, { ...userInfo, onboardingCompleted: 'yes' }],
    ['/invite-codes', [{ ...invite, usedBy: null }]],
  ])('rejects malformed upstream shape for %s', async (path, payload) => {
    mocks.fetchLearningOsProxy.mockResolvedValue(
      upstreamJson(payload, 200, {
        'X-Pagination-Page': '1',
        'X-Pagination-Limit': '100',
        'X-Pagination-Total': '1',
        'X-Pagination-Pages': '1',
      })
    );

    const response = await request(app).get(path).expect(502);

    expect(response.body.error.message).toBe('Learning OS Admin API returned an invalid response.');
  });

  it('rejects invite responses with missing, malformed, or inconsistent pagination headers', async () => {
    mocks.fetchLearningOsProxy
      .mockResolvedValueOnce(upstreamJson([invite]))
      .mockResolvedValueOnce(
        upstreamJson([invite], 200, {
          'X-Pagination-Page': 'one',
          'X-Pagination-Limit': '100',
          'X-Pagination-Total': '1',
          'X-Pagination-Pages': '1',
        })
      )
      .mockResolvedValueOnce(
        upstreamJson([invite], 200, {
          'X-Pagination-Page': '1',
          'X-Pagination-Limit': '100',
          'X-Pagination-Total': '101',
          'X-Pagination-Pages': '1',
        })
      )
      .mockResolvedValueOnce(
        upstreamJson([invite], 200, {
          'X-Pagination-Page': '2',
          'X-Pagination-Limit': '100',
          'X-Pagination-Total': '1',
          'X-Pagination-Pages': '1',
        })
      );

    await request(app).get('/invite-codes').expect(502);
    await request(app).get('/invite-codes').expect(502);
    await request(app).get('/invite-codes').expect(502);
    await request(app).get('/invite-codes').expect(502);
  });

  it.each([
    [401, 502],
    [403, 502],
    [500, 502],
    [404, 404],
    [422, 422],
  ])(
    'maps upstream HTTP %s to client HTTP %s without leaking details',
    async (upstream, client) => {
      mocks.fetchLearningOsProxy.mockResolvedValue(
        upstreamJson({ message: 'private upstream details' }, upstream)
      );

      const response = await request(app).get('/stats').expect(client);

      expect(response.body.error.message).toBe('Learning OS Admin API request failed.');
      expect(JSON.stringify(response.body)).not.toContain('private upstream details');
    }
  );

  it('returns controlled errors for invalid JSON and transport failures', async () => {
    mocks.fetchLearningOsProxy
      .mockResolvedValueOnce(
        new globalThis.Response('not-json', {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      .mockRejectedValueOnce(new AppError('Learning OS Admin API is unavailable.', 502));

    const invalidJson = await request(app).get('/stats').expect(502);
    expect(invalidJson.body.error.message).toBe(
      'Learning OS Admin API returned an invalid JSON response.'
    );

    const unavailable = await request(app).get('/stats').expect(502);
    expect(unavailable.body.error.message).toBe('Learning OS Admin API is unavailable.');
  });
});
