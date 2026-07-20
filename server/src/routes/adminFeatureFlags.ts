import { Router } from 'express';
import { rateLimit as createExpressRateLimit } from 'express-rate-limit';

import { AuthRequest, requireAuth } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/roleAuth.js';
import {
  getLearningOsFeatureFlags,
  parseClientFeatureFlagsPatch,
  updateLearningOsFeatureFlags,
} from '../services/featureFlagsProxy.js';

const router = Router();
const adminFeatureFlagsRateLimit = createExpressRateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

router.use(adminFeatureFlagsRateLimit, requireAuth, requireAdmin);

router.get('/', async (_req: AuthRequest, res, next) => {
  try {
    res.json(await getLearningOsFeatureFlags());
  } catch (error) {
    next(error);
  }
});

router.patch('/', async (req: AuthRequest, res, next) => {
  try {
    res.json(await updateLearningOsFeatureFlags(parseClientFeatureFlagsPatch(req.body)));
  } catch (error) {
    next(error);
  }
});

export default router;
