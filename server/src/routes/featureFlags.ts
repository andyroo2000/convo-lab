import { Router } from 'express';

import { prisma } from '../db/client.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';

const router = Router();

// Public endpoint - get feature flags (available to all authenticated users)
router.get('/', requireAuth, async (_req: AuthRequest, res, next) => {
  try {
    // Feature flags is a singleton - get the first (and only) row
    let flags = await prisma.featureFlag.findFirst();

    // If no flags exist, create default (all enabled)
    if (!flags) {
      flags = await prisma.featureFlag.create({
        data: {
          dialoguesEnabled: true,
          audioCourseEnabled: true,
        },
      });
    }

    res.json(flags);
  } catch (error) {
    next(error);
  }
});

export default router;
