import { Response, NextFunction } from 'express';

import { prisma } from '../db/client.js';
import i18next from '../i18n/index.js';

import { AuthRequest } from './auth.js';
import { AppError } from './errorHandler.js';

/**
 * Middleware to require email verification for content generation
 * Admins bypass this check
 */
export async function requireEmailVerified(req: AuthRequest, _res: Response, next: NextFunction) {
  try {
    if (!req.userId) {
      throw new AppError(i18next.t('server:errors.authRequired'), 401);
    }

    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { emailVerified: true, role: true },
    });

    if (!user) {
      throw new AppError(i18next.t('server:auth.userNotFound'), 404);
    }

    // Admins bypass email verification requirement
    if (user.role === 'admin') {
      return next();
    }

    // Check if email is verified
    if (!user.emailVerified) {
      throw new AppError(i18next.t('server:emailVerificationRequired'), 403);
    }

    next();
  } catch (error) {
    next(error);
  }
}
