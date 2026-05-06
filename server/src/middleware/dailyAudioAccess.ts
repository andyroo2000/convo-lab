import type { NextFunction, Response } from 'express';

import type { AuthRequest } from './auth.js';
import { requireAuth } from './auth.js';
import { blockDemoUser } from './demoAuth.js';
import { requireFeatureFlag } from './featureFlags.js';

type DailyAudioHandler = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => void | Promise<void>;

const requireFlashcards = requireFeatureFlag('flashcardsEnabled');

function runMiddleware(
  middleware: DailyAudioHandler,
  req: AuthRequest,
  res: Response
): Promise<void> {
  return new Promise((resolve, reject) => {
    middleware(req, res, (error?: unknown) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

export function withDailyAudioAccess(
  handler: DailyAudioHandler,
  options?: { blockDemo?: boolean; afterAuth?: DailyAudioHandler[] }
) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      await runMiddleware(requireAuth, req, res);
      await runMiddleware(requireFlashcards, req, res);
      if (options?.blockDemo) {
        await runMiddleware(blockDemoUser, req, res);
      }
      for (const middleware of options?.afterAuth ?? []) {
        await runMiddleware(middleware, req, res);
      }
      await handler(req, res, next);
    } catch (error) {
      next(error);
    }
  };
}
