import express, { json as expressJson, NextFunction, Response } from 'express';
import { verify as verifyJwt } from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthRequest } from '../../../middleware/auth.js';
import { CSRF_TOKEN_COOKIE_NAME } from '../../../middleware/csrf.js';
import { AppError, errorHandler } from '../../../middleware/errorHandler.js';
import authRouter from '../../../routes/auth.js';
import { getSetCookieArray, testCookieParser } from '../../helpers/testCookieParser.js';

const mocks = vi.hoisted(() => ({
  authenticateLearningOsAccount: vi.fn(),
  bcryptCompare: vi.fn(),
  getLearningOsCurrentAccount: vi.fn(),
  prismaFindUnique: vi.fn(),
  prismaUpdate: vi.fn(),
}));

vi.mock('bcrypt', () => ({
  default: {
    compare: mocks.bcryptCompare,
    hash: vi.fn(),
  },
}));
vi.mock('../../../config/passport.js', () => ({
  default: {
    authenticate: vi.fn(
      () => (_req: express.Request, _res: express.Response, next: NextFunction) => next()
    ),
  },
}));
vi.mock('../../../db/client.js', () => ({
  prisma: {
    user: {
      findUnique: mocks.prismaFindUnique,
      update: mocks.prismaUpdate,
      create: vi.fn(),
      delete: vi.fn(),
    },
    inviteCode: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));
vi.mock('../../../jobs/emailQueue.js', () => ({ emailQueue: { add: vi.fn() } }));
vi.mock('../../../middleware/auth.js', () => ({
  requireAuth: (req: AuthRequest, _res: Response, next: NextFunction) => {
    req.userId = '11111111-1111-4111-8111-111111111111';
    req.role = 'user';
    next();
  },
  AuthRequest: class {},
}));
vi.mock('../../../services/learningOsAuthProxy.js', () => ({
  authenticateLearningOsAccount: mocks.authenticateLearningOsAccount,
  getLearningOsCurrentAccount: mocks.getLearningOsCurrentAccount,
}));
vi.mock('../../../services/oauth.js', () => ({ revokeGoogleTokens: vi.fn() }));
vi.mock('../../../services/sampleContent.js', () => ({ copySampleContentToUser: vi.fn() }));
vi.mock('../../../services/usageTracker.js', () => ({
  checkGenerationLimit: vi.fn(),
  checkCooldown: vi.fn(),
}));

const loginAccount = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'learner@example.com',
  name: 'Learner',
  displayName: null,
  avatarColor: 'indigo',
  role: 'user',
  preferredStudyLanguage: 'ja',
  preferredNativeLanguage: 'en',
  proficiencyLevel: 'N3',
  onboardingCompleted: true,
  emailVerified: true,
  emailVerifiedAt: '2026-07-20T09:00:00.123Z',
  createdAt: '2026-07-20T10:00:00.123Z',
  updatedAt: '2026-07-20T11:00:00.456Z',
};

const currentAccount = {
  ...loginAccount,
  seenSampleContentGuide: true,
  seenCustomContentGuide: false,
};

describe('Auth Learning OS routing', () => {
  const originalAuthProxyEnabled = process.env.LEARNING_OS_AUTH_PROXY_ENABLED;
  let app: express.Application;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.LEARNING_OS_AUTH_PROXY_ENABLED = 'true';
    mocks.authenticateLearningOsAccount.mockResolvedValue(loginAccount);
    mocks.getLearningOsCurrentAccount.mockResolvedValue(currentAccount);

    app = express();
    app.use(testCookieParser);
    app.use(expressJson());
    app.use('/api/auth', authRouter);
    app.use(errorHandler);
  });

  afterAll(() => {
    if (originalAuthProxyEnabled === undefined) {
      delete process.env.LEARNING_OS_AUTH_PROXY_ENABLED;
    } else {
      process.env.LEARNING_OS_AUTH_PROXY_ENABLED = originalAuthProxyEnabled;
    }
  });

  it('uses Learning OS credentials while retaining the Convo Lab browser session', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: loginAccount.email, password: 'correct password' })
      .expect(200);

    expect(response.body).toEqual(loginAccount);
    expect(mocks.authenticateLearningOsAccount).toHaveBeenCalledWith(
      loginAccount.email,
      'correct password'
    );
    expect(mocks.prismaFindUnique).not.toHaveBeenCalled();

    const cookies = getSetCookieArray(response.headers['set-cookie']);
    const sessionCookie = cookies.find((cookie) => cookie.startsWith('token='));
    expect(sessionCookie).toBeDefined();
    const token = decodeURIComponent(sessionCookie!.split(';')[0].slice('token='.length));
    expect(verifyJwt(token, process.env.JWT_SECRET!)).toMatchObject({
      userId: loginAccount.id,
      role: loginAccount.role,
    });
    expect(cookies.some((cookie) => cookie.startsWith(`${CSRF_TOKEN_COOKIE_NAME}=`))).toBe(true);
  });

  it('loads current-user projection from Learning OS and refreshes CSRF state', async () => {
    const response = await request(app).get('/api/auth/me').expect(200);

    expect(response.body).toEqual(currentAccount);
    expect(mocks.getLearningOsCurrentAccount).toHaveBeenCalledWith(loginAccount.id);
    expect(mocks.prismaFindUnique).not.toHaveBeenCalled();
    expect(
      getSetCookieArray(response.headers['set-cookie']).some((cookie) =>
        cookie.startsWith(`${CSRF_TOKEN_COOKIE_NAME}=`)
      )
    ).toBe(true);
  });

  it('keeps malformed credentials out of the upstream service', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: ['learner@example.com'], password: 'password' })
      .expect(400);

    expect(response.body.error.message).toBe('Email and password are required');
    expect(mocks.authenticateLearningOsAccount).not.toHaveBeenCalled();
  });

  it('passes controlled proxy failures through the normal API error envelope', async () => {
    mocks.authenticateLearningOsAccount.mockRejectedValue(
      new AppError('Learning OS Auth API is unavailable.', 502)
    );

    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: loginAccount.email, password: 'password' })
      .expect(502);

    expect(response.body).toEqual({
      error: { message: 'Learning OS Auth API is unavailable.', statusCode: 502 },
    });
  });

  it('keeps the local credential implementation available when the flag is disabled', async () => {
    process.env.LEARNING_OS_AUTH_PROXY_ENABLED = 'false';
    mocks.prismaFindUnique.mockResolvedValue({ ...loginAccount, password: 'legacy-hash' });
    mocks.bcryptCompare.mockResolvedValue(true);

    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: loginAccount.email, password: 'legacy password' })
      .expect(200);

    expect(response.body).toEqual(loginAccount);
    expect(mocks.prismaFindUnique).toHaveBeenCalledWith({ where: { email: loginAccount.email } });
    expect(mocks.bcryptCompare).toHaveBeenCalledWith('legacy password', 'legacy-hash');
    expect(mocks.authenticateLearningOsAccount).not.toHaveBeenCalled();
  });

  it('rate limits repeated login attempts before they reach Learning OS', async () => {
    let limitedResponse: request.Response | undefined;

    for (let attempt = 0; attempt < 35; attempt += 1) {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: loginAccount.email, password: 'wrong password' });
      if (response.status === 429) {
        limitedResponse = response;
        break;
      }
    }

    expect(limitedResponse?.status).toBe(429);
    expect(limitedResponse?.headers['ratelimit-policy']).toBeDefined();
    expect(mocks.authenticateLearningOsAccount.mock.calls.length).toBeLessThan(35);

    mocks.authenticateLearningOsAccount.mockClear();
    await request(app)
      .post('/api/auth/login')
      .send({ email: 'another-user@example.com', password: 'password' })
      .expect(200);
    expect(mocks.authenticateLearningOsAccount).toHaveBeenCalledOnce();
  });
});
