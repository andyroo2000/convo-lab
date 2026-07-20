import { Router } from 'express';

import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { requireFeatureFlag } from '../middleware/featureFlags.js';
import { rateLimitStudyRoute } from '../middleware/studyRateLimit.js';
import { getStudyMediaAccess } from '../services/study/media.js';

import { sendPrivateMediaResponse } from './privateMediaResponse.js';

const router = Router();

router.use(requireAuth);
router.use(requireFeatureFlag('flashcardsEnabled'));

router.get(
  '/media/:mediaId',
  rateLimitStudyRoute({ key: 'media-read', max: 240, windowMs: 60 * 1000 }),
  async (req: AuthRequest, res, next) => {
    try {
      if (!req.userId) {
        throw new AppError('Authenticated user is required.', 401);
      }

      const mediaAccess = await getStudyMediaAccess(req.userId, req.params.mediaId);
      if (!mediaAccess) {
        throw new AppError('Study media not found.', 404);
      }

      sendPrivateMediaResponse(res, mediaAccess);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
