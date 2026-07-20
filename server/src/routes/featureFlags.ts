import { Router } from 'express';
import { rateLimit as createExpressRateLimit } from 'express-rate-limit';

import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { getLearningOsFeatureFlags } from '../services/featureFlagsProxy.js';

const router = Router();
const featureFlagsIpRateLimit = createExpressRateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
});

// Public endpoint - get feature flags (available to all authenticated users)
router.get('/', featureFlagsIpRateLimit, requireAuth, async (req: AuthRequest, res, next) => {
  try {
    if (!req.userId) {
      throw new AppError('Authentication required', 401);
    }

    res.json(await getLearningOsFeatureFlags());
  } catch (error) {
    next(error);
  }
});

export default router;
