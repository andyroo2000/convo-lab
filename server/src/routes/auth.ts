/* eslint-disable no-console */
/* eslint-disable import/no-named-as-default-member */
// Console logging is necessary for OAuth callback monitoring
import { Router, type Response } from 'express';
import { ipKeyGenerator, rateLimit as createExpressRateLimit } from 'express-rate-limit';
import jwt from 'jsonwebtoken';

import { buildClientAppUrl } from '../config/browserRuntime.js';
import passport from '../config/passport.js';
import { prisma } from '../db/client.js';
import i18next from '../i18n/index.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { clearCsrfCookies, issueCsrfTokenCookie } from '../middleware/csrf.js';
import { AppError } from '../middleware/errorHandler.js';
import {
  authenticateLearningOsAccount,
  claimLearningOsGoogleInvite,
  changeLearningOsCurrentPassword,
  deleteLearningOsCurrentAccount,
  disconnectLearningOsGoogleIdentity,
  getLearningOsCurrentAccount,
  registerLearningOsAccount,
  updateLearningOsCurrentAccount,
  type LearningOsLoginAccount,
  type LearningOsProfileUpdateInput,
} from '../services/learningOsAuthProxy.js';
import { checkGenerationLimit, checkCooldown } from '../services/usageTracker.js';

const router = Router();
const signupRateLimit = createExpressRateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
});
const loginRateLimit = createExpressRateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    return `${ipKeyGenerator(req.ip ?? 'unknown')}:${email}`;
  },
});
const currentUserIpRateLimit = createExpressRateLimit({
  windowMs: 60 * 1000,
  limit: 600,
  standardHeaders: true,
  legacyHeaders: false,
});
const currentUserRateLimit = createExpressRateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req as AuthRequest).userId ?? ipKeyGenerator(req.ip ?? 'unknown'),
});
const passwordChangeIpRateLimit = createExpressRateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
});
const passwordChangeRateLimit = createExpressRateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req as AuthRequest).userId ?? ipKeyGenerator(req.ip ?? 'unknown'),
});
const accountDeletionIpRateLimit = createExpressRateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
});
const accountDeletionRateLimit = createExpressRateLimit({
  windowMs: 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req as AuthRequest).userId ?? ipKeyGenerator(req.ip ?? 'unknown'),
});
const googleInviteClaimRateLimit = createExpressRateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

function getSessionCookieOptions(sameSite: 'lax' | 'strict' = 'lax') {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? sameSite : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  } as const;
}

function setSessionCookies(
  req: AuthRequest,
  res: Response,
  token: string,
  sameSite: 'lax' | 'strict' = 'lax'
) {
  const resolvedSameSite = process.env.NODE_ENV === 'production' ? sameSite : 'lax';
  res.cookie('token', token, getSessionCookieOptions(sameSite));
  issueCsrfTokenCookie(req, res, resolvedSameSite);
}

function clearSessionCookies(res: Response, sameSite: 'lax' | 'strict' = 'lax') {
  const resolvedSameSite = process.env.NODE_ENV === 'production' ? sameSite : 'lax';
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: resolvedSameSite,
  });
  clearCsrfCookies(res, resolvedSameSite);
}

function createLearningOsSessionToken(
  account: LearningOsLoginAccount,
  accountSource?: 'learning-os'
): string {
  return jwt.sign(
    { userId: account.id, email: account.email, role: account.role, accountSource },
    process.env.JWT_SECRET!,
    { expiresIn: '7d' }
  );
}

// Sign up
router.post('/signup', signupRateLimit, async (req, res, next) => {
  try {
    const { email, password, name, inviteCode } = req.body;

    if (
      typeof email !== 'string' ||
      typeof password !== 'string' ||
      typeof name !== 'string' ||
      !email.trim() ||
      !password ||
      !name.trim()
    ) {
      throw new AppError(i18next.t('server:auth.emailRequired'), 400);
    }
    if (typeof inviteCode !== 'string' || !inviteCode.trim()) {
      throw new AppError(i18next.t('server:auth.inviteRequired'), 400);
    }
    const normalizedInput = {
      email: email.trim(),
      password,
      name: name.trim(),
      inviteCode: inviteCode.trim(),
    };
    if (
      normalizedInput.email.length > 255 ||
      password.length < 8 ||
      password.length > 1024 ||
      normalizedInput.name.length > 255 ||
      normalizedInput.inviteCode.length > 20
    ) {
      throw new AppError('Invalid signup details', 400);
    }

    const account = await registerLearningOsAccount(normalizedInput);
    setSessionCookies(
      req as AuthRequest,
      res,
      createLearningOsSessionToken(account, 'learning-os')
    );
    res.json(account);
  } catch (error) {
    next(error);
  }
});

// Login
router.post('/login', loginRateLimit, async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
      throw new AppError('Email and password are required', 400);
    }

    // The pre-cutover sync projects the source UUID and persisted role. Keep role
    // changes in that canonical sync path instead of mutating only one database here.
    const account = await authenticateLearningOsAccount(email, password);
    const legacyAccount = await prisma.user.findUnique({
      where: { id: account.id },
      select: { id: true },
    });
    const token = createLearningOsSessionToken(account, legacyAccount ? undefined : 'learning-os');

    setSessionCookies(req as AuthRequest, res, token);
    res.json(account);
  } catch (error) {
    next(error);
  }
});

// Logout
router.post('/logout', (_req, res) => {
  clearSessionCookies(res);
  res.json({ message: 'Logged out successfully' });
});

router.get('/csrf', (req, res) => {
  issueCsrfTokenCookie(req as AuthRequest, res, 'lax');
  res.status(204).end();
});

// Get current user
router.get(
  '/me',
  currentUserIpRateLimit,
  requireAuth,
  currentUserRateLimit,
  async (req: AuthRequest, res, next) => {
    try {
      const account = await getLearningOsCurrentAccount(req.userId!, {
        userId: req.userId!,
        email: req.email,
        role: req.role,
        accountSource: req.accountSource,
      });
      issueCsrfTokenCookie(req, res, 'lax');
      res.json(account);
    } catch (error) {
      next(error);
    }
  }
);

// Update user profile
router.patch('/me', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const update = buildLearningOsProfileUpdate(req.body);
    // Learning OS owns first-onboarding sample creation in the same transaction
    // as the profile update.
    const account = await updateLearningOsCurrentAccount(req.userId!, update, {
      userId: req.userId!,
      email: req.email,
      role: req.role,
      accountSource: req.accountSource,
    });
    res.json(account);
  } catch (error) {
    next(error);
  }
});

function buildLearningOsProfileUpdate(value: unknown): LearningOsProfileUpdateInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AppError('No fields to update', 400);
  }

  const body = value as Record<string, unknown>;
  const update: LearningOsProfileUpdateInput = {};
  if (Object.hasOwn(body, 'displayName')) {
    if (
      body.displayName !== null &&
      (typeof body.displayName !== 'string' || body.displayName.length > 255)
    ) {
      throw new AppError('Invalid display name', 400);
    }
    update.displayName = body.displayName as string | null;
  }
  if (Object.hasOwn(body, 'avatarColor')) {
    const validColors = ['indigo', 'teal', 'purple', 'pink', 'emerald', 'amber', 'rose', 'cyan'];
    if (typeof body.avatarColor !== 'string' || !validColors.includes(body.avatarColor)) {
      throw new AppError('Invalid avatar color', 400);
    }
    update.avatarColor = body.avatarColor;
  }
  if (Object.hasOwn(body, 'avatarUrl')) {
    if (
      body.avatarUrl !== null &&
      (typeof body.avatarUrl !== 'string' || body.avatarUrl.length > 2048)
    ) {
      throw new AppError('Invalid avatar URL', 400);
    }
    update.avatarUrl = body.avatarUrl as string | null;
  }
  if (Object.hasOwn(body, 'preferredStudyLanguage')) {
    if (body.preferredStudyLanguage !== 'ja') {
      throw new AppError('Study language must be Japanese', 400);
    }
    update.preferredStudyLanguage = body.preferredStudyLanguage;
  }
  if (Object.hasOwn(body, 'preferredNativeLanguage')) {
    if (body.preferredNativeLanguage !== 'en') {
      throw new AppError('Native language must be English', 400);
    }
    update.preferredNativeLanguage = body.preferredNativeLanguage;
  }
  if (Object.hasOwn(body, 'proficiencyLevel')) {
    const validLevels = ['N5', 'N4', 'N3', 'N2', 'N1'] as const;
    if (!validLevels.includes(body.proficiencyLevel as (typeof validLevels)[number])) {
      throw new AppError('Invalid proficiency level', 400);
    }
    update.proficiencyLevel = body.proficiencyLevel as (typeof validLevels)[number];
  }

  for (const field of [
    'onboardingCompleted',
    'seenSampleContentGuide',
    'seenCustomContentGuide',
  ] as const) {
    if (Object.hasOwn(body, field)) {
      if (typeof body[field] !== 'boolean') {
        throw new AppError(`Invalid ${field}`, 400);
      }
      update[field] = body[field];
    }
  }

  if (update.onboardingCompleted === true && update.proficiencyLevel === undefined) {
    // Learning OS requires the level on the completion transition so it can
    // atomically choose and copy the matching sample-content template.
    throw new AppError('Invalid proficiency level', 400);
  }
  if (Object.keys(update).length === 0) {
    throw new AppError('No fields to update', 400);
  }

  return update;
}

// Change password
router.patch(
  '/change-password',
  passwordChangeIpRateLimit,
  requireAuth,
  passwordChangeRateLimit,
  async (req: AuthRequest, res, next) => {
    try {
      const { currentPassword, newPassword } = req.body;

      if (
        typeof currentPassword !== 'string' ||
        typeof newPassword !== 'string' ||
        !currentPassword ||
        !newPassword
      ) {
        throw new AppError(i18next.t('server:auth.passwordFieldsRequired'), 400);
      }

      if (currentPassword.length > 1024 || newPassword.length > 1024) {
        throw new AppError('Invalid password details', 400);
      }

      if (newPassword.length < 8) {
        throw new AppError(i18next.t('server:auth.passwordTooShort'), 400);
      }

      await changeLearningOsCurrentPassword(
        req.userId!,
        { currentPassword, newPassword },
        {
          userId: req.userId!,
          email: req.email,
          role: req.role,
          accountSource: req.accountSource,
        }
      );
      res.json({ message: i18next.t('server:auth.passwordChanged') });
    } catch (error) {
      next(error);
    }
  }
);

// Delete user account
router.delete(
  '/me',
  accountDeletionIpRateLimit,
  requireAuth,
  accountDeletionRateLimit,
  async (req: AuthRequest, res, next) => {
    try {
      const { currentPassword } = req.body;
      if (
        typeof currentPassword !== 'string' ||
        !currentPassword ||
        currentPassword.length > 1024
      ) {
        throw new AppError('Current password is required', 400);
      }

      await deleteLearningOsCurrentAccount(
        req.userId!,
        { currentPassword },
        {
          userId: req.userId!,
          email: req.email,
          role: req.role,
          accountSource: req.accountSource,
        }
      );

      // Learning OS owns credential verification and canonical data deletion. Remove any
      // remaining ConvoLab projection afterward; deleteMany is idempotent when both apps
      // share the user row and Learning OS has already removed it.
      await prisma.user.deleteMany({ where: { id: req.userId } });

      clearSessionCookies(res, 'strict');
      res.json({ message: i18next.t('server:auth.accountDeleted') });
    } catch (error) {
      next(error);
    }
  }
);

// Get quota status for current user
router.get('/me/quota', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { role: true },
    });

    // Admins get unlimited
    if (user?.role === 'admin') {
      return res.json({
        unlimited: true,
        quota: null,
        cooldown: { active: false, remainingSeconds: 0 },
      });
    }

    const status = await checkGenerationLimit(req.userId!, 'dialogue');
    const cooldown = await checkCooldown(req.userId!);

    res.json({
      unlimited: false,
      quota: status,
      cooldown,
    });
  } catch (error) {
    next(error);
  }
});

// Google OAuth - Initiate
router.get(
  '/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    prompt: 'select_account', // Show account picker - less intrusive than full consent
    session: false,
  })
);

// Google OAuth - Callback
router.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/login?error=oauth_failed' }),
  async (req, res) => {
    try {
      const user = req.user as (LearningOsLoginAccount & { requiresInvite: boolean }) | undefined;

      if (!user) {
        return res.redirect(buildClientAppUrl('/login?error=oauth_failed'));
      }

      if (user.requiresInvite) {
        const tempToken = jwt.sign(
          {
            userId: user.id,
            email: user.email,
            role: user.role,
            accountSource: 'learning-os',
            requiresInvite: true,
          },
          process.env.JWT_SECRET!,
          { expiresIn: '15m' }
        );

        return res.redirect(buildClientAppUrl(`/claim-invite?token=${tempToken}`));
      }

      setSessionCookies(
        req as AuthRequest,
        res,
        createLearningOsSessionToken(user, 'learning-os'),
        'strict'
      );
      return res.redirect(buildClientAppUrl('/app/library'));
    } catch (error) {
      console.error('OAuth callback error:', error);
      res.redirect(buildClientAppUrl('/login?error=oauth_failed'));
    }
  }
);

// Disconnect Google account
router.post('/disconnect/google', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    await disconnectLearningOsGoogleIdentity(req.userId!, {
      userId: req.userId!,
      email: req.email,
      role: req.role,
      accountSource: req.accountSource,
    });

    res.json({ success: true, message: 'Google account disconnected' });
  } catch (error) {
    next(error);
  }
});

// Claim invite code (for OAuth users)
router.post('/claim-invite', googleInviteClaimRateLimit, async (req, res, next) => {
  try {
    const { inviteCode, token } = req.body;

    if (
      typeof inviteCode !== 'string' ||
      typeof token !== 'string' ||
      !inviteCode.trim() ||
      !token ||
      inviteCode.trim().length > 20 ||
      token.length > 2048
    ) {
      throw new AppError('Invite code and token are required', 400);
    }

    let decoded: jwt.JwtPayload & {
      userId?: unknown;
      email?: unknown;
      role?: unknown;
      accountSource?: unknown;
      requiresInvite?: unknown;
    };
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET!) as typeof decoded;
    } catch {
      throw new AppError('Invalid or expired token', 401);
    }

    if (decoded.requiresInvite !== true || typeof decoded.userId !== 'string') {
      throw new AppError('Invalid token', 401);
    }

    const hasLearningOsIdentity =
      decoded.accountSource === 'learning-os' &&
      typeof decoded.email === 'string' &&
      (decoded.role === 'user' || decoded.role === 'moderator' || decoded.role === 'admin');
    const user = await claimLearningOsGoogleInvite(
      decoded.userId,
      inviteCode.trim(),
      hasLearningOsIdentity
        ? {
            userId: decoded.userId,
            email: decoded.email as string,
            role: decoded.role as 'user' | 'moderator' | 'admin',
            accountSource: 'learning-os',
          }
        : undefined
    );

    setSessionCookies(
      req as AuthRequest,
      res,
      createLearningOsSessionToken(user, 'learning-os'),
      'strict'
    );

    res.json(user);
  } catch (error) {
    next(error);
  }
});

export default router;
