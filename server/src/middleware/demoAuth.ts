import { Response, NextFunction } from 'express';

import { prisma } from '../db/client.js';

import { AuthRequest } from './auth.js';
import { AppError } from './errorHandler.js';

/**
 * Middleware to block demo users from creating or deleting content.
 * Demo users can view content but cannot modify it.
 */
export async function blockDemoUser(req: AuthRequest, _res: Response, next: NextFunction) {
  try {
    if (!req.userId) {
      throw new AppError('Authentication required', 401);
    }

    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { role: true },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    if (user.role === 'demo') {
      throw new AppError(
        "You're exploring in demo mode, so content creation is disabled. Thanks for checking out the app! If you'd like full access, please contact the admin.",
        403
      );
    }

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Helper function to get the user ID to use for library queries.
 * For demo users, returns the admin user's ID so they see admin content.
 * For regular users, returns their own ID.
 */
export async function getLibraryUserId(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  if (user?.role === 'demo') {
    // Demo users see admin's content
    const adminUser = await prisma.user.findFirst({
      where: { role: 'admin' },
      select: { id: true },
    });
    if (adminUser) {
      return adminUser.id;
    }
  }

  return userId;
}
