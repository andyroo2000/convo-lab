import express, { json as expressJson, NextFunction, Response } from 'express';
import { sign as signJwt, verify as verifyJwt } from 'jsonwebtoken';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthRequest } from '../../../middleware/auth.js';
import { CSRF_TOKEN_COOKIE_NAME } from '../../../middleware/csrf.js';
import { AppError, errorHandler } from '../../../middleware/errorHandler.js';
import authRouter from '../../../routes/auth.js';
import { getSetCookieArray, testCookieParser } from '../../helpers/testCookieParser.js';

const mocks = vi.hoisted(() => ({
  authenticateLearningOsAccount: vi.fn(),
  claimLearningOsGoogleInvite: vi.fn(),
  changeLearningOsCurrentPassword: vi.fn(),
  deleteLearningOsCurrentAccount: vi.fn(),
  disconnectLearningOsGoogleIdentity: vi.fn(),
  getLearningOsCurrentAccount: vi.fn(),
  getLearningOsGenerationQuota: vi.fn(),
  registerLearningOsAccount: vi.fn(),
  updateLearningOsCurrentAccount: vi.fn(),
  authenticateLearningOsBrowserSession: vi.fn(),
  destroyLearningOsBrowserSession: vi.fn(),
  getLearningOsBrowserCurrentAccount: vi.fn(),
  isLearningOsBrowserSessionEnabled: vi.fn(),
  registerLearningOsBrowserSession: vi.fn(),
  prismaFindUnique: vi.fn(),
  prismaDeleteMany: vi.fn(),
  passportUser: undefined as unknown,
  passportAuthenticateOptions: [] as Array<{ strategy: string; options: Record<string, unknown> }>,
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
      (strategy: string, options: Record<string, unknown>) =>
        (req: express.Request, _res: express.Response, next: NextFunction) => {
          mocks.passportAuthenticateOptions.push({ strategy, options });
          req.user = mocks.passportUser as Express.User | undefined;
          next();
        }
    ),
  },
}));
vi.mock('../../../db/client.js', () => ({
  prisma: {
    user: {
      findUnique: mocks.prismaFindUnique,
      create: vi.fn(),
      deleteMany: mocks.prismaDeleteMany,
    },
    inviteCode: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));
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
  claimLearningOsGoogleInvite: mocks.claimLearningOsGoogleInvite,
  changeLearningOsCurrentPassword: mocks.changeLearningOsCurrentPassword,
  deleteLearningOsCurrentAccount: mocks.deleteLearningOsCurrentAccount,
  disconnectLearningOsGoogleIdentity: mocks.disconnectLearningOsGoogleIdentity,
  getLearningOsCurrentAccount: mocks.getLearningOsCurrentAccount,
  getLearningOsGenerationQuota: mocks.getLearningOsGenerationQuota,
  registerLearningOsAccount: mocks.registerLearningOsAccount,
  updateLearningOsCurrentAccount: mocks.updateLearningOsCurrentAccount,
}));
vi.mock('../../../services/learningOsBrowserSession.js', () => ({
  authenticateLearningOsBrowserSession: mocks.authenticateLearningOsBrowserSession,
  destroyLearningOsBrowserSession: mocks.destroyLearningOsBrowserSession,
  getLearningOsBrowserCurrentAccount: mocks.getLearningOsBrowserCurrentAccount,
  getLearningOsBrowserSessionCookieName: () => 'learning_os_session',
  isLearningOsBrowserSessionEnabled: mocks.isLearningOsBrowserSessionEnabled,
  registerLearningOsBrowserSession: mocks.registerLearningOsBrowserSession,
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
  let app: express.Application;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authenticateLearningOsAccount.mockResolvedValue(loginAccount);
    mocks.claimLearningOsGoogleInvite.mockResolvedValue({ ...currentAccount, avatarUrl: null });
    mocks.changeLearningOsCurrentPassword.mockResolvedValue(undefined);
    mocks.deleteLearningOsCurrentAccount.mockResolvedValue(undefined);
    mocks.disconnectLearningOsGoogleIdentity.mockResolvedValue(undefined);
    mocks.getLearningOsCurrentAccount.mockResolvedValue(currentAccount);
    mocks.getLearningOsGenerationQuota.mockResolvedValue({
      unlimited: false,
      quota: {
        used: 7,
        limit: 30,
        remaining: 23,
        resetsAt: '2026-08-01T00:00:00.000Z',
      },
      cooldown: { active: false, remainingSeconds: 0 },
    });
    mocks.registerLearningOsAccount.mockResolvedValue({ ...loginAccount, emailVerified: false });
    mocks.updateLearningOsCurrentAccount.mockResolvedValue(currentAccount);
    mocks.authenticateLearningOsBrowserSession.mockResolvedValue({
      account: loginAccount,
      sessionCookieValue: 'browser/session==',
    });
    mocks.destroyLearningOsBrowserSession.mockResolvedValue(undefined);
    mocks.getLearningOsBrowserCurrentAccount.mockResolvedValue(currentAccount);
    mocks.isLearningOsBrowserSessionEnabled.mockReturnValue(false);
    mocks.registerLearningOsBrowserSession.mockResolvedValue({
      account: { ...loginAccount, emailVerified: false },
      sessionCookieValue: 'signup-session',
    });
    mocks.prismaFindUnique.mockResolvedValue({ id: loginAccount.id });
    mocks.prismaDeleteMany.mockResolvedValue({ count: 1 });
    mocks.passportUser = undefined;
    mocks.passportAuthenticateOptions.length = 0;

    app = express();
    app.use(testCookieParser);
    app.use(expressJson());
    app.use('/api/auth', authRouter);
    app.use(errorHandler);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
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

  it('creates both Laravel and transitional Express sessions when browser auth is enabled', async () => {
    mocks.isLearningOsBrowserSessionEnabled.mockReturnValue(true);
    const signupAccount = { ...loginAccount, emailVerified: false, emailVerifiedAt: null };
    mocks.registerLearningOsBrowserSession.mockResolvedValue({
      account: signupAccount,
      sessionCookieValue: 'signup-session',
    });

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
    expect(mocks.registerLearningOsBrowserSession).toHaveBeenCalledWith({
      email: signupAccount.email,
      password: 'correct password',
      name: signupAccount.name,
      inviteCode: 'WELCOME1',
    });
    expect(mocks.registerLearningOsAccount).not.toHaveBeenCalled();
    const cookies = getSetCookieArray(response.headers['set-cookie']);
    const learningOsCookie = cookies.find((cookie) => cookie.startsWith('learning_os_session='));
    expect(learningOsCookie).toMatch(/^learning_os_session=signup-session;/);
    expect(learningOsCookie).toContain('Max-Age=604800');
    expect(learningOsCookie).toContain('Path=/');
    expect(learningOsCookie).toContain('HttpOnly');
    expect(learningOsCookie).toContain('SameSite=Lax');
    expect(learningOsCookie).not.toContain('Secure');
    expect(cookies.some((cookie) => cookie.startsWith('token='))).toBe(true);
    expect(cookies.some((cookie) => cookie.startsWith(`${CSRF_TOKEN_COOKIE_NAME}=`))).toBe(true);
  });

  it('redirects an invite-gated Google account with a signed Learning OS identity', async () => {
    mocks.passportUser = { ...loginAccount, requiresInvite: true };

    const response = await request(app).get('/api/auth/google/callback').expect(302);
    const redirect = new URL(response.headers.location, 'http://localhost');
    expect(redirect.pathname).toBe('/claim-invite');
    const token = redirect.searchParams.get('token');
    expect(token).not.toBeNull();
    expect(verifyJwt(token!, process.env.JWT_SECRET!)).toMatchObject({
      userId: loginAccount.id,
      email: loginAccount.email,
      role: loginAccount.role,
      accountSource: 'learning-os',
      requiresInvite: true,
    });
    expect(getSetCookieArray(response.headers['set-cookie'])).toEqual([]);
    expect(mocks.prismaFindUnique).not.toHaveBeenCalled();
  });

  it('requests only profile identity and does not request offline Google access', async () => {
    await request(app).get('/api/auth/google').expect(404);

    expect(mocks.passportAuthenticateOptions).toContainEqual({
      strategy: 'google',
      options: {
        scope: ['profile', 'email'],
        prompt: 'select_account',
        session: false,
      },
    });
  });

  it('creates a browser session immediately for a Google account with access', async () => {
    mocks.passportUser = { ...loginAccount, requiresInvite: false };

    const response = await request(app).get('/api/auth/google/callback').expect(302);
    expect(response.headers.location).toContain('/app/library');
    const sessionCookie = getSetCookieArray(response.headers['set-cookie']).find((cookie) =>
      cookie.startsWith('token=')
    );
    const token = decodeURIComponent(sessionCookie!.split(';')[0].slice('token='.length));
    expect(verifyJwt(token, process.env.JWT_SECRET!)).toMatchObject({
      userId: loginAccount.id,
      email: loginAccount.email,
      role: loginAccount.role,
      accountSource: 'learning-os',
    });
    expect(mocks.prismaFindUnique).not.toHaveBeenCalled();
  });

  it('claims a Google invite through Learning OS and upgrades the temporary session', async () => {
    const temporaryToken = signJwt(
      {
        userId: loginAccount.id,
        email: loginAccount.email,
        role: loginAccount.role,
        accountSource: 'learning-os',
        requiresInvite: true,
      },
      process.env.JWT_SECRET!,
      { expiresIn: '15m' }
    );

    const response = await request(app)
      .post('/api/auth/claim-invite')
      .send({ inviteCode: ' WELCOME1 ', token: temporaryToken })
      .expect(200);

    expect(mocks.claimLearningOsGoogleInvite).toHaveBeenCalledWith(loginAccount.id, 'WELCOME1', {
      userId: loginAccount.id,
      email: loginAccount.email,
      role: loginAccount.role,
      accountSource: 'learning-os',
    });
    expect(response.headers['ratelimit-policy']).toBeDefined();
    expect(response.body).toEqual({ ...currentAccount, avatarUrl: null });
    const sessionCookie = getSetCookieArray(response.headers['set-cookie']).find((cookie) =>
      cookie.startsWith('token=')
    );
    const token = decodeURIComponent(sessionCookie!.split(';')[0].slice('token='.length));
    expect(verifyJwt(token, process.env.JWT_SECRET!)).toMatchObject({
      userId: loginAccount.id,
      accountSource: 'learning-os',
    });
  });

  it('disconnects Google through Learning OS using the signed browser identity', async () => {
    const response = await request(app).post('/api/auth/disconnect/google').expect(200);

    expect(mocks.disconnectLearningOsGoogleIdentity).toHaveBeenCalledWith(loginAccount.id, {
      userId: loginAccount.id,
      email: loginAccount.email,
      role: loginAccount.role,
      accountSource: 'learning-os',
    });
    expect(response.body).toEqual({ success: true, message: 'Google account disconnected' });
  });

  it('rejects an invalid invite token without touching either database', async () => {
    await request(app)
      .post('/api/auth/claim-invite')
      .send({ inviteCode: 'WELCOME1', token: 'not-a-token' })
      .expect(401);

    expect(mocks.claimLearningOsGoogleInvite).not.toHaveBeenCalled();
    expect(mocks.prismaFindUnique).not.toHaveBeenCalled();
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

  it('uses Laravel credentials and relays its session cookie when browser auth is enabled', async () => {
    mocks.isLearningOsBrowserSessionEnabled.mockReturnValue(true);

    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: loginAccount.email, password: 'correct password' })
      .expect(200);

    expect(response.body).toEqual(loginAccount);
    expect(mocks.authenticateLearningOsBrowserSession).toHaveBeenCalledWith(
      loginAccount.email,
      'correct password'
    );
    expect(mocks.authenticateLearningOsAccount).not.toHaveBeenCalled();
    const cookies = getSetCookieArray(response.headers['set-cookie']);
    const learningOsCookie = cookies.find((cookie) => cookie.startsWith('learning_os_session='));
    expect(learningOsCookie).toMatch(/^learning_os_session=browser%2Fsession%3D%3D;/);
    expect(learningOsCookie).toContain('Max-Age=604800');
    expect(learningOsCookie).toContain('Path=/');
    expect(learningOsCookie).toContain('HttpOnly');
    expect(learningOsCookie).toContain('SameSite=Lax');
    expect(learningOsCookie).not.toContain('Secure');
    expect(cookies.some((cookie) => cookie.startsWith('token='))).toBe(true);
  });

  it('ignores stale values for the retired auth and profile routing flags', async () => {
    vi.stubEnv('LEARNING_OS_AUTH_PROXY_ENABLED', 'false');
    vi.stubEnv('LEARNING_OS_PROFILE_PROXY_ENABLED', 'false');

    await request(app)
      .post('/api/auth/login')
      .send({ email: loginAccount.email, password: 'correct password' })
      .expect(200);
    await request(app).patch('/api/auth/me').send({ displayName: 'Ada' }).expect(200);

    expect(mocks.authenticateLearningOsAccount).toHaveBeenCalledOnce();
    expect(mocks.updateLearningOsCurrentAccount).toHaveBeenCalledOnce();
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

  it('uses the Laravel browser session as current-user authority when present', async () => {
    mocks.isLearningOsBrowserSessionEnabled.mockReturnValue(true);

    const response = await request(app)
      .get('/api/auth/me')
      .set('Cookie', ['token=legacy-transition-token', 'learning_os_session=browser-session'])
      .expect(200);

    expect(response.body).toEqual(currentAccount);
    expect(mocks.getLearningOsBrowserCurrentAccount).toHaveBeenCalledWith('browser-session');
    expect(mocks.getLearningOsCurrentAccount).not.toHaveBeenCalled();
  });

  it('rejects mismatched Laravel and transitional Express identities', async () => {
    mocks.isLearningOsBrowserSessionEnabled.mockReturnValue(true);
    mocks.getLearningOsBrowserCurrentAccount.mockResolvedValueOnce({
      ...currentAccount,
      id: '22222222-2222-4222-8222-222222222222',
    });

    const response = await request(app)
      .get('/api/auth/me')
      .set('Cookie', ['token=legacy-transition-token', 'learning_os_session=other-user-session'])
      .expect(401);

    expect(response.body.error.message).toBe('Authentication required');
    expect(mocks.getLearningOsBrowserCurrentAccount).toHaveBeenCalledWith('other-user-session');
    expect(mocks.getLearningOsCurrentAccount).not.toHaveBeenCalled();
    expect(
      getSetCookieArray(response.headers['set-cookie']).some((cookie) =>
        cookie.startsWith('learning_os_session=;')
      )
    ).toBe(true);
  });

  it('clears both transitional sessions when the Laravel session has expired', async () => {
    mocks.isLearningOsBrowserSessionEnabled.mockReturnValue(true);
    mocks.getLearningOsBrowserCurrentAccount.mockRejectedValueOnce(
      new AppError('Authentication required', 401)
    );

    const response = await request(app)
      .get('/api/auth/me')
      .set('Cookie', ['token=legacy-transition-token', 'learning_os_session=expired-session'])
      .expect(401);

    const cookies = getSetCookieArray(response.headers['set-cookie']);
    expect(cookies.some((cookie) => cookie.startsWith('token=;'))).toBe(true);
    expect(cookies.some((cookie) => cookie.startsWith('learning_os_session=;'))).toBe(true);
  });

  it('keeps pre-cutover sessions working until their next password login', async () => {
    mocks.isLearningOsBrowserSessionEnabled.mockReturnValue(true);

    await request(app).get('/api/auth/me').set('Cookie', ['token=legacy-session']).expect(200);

    expect(mocks.getLearningOsBrowserCurrentAccount).not.toHaveBeenCalled();
    expect(mocks.getLearningOsCurrentAccount).toHaveBeenCalledOnce();
  });

  it('revokes both Laravel and transitional Express sessions on logout', async () => {
    const response = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', ['token=legacy-transition-token', 'learning_os_session=browser-session'])
      .expect(200);

    expect(mocks.destroyLearningOsBrowserSession).toHaveBeenCalledWith('browser-session');
    const cookies = getSetCookieArray(response.headers['set-cookie']);
    expect(cookies.some((cookie) => cookie.startsWith('token=;'))).toBe(true);
    expect(cookies.some((cookie) => cookie.startsWith('learning_os_session=;'))).toBe(true);
    expect(cookies.some((cookie) => cookie.startsWith(`${CSRF_TOKEN_COOKIE_NAME}=;`))).toBe(true);
  });

  it('clears a stale Laravel cookie when the bridge is rolled back', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .set('Cookie', ['learning_os_session=stale-session'])
      .send({ email: loginAccount.email, password: 'correct password' })
      .expect(200);

    expect(mocks.authenticateLearningOsAccount).toHaveBeenCalledOnce();
    expect(
      getSetCookieArray(response.headers['set-cookie']).some((cookie) =>
        cookie.startsWith('learning_os_session=;')
      )
    ).toBe(true);
  });

  it('does not clear local sessions when canonical logout cannot be confirmed', async () => {
    mocks.isLearningOsBrowserSessionEnabled.mockReturnValue(true);
    mocks.destroyLearningOsBrowserSession.mockRejectedValueOnce(
      new AppError('Learning OS Browser Session API is unavailable.', 502)
    );

    const response = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', ['token=legacy-transition-token', 'learning_os_session=browser-session'])
      .expect(502);

    expect(response.body.error.message).toBe('Learning OS Browser Session API is unavailable.');
    expect(getSetCookieArray(response.headers['set-cookie'])).toEqual([]);
  });

  it('loads generation quota from Learning OS without consulting Prisma', async () => {
    const response = await request(app).get('/api/auth/me/quota').expect(200);

    expect(response.body).toEqual({
      unlimited: false,
      quota: {
        used: 7,
        limit: 30,
        remaining: 23,
        resetsAt: '2026-08-01T00:00:00.000Z',
      },
      cooldown: { active: false, remainingSeconds: 0 },
    });
    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(mocks.getLearningOsGenerationQuota).toHaveBeenCalledWith(loginAccount.id, {
      userId: loginAccount.id,
      email: loginAccount.email,
      role: loginAccount.role,
      accountSource: 'learning-os',
    });
    expect(mocks.prismaFindUnique).not.toHaveBeenCalled();
  });

  it('returns canonical quota proxy failures through the normal API envelope', async () => {
    mocks.getLearningOsGenerationQuota.mockRejectedValueOnce(
      new AppError('Learning OS Auth API request failed.', 502)
    );

    const response = await request(app).get('/api/auth/me/quota').expect(502);

    expect(response.body.error).toMatchObject({
      message: 'Learning OS Auth API request failed.',
      statusCode: 502,
    });
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

  it('deletes the current account and local projection before clearing session cookies', async () => {
    const response = await request(app)
      .delete('/api/auth/me')
      .set('Cookie', [`token=session-token`, `${CSRF_TOKEN_COOKIE_NAME}=csrf-token`])
      .send({ currentPassword: 'correct-password123' })
      .expect(200);

    expect(response.body).toEqual({ message: 'server:auth.accountDeleted' });
    expect(mocks.deleteLearningOsCurrentAccount).toHaveBeenCalledWith(
      loginAccount.id,
      { currentPassword: 'correct-password123' },
      {
        userId: loginAccount.id,
        email: loginAccount.email,
        role: loginAccount.role,
        accountSource: 'learning-os',
      }
    );
    expect(mocks.prismaFindUnique).not.toHaveBeenCalled();
    expect(mocks.prismaDeleteMany).toHaveBeenCalledWith({ where: { id: loginAccount.id } });
    expect(mocks.deleteLearningOsCurrentAccount.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.prismaDeleteMany.mock.invocationCallOrder[0]
    );

    const cookies = getSetCookieArray(response.headers['set-cookie']);
    expect(cookies.some((cookie) => cookie.startsWith('token=;'))).toBe(true);
    expect(cookies.some((cookie) => cookie.startsWith('learning_os_session=;'))).toBe(true);
    expect(cookies.some((cookie) => cookie.startsWith(`${CSRF_TOKEN_COOKIE_NAME}=;`))).toBe(true);
  });

  it('does not report success when the local projection cannot be deleted', async () => {
    mocks.prismaDeleteMany.mockRejectedValueOnce(new Error('local cleanup failed'));

    const response = await request(app)
      .delete('/api/auth/me')
      .set('Cookie', [`token=session-token`, `${CSRF_TOKEN_COOKIE_NAME}=csrf-token`])
      .send({ currentPassword: 'correct-password123' })
      .expect(500);

    expect(mocks.deleteLearningOsCurrentAccount).toHaveBeenCalledOnce();
    expect(mocks.prismaDeleteMany).toHaveBeenCalledOnce();
    expect(getSetCookieArray(response.headers['set-cookie'])).toEqual([]);
  });

  it.each([
    ['incorrect current password', new AppError('Current password is incorrect', 401), 401],
    [
      'upstream rate limit',
      new AppError('Too many account deletion attempts.', 429, {
        cooldown: { remainingSeconds: 19 },
      }),
      429,
    ],
  ] as const)(
    'returns the normal account-deletion envelope for %s',
    async (_label, error, status) => {
      mocks.deleteLearningOsCurrentAccount.mockRejectedValueOnce(error);
      const userId =
        status === 429
          ? '44444444-4444-4444-8444-444444444444'
          : '55555555-5555-4555-8555-555555555555';

      const response = await request(app)
        .delete('/api/auth/me')
        .set('X-Test-User-Id', userId)
        .send({ currentPassword: 'correct-password123' })
        .expect(status);

      expect(response.body.error).toMatchObject({ message: error.message, statusCode: status });
      if (status === 429) {
        expect(response.headers['retry-after']).toBe('19');
      }
      expect(mocks.prismaDeleteMany).not.toHaveBeenCalled();
    }
  );

  it('rejects malformed account deletion payloads before forwarding credentials', async () => {
    for (const currentPassword of [undefined, '', ['password'], 'x'.repeat(1025)]) {
      await request(app)
        .delete('/api/auth/me')
        .set('X-Test-User-Id', '66666666-6666-4666-8666-666666666666')
        .send({ currentPassword })
        .expect(400);
    }

    expect(mocks.deleteLearningOsCurrentAccount).not.toHaveBeenCalled();
  });

  it('rate limits account deletion attempts by user before forwarding credentials', async () => {
    const limitedUserId = '22222222-2222-4222-8222-222222222222';
    const otherUserId = '33333333-3333-4333-8333-333333333333';
    const upstreamError = new AppError('Current password is incorrect', 401);
    mocks.deleteLearningOsCurrentAccount.mockRejectedValue(upstreamError);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await request(app)
        .delete('/api/auth/me')
        .set('X-Test-User-Id', limitedUserId)
        .send({ currentPassword: 'wrong-password' })
        .expect(401);
    }

    await request(app)
      .delete('/api/auth/me')
      .set('X-Test-User-Id', limitedUserId)
      .send({ currentPassword: 'wrong-password' })
      .expect(429);
    await request(app)
      .delete('/api/auth/me')
      .set('X-Test-User-Id', otherUserId)
      .send({ currentPassword: 'wrong-password' })
      .expect(401);

    expect(mocks.deleteLearningOsCurrentAccount).toHaveBeenCalledTimes(6);
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
