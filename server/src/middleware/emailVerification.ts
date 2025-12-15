import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.js';
import { prisma } from '../db/client.js';
import { AppError } from './errorHandler.js';

/**
 * Middleware to require email verification for content generation
 * Admins bypass this check
 */
export async function requireEmailVerified(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.userId) {
      throw new AppError('Authentication required', 401);
    }

    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { emailVerified: true, role: true },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Admins bypass email verification requirement
    if (user.role === 'admin') {
      return next();
    }

    // Check if email is verified
    if (!user.emailVerified) {
      throw new AppError(
        'Please verify your email address before generating content. Check your inbox for the verification email.',
        403
      );
    }

    next();
  } catch (error) {
    next(error);
  }
}
