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
  bcryptHash: vi.fn(),
  changeLearningOsCurrentPassword: vi.fn(),
  getLearningOsCurrentAccount: vi.fn(),
  registerLearningOsAccount: vi.fn(),
  updateLearningOsCurrentAccount: vi.fn(),
  copySampleContentToUser: vi.fn(),
  prismaFindUnique: vi.fn(),
  prismaUpdate: vi.fn(),
}));

vi.mock('bcrypt', () => ({
  default: {
    compare: mocks.bcryptCompare,
    hash: mocks.bcryptHash,
  },
}));
vi.mock('../../../i18n/index.js', () => ({
  default: {
    t: (key: string) =>
      ({
        'server:auth.emailRequired': 'Email, password, and name are required',
        'server:auth.inviteRequired': 'Invite code is required',
      })[key] ?? key,
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
    req.userId =
      (typeof req.headers['x-test-user-id'] === 'string' && req.headers['x-test-user-id']) ||
      '11111111-1111-4111-8111-111111111111';
    req.role = 'user';
    req.email = 'learner@example.com';
    req.accountSource = 'learning-os';
    next();
  },
  AuthRequest: class {},
}));
vi.mock('../../../services/learningOsAuthProxy.js', () => ({
  authenticateLearningOsAccount: mocks.authenticateLearningOsAccount,
  changeLearningOsCurrentPassword: mocks.changeLearningOsCurrentPassword,
  getLearningOsCurrentAccount: mocks.getLearningOsCurrentAccount,
  registerLearningOsAccount: mocks.registerLearningOsAccount,
  updateLearningOsCurrentAccount: mocks.updateLearningOsCurrentAccount,
}));
vi.mock('../../../services/oauth.js', () => ({ revokeGoogleTokens: vi.fn() }));
vi.mock('../../../services/sampleContent.js', () => ({
  copySampleContentToUser: mocks.copySampleContentToUser,
}));
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
  const originalSignupProxyEnabled = process.env.LEARNING_OS_SIGNUP_PROXY_ENABLED;
  const originalProfileProxyEnabled = process.env.LEARNING_OS_PROFILE_PROXY_ENABLED;
  let app: express.Application;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.LEARNING_OS_AUTH_PROXY_ENABLED = 'true';
    process.env.LEARNING_OS_SIGNUP_PROXY_ENABLED = 'true';
    process.env.LEARNING_OS_PROFILE_PROXY_ENABLED = 'true';
    mocks.authenticateLearningOsAccount.mockResolvedValue(loginAccount);
    mocks.changeLearningOsCurrentPassword.mockResolvedValue(undefined);
    mocks.getLearningOsCurrentAccount.mockResolvedValue(currentAccount);
    mocks.registerLearningOsAccount.mockResolvedValue({ ...loginAccount, emailVerified: false });
    mocks.updateLearningOsCurrentAccount.mockResolvedValue(currentAccount);
    mocks.prismaFindUnique.mockResolvedValue({ id: loginAccount.id });

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
    if (originalSignupProxyEnabled === undefined) {
      delete process.env.LEARNING_OS_SIGNUP_PROXY_ENABLED;
    } else {
      process.env.LEARNING_OS_SIGNUP_PROXY_ENABLED = originalSignupProxyEnabled;
    }
    if (originalProfileProxyEnabled === undefined) {
      delete process.env.LEARNING_OS_PROFILE_PROXY_ENABLED;
    } else {
      process.env.LEARNING_OS_PROFILE_PROXY_ENABLED = originalProfileProxyEnabled;
    }
  });

  it('creates a Learning OS account and retains the Convo Lab browser session', async () => {
    const signupAccount = { ...loginAccount, emailVerified: false, emailVerifiedAt: null };
    mocks.registerLearningOsAccount.mockResolvedValue(signupAccount);

    const response = await request(app)
      .post('/api/auth/signup')
      .send({
        email: signupAccount.email,
        password: 'correct password',
        name: signupAccount.name,
        inviteCode: 'WELCOME1',
      })
      .expect(200);

    expect(response.body).toEqual(signupAccount);
    expect(response.headers['ratelimit-policy']).toBeDefined();
    expect(mocks.registerLearningOsAccount).toHaveBeenCalledWith({
      email: signupAccount.email,
      password: 'correct password',
      name: signupAccount.name,
      inviteCode: 'WELCOME1',
    });
    expect(mocks.prismaFindUnique).not.toHaveBeenCalled();

    const cookies = getSetCookieArray(response.headers['set-cookie']);
    const sessionCookie = cookies.find((cookie) => cookie.startsWith('token='));
    const token = decodeURIComponent(sessionCookie!.split(';')[0].slice('token='.length));
    expect(verifyJwt(token, process.env.JWT_SECRET!)).toMatchObject({
      userId: signupAccount.id,
      email: signupAccount.email,
      role: signupAccount.role,
      accountSource: 'learning-os',
    });
    expect(cookies.some((cookie) => cookie.startsWith(`${CSRF_TOKEN_COOKIE_NAME}=`))).toBe(true);
  });

  it('rejects malformed signup bodies before forwarding credentials', async () => {
    const response = await request(app)
      .post('/api/auth/signup')
      .send({ email: ['learner@example.com'], password: 'password', name: 'Learner' })
      .expect(400);

    expect(response.body.error.message).toBe('Email, password, and name are required');
    expect(mocks.registerLearningOsAccount).not.toHaveBeenCalled();
  });

  it('normalizes signup identity fields before forwarding credentials', async () => {
    await request(app)
      .post('/api/auth/signup')
      .send({
        email: `  ${loginAccount.email} `,
        password: 'correct password',
        name: ` ${loginAccount.name} `,
        inviteCode: ' WELCOME1 ',
      })
      .expect(200);

    expect(mocks.registerLearningOsAccount).toHaveBeenCalledWith({
      email: loginAccount.email,
      password: 'correct password',
      name: loginAccount.name,
      inviteCode: 'WELCOME1',
    });
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
    expect(mocks.prismaFindUnique).toHaveBeenCalledWith({
      where: { id: loginAccount.id },
      select: { id: true },
    });

    const cookies = getSetCookieArray(response.headers['set-cookie']);
    const sessionCookie = cookies.find((cookie) => cookie.startsWith('token='));
    expect(sessionCookie).toBeDefined();
    const token = decodeURIComponent(sessionCookie!.split(';')[0].slice('token='.length));
    expect(verifyJwt(token, process.env.JWT_SECRET!)).toMatchObject({
      userId: loginAccount.id,
      email: loginAccount.email,
      role: loginAccount.role,
    });
    expect(verifyJwt(token, process.env.JWT_SECRET!)).not.toHaveProperty('accountSource');
    expect(cookies.some((cookie) => cookie.startsWith(`${CSRF_TOKEN_COOKIE_NAME}=`))).toBe(true);
  });

  it('loads current-user projection from Learning OS and refreshes CSRF state', async () => {
    const response = await request(app).get('/api/auth/me').expect(200);

    expect(response.body).toEqual(currentAccount);
    expect(mocks.getLearningOsCurrentAccount).toHaveBeenCalledWith(loginAccount.id, {
      userId: loginAccount.id,
      email: loginAccount.email,
      role: loginAccount.role,
      accountSource: 'learning-os',
    });
    expect(mocks.prismaFindUnique).not.toHaveBeenCalled();
    expect(
      getSetCookieArray(response.headers['set-cookie']).some((cookie) =>
        cookie.startsWith(`${CSRF_TOKEN_COOKIE_NAME}=`)
      )
    ).toBe(true);
  });

  it('updates profile through Learning OS without invoking legacy persistence or sample copy', async () => {
    const payload = {
      displayName: 'Ada',
      avatarColor: 'teal',
      avatarUrl: 'https://example.com/avatar.png',
      preferredStudyLanguage: 'ja',
      preferredNativeLanguage: 'en',
      proficiencyLevel: 'N3',
      onboardingCompleted: true,
      seenSampleContentGuide: true,
      seenCustomContentGuide: false,
      ignored: 'server-owned',
    };

    const response = await request(app).patch('/api/auth/me').send(payload).expect(200);

    expect(response.body).toEqual(currentAccount);
    expect(mocks.updateLearningOsCurrentAccount).toHaveBeenCalledWith(
      loginAccount.id,
      {
        displayName: 'Ada',
        avatarColor: 'teal',
        avatarUrl: 'https://example.com/avatar.png',
        preferredStudyLanguage: 'ja',
        preferredNativeLanguage: 'en',
        proficiencyLevel: 'N3',
        onboardingCompleted: true,
        seenSampleContentGuide: true,
        seenCustomContentGuide: false,
      },
      {
        userId: loginAccount.id,
        email: loginAccount.email,
        role: loginAccount.role,
        accountSource: 'learning-os',
      }
    );
    expect(mocks.prismaUpdate).not.toHaveBeenCalled();
    expect(mocks.copySampleContentToUser).not.toHaveBeenCalled();
  });

  it('changes the current password through Learning OS without touching legacy credentials', async () => {
    const response = await request(app)
      .patch('/api/auth/change-password')
      .send({ currentPassword: 'old-password123', newPassword: 'new-password123' })
      .expect(200);

    expect(response.body).toEqual({ message: 'server:auth.passwordChanged' });
    expect(mocks.changeLearningOsCurrentPassword).toHaveBeenCalledWith(
      loginAccount.id,
      { currentPassword: 'old-password123', newPassword: 'new-password123' },
      {
        userId: loginAccount.id,
        email: loginAccount.email,
        role: loginAccount.role,
        accountSource: 'learning-os',
      }
    );
    expect(mocks.prismaFindUnique).not.toHaveBeenCalled();
    expect(mocks.prismaUpdate).not.toHaveBeenCalled();
    expect(mocks.bcryptCompare).not.toHaveBeenCalled();
    expect(mocks.bcryptHash).not.toHaveBeenCalled();
  });

  it.each([
    ['incorrect current password', new AppError('Current password is incorrect', 401), 401],
    [
      'upstream rate limit',
      new AppError('Too many password change attempts.', 429, {
        cooldown: { remainingSeconds: 17 },
      }),
      429,
    ],
  ] as const)('returns the normal API envelope for %s', async (_label, error, status) => {
    mocks.changeLearningOsCurrentPassword.mockRejectedValueOnce(error);

    const response = await request(app)
      .patch('/api/auth/change-password')
      .send({ currentPassword: 'old-password123', newPassword: 'new-password123' })
      .expect(status);

    expect(response.body.error).toMatchObject({ message: error.message, statusCode: status });
    if (status === 429) {
      expect(response.headers['retry-after']).toBe('17');
    }
  });

  it('rate limits password changes per user before forwarding credentials', async () => {
    const limitedUserId = '22222222-2222-4222-8222-222222222222';
    const otherUserId = '33333333-3333-4333-8333-333333333333';
    const payload = { currentPassword: 'old-password123', newPassword: 'new-password123' };

    for (let attempt = 0; attempt < 30; attempt += 1) {
      await request(app)
        .patch('/api/auth/change-password')
        .set('X-Test-User-Id', limitedUserId)
        .send(payload)
        .expect(200);
    }

    await request(app)
      .patch('/api/auth/change-password')
      .set('X-Test-User-Id', limitedUserId)
      .send(payload)
      .expect(429);
    await request(app)
      .patch('/api/auth/change-password')
      .set('X-Test-User-Id', otherUserId)
      .send(payload)
      .expect(200);

    expect(mocks.changeLearningOsCurrentPassword).toHaveBeenCalledTimes(31);
  });

  it('rejects malformed password changes before forwarding credentials', async () => {
    await request(app)
      .patch('/api/auth/change-password')
      .send({ currentPassword: ['old-password123'], newPassword: 'new-password123' })
      .expect(400);

    await request(app)
      .patch('/api/auth/change-password')
      .send({ currentPassword: 'old-password123', newPassword: 'short' })
      .expect(400);

    await request(app)
      .patch('/api/auth/change-password')
      .send({ currentPassword: 'old-password123', newPassword: 'x'.repeat(1025) })
      .expect(400);

    expect(mocks.changeLearningOsCurrentPassword).not.toHaveBeenCalled();
  });

  it('keeps the local password implementation available when auth routing is disabled', async () => {
    process.env.LEARNING_OS_AUTH_PROXY_ENABLED = 'false';
    mocks.prismaFindUnique.mockResolvedValue({ id: loginAccount.id, password: 'legacy-hash' });
    mocks.bcryptCompare.mockResolvedValue(true);
    mocks.bcryptHash.mockResolvedValue('new-legacy-hash');

    await request(app)
      .patch('/api/auth/change-password')
      .send({ currentPassword: 'old-password123', newPassword: 'new-password123' })
      .expect(200);

    expect(mocks.prismaUpdate).toHaveBeenCalledWith({
      where: { id: loginAccount.id },
      data: { password: 'new-legacy-hash' },
    });
    expect(mocks.changeLearningOsCurrentPassword).not.toHaveBeenCalled();
  });

  it.each([
    [{}, 'No fields to update'],
    [{ displayName: ['Ada'] }, 'Invalid display name'],
    [{ avatarColor: null }, 'Invalid avatar color'],
    [{ avatarUrl: ['https://example.com/avatar.png'] }, 'Invalid avatar URL'],
    [{ preferredStudyLanguage: 'en' }, 'Study language must be Japanese'],
    [{ preferredNativeLanguage: 'ja' }, 'Native language must be English'],
    [{ proficiencyLevel: 'beginner' }, 'Invalid proficiency level'],
    [{ onboardingCompleted: 1 }, 'Invalid onboardingCompleted'],
    [{ onboardingCompleted: true }, 'Invalid proficiency level'],
    [{ seenSampleContentGuide: null }, 'Invalid seenSampleContentGuide'],
    [{ seenCustomContentGuide: [] }, 'Invalid seenCustomContentGuide'],
  ] as const)(
    'rejects malformed profile payload %# before forwarding',
    async (payload, message) => {
      const response = await request(app).patch('/api/auth/me').send(payload).expect(400);

      expect(response.body.error.message).toBe(message);
      expect(mocks.updateLearningOsCurrentAccount).not.toHaveBeenCalled();
    }
  );

  it('passes controlled profile proxy failures through the normal API error envelope', async () => {
    mocks.updateLearningOsCurrentAccount.mockRejectedValue(
      new AppError('Learning OS Auth API is unavailable.', 502)
    );

    const response = await request(app)
      .patch('/api/auth/me')
      .send({ displayName: 'Ada' })
      .expect(502);

    expect(response.body).toEqual({
      error: { message: 'Learning OS Auth API is unavailable.', statusCode: 502 },
    });
  });

  it('keeps legacy profile persistence available when the profile flag is disabled', async () => {
    process.env.LEARNING_OS_PROFILE_PROXY_ENABLED = 'false';
    mocks.prismaFindUnique.mockResolvedValue({ onboardingCompleted: true });
    mocks.prismaUpdate.mockResolvedValue(currentAccount);

    const response = await request(app)
      .patch('/api/auth/me')
      .send({ displayName: 'Legacy Ada' })
      .expect(200);

    expect(response.body).toEqual(currentAccount);
    expect(mocks.prismaUpdate).toHaveBeenCalledWith({
      where: { id: loginAccount.id },
      data: { displayName: 'Legacy Ada' },
      select: expect.any(Object),
    });
    expect(mocks.updateLearningOsCurrentAccount).not.toHaveBeenCalled();
    expect(mocks.copySampleContentToUser).not.toHaveBeenCalled();
  });

  it('marks a Learning OS-only account when login finds no legacy row', async () => {
    mocks.prismaFindUnique.mockResolvedValue(null);

    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: loginAccount.email, password: 'correct password' })
      .expect(200);

    const cookies = getSetCookieArray(response.headers['set-cookie']);
    const sessionCookie = cookies.find((cookie) => cookie.startsWith('token='));
    const token = decodeURIComponent(sessionCookie!.split(';')[0].slice('token='.length));
    expect(verifyJwt(token, process.env.JWT_SECRET!)).toMatchObject({
      userId: loginAccount.id,
      accountSource: 'learning-os',
    });
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
