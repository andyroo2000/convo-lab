import path from 'path';

import { Router } from 'express';

import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { requireFeatureFlag } from '../middleware/featureFlags.js';
import { rateLimitStudyRoute } from '../middleware/studyRateLimit.js';
import { getStudyMediaAccess } from '../services/study/media.js';

const router = Router();

function sanitizeDownloadFilename(filename: string): string {
  const basename = path.basename(filename);
  const sanitized = basename.replace(/[^A-Za-z0-9._-]/g, '_');
  return sanitized.length > 0 ? sanitized : 'study-media';
}

function toSafeContentDisposition(
  contentDisposition: 'inline' | 'attachment',
  filename: string
): string {
  const disposition = contentDisposition === 'attachment' ? 'attachment' : 'inline';
  return `${disposition}; filename="${sanitizeDownloadFilename(filename)}"`;
}

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

      if (mediaAccess.type === 'redirect') {
        res.redirect(302, mediaAccess.redirectUrl as string);
        return;
      }

      res.type(mediaAccess.contentType);
      res.sendFile(mediaAccess.absolutePath as string, {
        headers: {
          // Study media URLs contain the immutable media row ID. Regenerated audio creates
          // a new media row and URL, so cached `/api/study/media/:id` responses stay valid.
          'Cache-Control': 'private, max-age=15552000, immutable',
          'Content-Disposition': toSafeContentDisposition(
            mediaAccess.contentDisposition,
            mediaAccess.filename
          ),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
