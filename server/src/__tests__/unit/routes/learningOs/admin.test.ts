/* eslint-disable import/no-named-as-default-member */
import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppError, errorHandler } from '../../../../middleware/errorHandler.js';
import {
  createLearningOsAdminInviteCode,
  deleteLearningOsAdminInviteCode,
  deleteLearningOsAdminUser,
  listLearningOsAdminInviteCodes,
  listLearningOsAdminUsers,
  showLearningOsAdminStats,
  showLearningOsAdminUser,
} from '../../../../routes/learningOs/admin.js';

const mocks = vi.hoisted(() => ({
  fetchLearningOsProxy: vi.fn(),
  resolveLearningOsServiceProxyContext: vi.fn(),
  resolveLearningOsUserProxyContext: vi.fn(),
  userDeleteMany: vi.fn(),
  inviteDeleteMany: vi.fn(),
  inviteFindUnique: vi.fn(),
  inviteUpsert: vi.fn(),
}));

vi.mock('../../../../services/learningOsProxy.js', () => ({
  fetchLearningOsProxy: mocks.fetchLearningOsProxy,
  resolveLearningOsServiceProxyContext: mocks.resolveLearningOsServiceProxyContext,
  resolveLearningOsUserProxyContext: mocks.resolveLearningOsUserProxyContext,
}));
vi.mock('../../../../db/client.js', () => ({
  prisma: {
    user: { deleteMany: mocks.userDeleteMany },
    inviteCode: {
      deleteMany: mocks.inviteDeleteMany,
      findUnique: mocks.inviteFindUnique,
      upsert: mocks.inviteUpsert,
    },
  },
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

describe('Learning OS admin proxy', () => {
  let app: express.Application;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveLearningOsServiceProxyContext.mockResolvedValue({
      config: { apiUrl: 'http://learning-os.test', apiToken: 'proxy-token' },
      user: { id: 'proxy-user', email: 'admin@example.com', role: 'admin' },
    });
    mocks.resolveLearningOsUserProxyContext.mockResolvedValue({
      config: { apiUrl: 'http://learning-os.test', apiToken: 'proxy-token' },
      user: { id: USER_ID, email: 'admin@example.com', role: 'admin' },
    });
    mocks.userDeleteMany.mockResolvedValue({ count: 1 });
    mocks.inviteDeleteMany.mockResolvedValue({ count: 1 });
    mocks.inviteFindUnique.mockResolvedValue(null);
    mocks.inviteUpsert.mockImplementation(async ({ create }) => create);

    app = express();
    app.use(express.json());
    app.get('/stats', showLearningOsAdminStats);
    app.get('/users', listLearningOsAdminUsers);
    app.get('/users/:id/info', showLearningOsAdminUser);
    app.get('/invite-codes', listLearningOsAdminInviteCodes);
    app.delete('/users/:id', (req, res, next) => {
      Object.assign(req, {
        userId: USER_ID,
        email: 'admin@example.com',
        role: 'admin',
        accountSource: 'learning-os',
      });
      void deleteLearningOsAdminUser(req, res, next);
    });
    app.post('/invite-codes', (req, res, next) => {
      Object.assign(req, {
        userId: USER_ID,
        email: 'admin@example.com',
        role: 'admin',
        accountSource: 'learning-os',
      });
      void createLearningOsAdminInviteCode(req, res, next);
    });
    app.delete('/invite-codes/:id', (req, res, next) => {
      Object.assign(req, {
        userId: USER_ID,
        email: 'admin@example.com',
        role: 'admin',
        accountSource: 'learning-os',
      });
      void deleteLearningOsAdminInviteCode(req, res, next);
    });
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

  it('collects every invite page when the legacy caller does not request pagination', async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) => ({
      ...invite,
      id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    }));
    const secondInvite = { ...invite, id: '33333333-3333-4333-8333-333333333333' };
    mocks.fetchLearningOsProxy
      .mockResolvedValueOnce(
        upstreamJson(firstPage, 200, {
          'X-Pagination-Page': '1',
          'X-Pagination-Limit': '100',
          'X-Pagination-Total': '101',
          'X-Pagination-Pages': '2',
        })
      )
      .mockResolvedValueOnce(
        upstreamJson([secondInvite], 200, {
          'X-Pagination-Page': '2',
          'X-Pagination-Limit': '100',
          'X-Pagination-Total': '101',
          'X-Pagination-Pages': '2',
        })
      );

    const response = await request(app).get('/invite-codes').expect(200);

    expect(response.body).toEqual([...firstPage, secondInvite]);
    expect(response.headers['x-pagination-page']).toBeUndefined();
    expect(mocks.fetchLearningOsProxy).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        upstreamUrl: new URL(
          'http://learning-os.test/api/convolab/admin/invite-codes?page=1&limit=100'
        ),
      })
    );
    expect(mocks.fetchLearningOsProxy).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        upstreamUrl: new URL(
          'http://learning-os.test/api/convolab/admin/invite-codes?page=2&limit=100'
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

  it('deletes the canonical user, then idempotently cleans the local projection', async () => {
    mocks.fetchLearningOsProxy.mockResolvedValue(
      upstreamJson({ message: 'User deleted successfully' })
    );

    const response = await request(app).delete(`/users/${USER_ID}`).expect(200);

    expect(response.body).toEqual({ message: 'User deleted successfully' });
    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(mocks.resolveLearningOsUserProxyContext).toHaveBeenCalledWith(
      USER_ID,
      'Learning OS Admin API',
      {
        userId: USER_ID,
        email: 'admin@example.com',
        role: 'admin',
        accountSource: 'learning-os',
      }
    );
    expect(mocks.fetchLearningOsProxy).toHaveBeenCalledWith(
      expect.objectContaining({
        upstreamUrl: new URL(`http://learning-os.test/api/convolab/admin/users/${USER_ID}`),
        user: { id: USER_ID, email: 'admin@example.com', role: 'admin' },
        method: 'DELETE',
      })
    );
    expect(mocks.userDeleteMany).toHaveBeenCalledWith({ where: { id: USER_ID } });
  });

  it('finishes local user cleanup when the canonical retry returns 404', async () => {
    mocks.fetchLearningOsProxy.mockResolvedValue(upstreamJson({ message: 'User not found' }, 404));

    await request(app).delete(`/users/${USER_ID}`).expect(200);

    expect(mocks.userDeleteMany).toHaveBeenCalledOnce();
  });

  it('preserves user-not-found when neither canonical nor local state exists', async () => {
    mocks.fetchLearningOsProxy.mockResolvedValue(upstreamJson({ message: 'User not found' }, 404));
    mocks.userDeleteMany.mockResolvedValue({ count: 0 });

    const response = await request(app).delete(`/users/${USER_ID}`).expect(404);

    expect(response.body.error.message).toBe('User not found');
  });

  it('rejects malformed mutation IDs before contacting Learning OS', async () => {
    const userResponse = await request(app).delete('/users/not-a-uuid').expect(404);
    const inviteResponse = await request(app).delete('/invite-codes/not-a-uuid').expect(404);

    expect(userResponse.body.error.message).toBe('User not found');
    expect(inviteResponse.body.error.message).toBe('Invite code not found');
    expect(mocks.fetchLearningOsProxy).not.toHaveBeenCalled();
    expect(mocks.userDeleteMany).not.toHaveBeenCalled();
    expect(mocks.inviteDeleteMany).not.toHaveBeenCalled();
  });

  it.each([
    [400, 'Cannot delete your own account'],
    [403, 'Cannot delete admin users'],
  ])('preserves allowlisted user deletion error %s', async (status, message) => {
    mocks.fetchLearningOsProxy.mockResolvedValue(upstreamJson({ message }, status));

    const response = await request(app).delete(`/users/${USER_ID}`).expect(status);

    expect(response.body.error.message).toBe(message);
    expect(mocks.userDeleteMany).not.toHaveBeenCalled();
  });

  it('creates an invite canonically and mirrors its exact identity locally', async () => {
    const created = {
      id: INVITE_ID,
      code: 'CUSTOM12',
      usedBy: null,
      usedAt: null,
      createdAt: '2026-07-22T08:00:00.123Z',
    };
    mocks.fetchLearningOsProxy.mockResolvedValue(upstreamJson(created));

    const response = await request(app)
      .post('/invite-codes')
      .send({ customCode: 'CUSTOM12' })
      .expect(200);

    expect(response.body).toMatchObject({ id: INVITE_ID, code: 'CUSTOM12' });
    expect(mocks.fetchLearningOsProxy).toHaveBeenCalledWith(
      expect.objectContaining({
        upstreamUrl: new URL('http://learning-os.test/api/convolab/admin/invite-codes'),
        method: 'POST',
        body: { customCode: 'CUSTOM12' },
      })
    );
    expect(mocks.inviteUpsert).toHaveBeenCalledWith({
      where: { id: INVITE_ID },
      create: {
        id: INVITE_ID,
        code: 'CUSTOM12',
        usedBy: null,
        usedAt: null,
        createdAt: new Date(created.createdAt),
      },
      update: {
        code: 'CUSTOM12',
        usedBy: null,
        usedAt: null,
        createdAt: new Date(created.createdAt),
      },
    });
  });

  it('creates a generated invite when customCode is omitted', async () => {
    const created = {
      id: INVITE_ID,
      code: 'A1B2C3D4',
      usedBy: null,
      usedAt: null,
      createdAt: '2026-07-22T08:00:00.123Z',
    };
    mocks.fetchLearningOsProxy.mockResolvedValue(upstreamJson(created));

    await request(app).post('/invite-codes').send({}).expect(200);

    expect(mocks.fetchLearningOsProxy).toHaveBeenCalledWith(expect.objectContaining({ body: {} }));
    expect(mocks.inviteUpsert).toHaveBeenCalledOnce();
  });

  it('rejects a custom code already present in the local compatibility projection', async () => {
    mocks.inviteFindUnique.mockResolvedValue({ id: 'legacy-invite', code: 'CUSTOM12' });

    const response = await request(app)
      .post('/invite-codes')
      .send({ customCode: 'CUSTOM12' })
      .expect(400);

    expect(response.body.error.message).toBe('This code already exists');
    expect(mocks.fetchLearningOsProxy).not.toHaveBeenCalled();
    expect(mocks.inviteUpsert).not.toHaveBeenCalled();
  });

  it('rolls back a canonical invite after a raced local code collision', async () => {
    const created = {
      id: INVITE_ID,
      code: 'CUSTOM12',
      usedBy: null,
      usedAt: null,
      createdAt: '2026-07-22T08:00:00.123Z',
    };
    mocks.fetchLearningOsProxy
      .mockResolvedValueOnce(upstreamJson(created))
      .mockResolvedValueOnce(upstreamJson({ message: 'Invite code deleted successfully' }));
    mocks.inviteUpsert.mockRejectedValue({
      name: 'PrismaClientKnownRequestError',
      code: 'P2002',
    });

    const response = await request(app)
      .post('/invite-codes')
      .send({ customCode: 'CUSTOM12' })
      .expect(400);

    expect(response.body.error.message).toBe('This code already exists');
    expect(mocks.fetchLearningOsProxy).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        upstreamUrl: new URL(
          `http://learning-os.test/api/convolab/admin/invite-codes/${INVITE_ID}`
        ),
        method: 'DELETE',
      })
    );
  });

  it('rolls back a created invite when the remaining upstream payload is malformed', async () => {
    mocks.fetchLearningOsProxy
      .mockResolvedValueOnce(
        upstreamJson({
          id: INVITE_ID,
          code: '',
          usedBy: null,
          usedAt: null,
          createdAt: 'not-a-timestamp',
        })
      )
      .mockResolvedValueOnce(upstreamJson({ message: 'Invite code deleted successfully' }));

    const response = await request(app).post('/invite-codes').send({}).expect(502);

    expect(response.body.error.message).toBe('Learning OS Admin API returned an invalid response.');
    expect(mocks.fetchLearningOsProxy).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        upstreamUrl: new URL(
          `http://learning-os.test/api/convolab/admin/invite-codes/${INVITE_ID}`
        ),
        method: 'DELETE',
      })
    );
    expect(mocks.inviteUpsert).not.toHaveBeenCalled();
  });

  it.each([null, '', 'short', 'BAD-CODE', ['CUSTOM12']])(
    'rejects malformed custom code %j without calling upstream',
    async (customCode) => {
      const response = await request(app).post('/invite-codes').send({ customCode }).expect(400);

      expect(response.body.error.message).toBe('Custom code must be 6-20 alphanumeric characters');
      expect(mocks.fetchLearningOsProxy).not.toHaveBeenCalled();
    }
  );

  it('deletes an invite canonically and supports local-cleanup retry', async () => {
    mocks.fetchLearningOsProxy.mockResolvedValue(
      upstreamJson({ message: 'Invite code deleted successfully' })
    );

    await request(app).delete(`/invite-codes/${INVITE_ID}`).expect(200);

    expect(mocks.inviteDeleteMany).toHaveBeenCalledWith({ where: { id: INVITE_ID } });

    mocks.fetchLearningOsProxy.mockResolvedValue(
      upstreamJson({ message: 'Invite code not found' }, 404)
    );
    await request(app).delete(`/invite-codes/${INVITE_ID}`).expect(200);
  });

  it('does not clean local projections after malformed successful delete responses', async () => {
    mocks.fetchLearningOsProxy.mockResolvedValue(upstreamJson({ message: 'unexpected success' }));

    await request(app).delete(`/users/${USER_ID}`).expect(502);
    await request(app).delete(`/invite-codes/${INVITE_ID}`).expect(502);

    expect(mocks.userDeleteMany).not.toHaveBeenCalled();
    expect(mocks.inviteDeleteMany).not.toHaveBeenCalled();
  });

  it('preserves used-invite and rate-limit responses without local cleanup', async () => {
    mocks.fetchLearningOsProxy
      .mockResolvedValueOnce(upstreamJson({ message: 'Cannot delete used invite codes' }, 400))
      .mockResolvedValueOnce(
        upstreamJson({ message: 'Too Many Attempts.' }, 429, { 'Retry-After': '17' })
      );

    const used = await request(app).delete(`/invite-codes/${INVITE_ID}`).expect(400);
    expect(used.body.error.message).toBe('Cannot delete used invite codes');

    const limited = await request(app).delete(`/invite-codes/${INVITE_ID}`).expect(429);
    expect(limited.body.error.message).toBe('Too many admin mutation attempts.');
    expect(limited.headers['retry-after']).toBe('17');
    expect(mocks.inviteDeleteMany).not.toHaveBeenCalled();
  });

  it('does not forward an out-of-range admin mutation cooldown', async () => {
    mocks.fetchLearningOsProxy.mockResolvedValue(
      upstreamJson({ message: 'Too Many Attempts.' }, 429, { 'Retry-After': '9999' })
    );

    const response = await request(app).delete(`/invite-codes/${INVITE_ID}`).expect(429);

    expect(response.body.error.message).toBe('Too many admin mutation attempts.');
    expect(response.headers['retry-after']).toBeUndefined();
    expect(mocks.inviteDeleteMany).not.toHaveBeenCalled();
  });
});
