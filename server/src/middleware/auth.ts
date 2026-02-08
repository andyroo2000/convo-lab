import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

import { AppError } from './errorHandler.js';

const { verify, JsonWebTokenError } = jwt;

export interface AuthRequest extends Request {
  userId?: string;
  role?: string;
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { token } = req.cookies;

    if (!token) {
      throw new AppError('Authentication required', 401);
    }

    const decoded = verify(token, process.env.JWT_SECRET!) as {
      userId: string;
      role?: string;
    };
    req.userId = decoded.userId;
    req.role = decoded.role;

    next();
  } catch (error) {
    if (error instanceof JsonWebTokenError) {
      next(new AppError('Invalid token', 401));
    } else {
      next(error);
    }
  }
}
