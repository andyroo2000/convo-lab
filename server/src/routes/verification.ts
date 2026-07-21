/* eslint-disable import/no-named-as-default-member */
import bcrypt from 'bcrypt';
import { Router } from 'express';
import { ipKeyGenerator, rateLimit as createExpressRateLimit } from 'express-rate-limit';

import { isLearningOsVerificationProxyEnabled } from '../config/authRouting.js';
import { prisma } from '../db/client.js';
import i18next from '../i18n/index.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
  sendPasswordChangedEmail,
  verifyEmailToken,
  verifyPasswordResetToken,
  markPasswordResetTokenUsed,
} from '../services/emailService.js';
import {
  sendLearningOsVerificationEmail,
  verifyLearningOsEmail,
} from '../services/learningOsAuthProxy.js';

const router = Router();
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

// Resend verification email
router.post(
  '/verification/send',
  requireAuth,
  verificationSendRateLimit,
  async (req: AuthRequest, res, next) => {
    try {
      if (isLearningOsVerificationProxyEnabled()) {
        await sendLearningOsVerificationEmail(req.userId!, {
          userId: req.userId!,
          email: req.email,
          role: req.role,
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
router.post('/password-reset/request', async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      throw new AppError(i18next.t('server:verification.emailRequired'), 400);
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });

    // Always return success to prevent email enumeration
    if (!user) {
      res.json({ message: i18next.t('server:verification.passwordResetSent') });
      return;
    }

    // Send password reset email
    await sendPasswordResetEmail(user.id, user.email, user.name);

    res.json({ message: i18next.t('server:verification.passwordResetSent') });
  } catch (error) {
    next(error);
  }
});

// Verify password reset token (without resetting password yet)
router.get('/password-reset/:token', async (req, res, next) => {
  try {
    const { token } = req.params;

    const result = await verifyPasswordResetToken(token);

    if (!result) {
      throw new AppError(i18next.t('server:verification.passwordResetTokenInvalid'), 400);
    }

    res.json({
      valid: true,
      email: result.email,
    });
  } catch (error) {
    next(error);
  }
});

// Reset password with token
router.post('/password-reset/verify', async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      throw new AppError(i18next.t('server:verification.tokenAndPasswordRequired'), 400);
    }

    if (newPassword.length < 8) {
      throw new AppError(i18next.t('server:verification.passwordTooShort'), 400);
    }

    // Verify token
    const result = await verifyPasswordResetToken(token);

    if (!result) {
      throw new AppError(i18next.t('server:verification.passwordResetTokenInvalid'), 400);
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password and mark token as used
    await prisma.$transaction(async (tx) => {
      // Update password
      await tx.user.update({
        where: { id: result.userId },
        data: { password: hashedPassword },
      });

      // Mark token as used
      await markPasswordResetTokenUsed(token);
    });

    // Get user details
    const user = await prisma.user.findUnique({
      where: { id: result.userId },
      select: { name: true, email: true },
    });

    if (user) {
      // Send confirmation email
      await sendPasswordChangedEmail(user.email, user.name);
    }

    res.json({ message: i18next.t('server:verification.passwordResetSuccess') });
  } catch (error) {
    next(error);
  }
});

export default router;
