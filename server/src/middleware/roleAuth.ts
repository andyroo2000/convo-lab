import { Response, NextFunction } from 'express';

import { prisma } from '../db/client.js';

import { AuthRequest } from './auth.js';
import { AppError } from './errorHandler.js';

/**
 * Middleware to require admin role
 */
export async function requireAdmin(req: AuthRequest, _res: Response, next: NextFunction) {
  try {
    if (!req.userId) {
      throw new AppError('Authentication required', 401);
    }

    if (req.role) {
      if (req.role !== 'admin') {
        throw new AppError('Admin access required', 403);
      }
      next();
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { role: true },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    if (user.role !== 'admin') {
      throw new AppError('Admin access required', 403);
    }

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Middleware to require specific roles
 */
export function requireRole(roles: string[]) {
  return async (req: AuthRequest, _res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        throw new AppError('Authentication required', 401);
      }

      if (req.role) {
        if (!roles.includes(req.role)) {
          throw new AppError(`Access denied. Required role: ${roles.join(' or ')}`, 403);
        }
        next();
        return;
      }

      const user = await prisma.user.findUnique({
        where: { id: req.userId },
        select: { role: true },
      });

      if (!user) {
        throw new AppError('User not found', 404);
      }

      if (!roles.includes(user.role)) {
        throw new AppError(`Access denied. Required role: ${roles.join(' or ')}`, 403);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
