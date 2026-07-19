import { Router } from 'express';

import { prisma } from '../db/client.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import {
  CLIENT_FEATURE_FLAG_SELECT,
  DEFAULT_CLIENT_FEATURE_FLAGS,
} from '../services/featureFlags.js';

const router = Router();

// Public endpoint - get feature flags (available to all authenticated users)
router.get('/', requireAuth, async (_req: AuthRequest, res, next) => {
  try {
    // Feature flags is a singleton - get the first (and only) row
    let flags = await prisma.featureFlag.findFirst({
      select: CLIENT_FEATURE_FLAG_SELECT,
    });

    // If no flags exist, create default (all enabled)
    if (!flags) {
      flags = await prisma.featureFlag.create({
        data: DEFAULT_CLIENT_FEATURE_FLAGS,
        select: CLIENT_FEATURE_FLAG_SELECT,
      });
    }

    res.json(flags);
  } catch (error) {
    next(error);
  }
});

export default router;
