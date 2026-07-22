/* eslint-disable import/no-named-as-default-member */
import { Router } from 'express';
import { ipKeyGenerator, rateLimit as createExpressRateLimit } from 'express-rate-limit';

import { isLearningOsVerificationProxyEnabled } from '../config/authRouting.js';
import { prisma } from '../db/client.js';
import i18next from '../i18n/index.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import {
  sendVerificationEmail,
  sendWelcomeEmail,
  verifyEmailToken,
} from '../services/emailService.js';
import {
  sendLearningOsVerificationEmail,
  sendLearningOsPasswordResetLink,
  resetLearningOsPassword,
  verifyLearningOsEmail,
} from '../services/learningOsAuthProxy.js';

const router = Router();
const verificationSendIpRateLimit = createExpressRateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
});
const verificationSendRateLimit = createExpressRateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req as AuthRequest).userId ?? ipKeyGenerator(req.ip ?? 'unknown'),
});
const verificationConsumeRateLimit = createExpressRateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
});
const passwordResetRequestIpRateLimit = createExpressRateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
});
const passwordResetRequestRateLimit = createExpressRateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    return `${ipKeyGenerator(req.ip ?? 'unknown')}:${email}`;
  },
});
const passwordResetConsumeRateLimit = createExpressRateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

// Resend verification email
router.post(
  '/verification/send',
  verificationSendIpRateLimit,
  requireAuth,
  verificationSendRateLimit,
  async (req: AuthRequest, res, next) => {
    try {
      if (isLearningOsVerificationProxyEnabled()) {
        await sendLearningOsVerificationEmail(req.userId!, {
          userId: req.userId!,
          email: req.email,
          role: req.role,
          accountSource: req.accountSource,
        });
        return res.json({ message: i18next.t('server:verification.emailSent') });
      }

      const user = await prisma.user.findUnique({
        where: { id: req.userId },
        select: {
          id: true,
          email: true,
          name: true,
          emailVerified: true,
        },
      });

      if (!user) {
        throw new AppError('User not found', 404);
      }

      if (user.emailVerified) {
        throw new AppError(i18next.t('server:verification.emailAlreadyVerified'), 400);
      }

      // Send verification email
      await sendVerificationEmail(user.id, user.email, user.name);

      res.json({ message: i18next.t('server:verification.emailSent') });
    } catch (error) {
      next(error);
    }
  }
);

// Verify email with token
router.get('/verification/:token', verificationConsumeRateLimit, async (req, res, next) => {
  try {
    const { token } = req.params;

    if (isLearningOsVerificationProxyEnabled()) {
      // Target-created accounts have no legacy profile/name for the old welcome email;
      // keep this flag off until the profile/onboarding cutover owns that workflow.
      return res.json(await verifyLearningOsEmail(token));
    }

    const result = await verifyEmailToken(token);

    if (!result) {
      throw new AppError(i18next.t('server:verification.tokenInvalid'), 400);
    }

    // Get user details
    const user = await prisma.user.findUnique({
      where: { id: result.userId },
      select: { name: true, email: true },
    });

    if (user) {
      // Send welcome email
      await sendWelcomeEmail(user.email, user.name);
    }

    res.json({
      message: i18next.t('server:verification.emailVerified'),
      email: result.email,
    });
  } catch (error) {
    next(error);
  }
});

// Request password reset
router.post(
  '/password-reset/request',
  passwordResetRequestIpRateLimit,
  passwordResetRequestRateLimit,
  async (req, res, next) => {
    try {
      const { email } = req.body;

      if (!email) {
        throw new AppError(i18next.t('server:verification.emailRequired'), 400);
      }

      await sendLearningOsPasswordResetLink(email);
      res.json({ message: i18next.t('server:verification.passwordResetSent') });
    } catch (error) {
      next(error);
    }
  }
);

// Reset password with token
router.post('/password-reset/verify', passwordResetConsumeRateLimit, async (req, res, next) => {
  try {
    const { email, token, newPassword } = req.body;

    if (!token || !newPassword) {
      throw new AppError(i18next.t('server:verification.tokenAndPasswordRequired'), 400);
    }

    if (newPassword.length < 8) {
      throw new AppError(i18next.t('server:verification.passwordTooShort'), 400);
    }

    await resetLearningOsPassword({ email, token, newPassword });
    res.json({ message: i18next.t('server:verification.passwordResetSuccess') });
  } catch (error) {
    next(error);
  }
});

export default router;
