import { Router } from 'express';
import { rateLimit as createExpressRateLimit } from 'express-rate-limit';

import { requireAuth } from '../middleware/auth.js';
import { blockDemoUser } from '../middleware/demoAuth.js';
import { requireEmailVerified } from '../middleware/emailVerification.js';
import { rateLimitStudyRoute } from '../middleware/studyRateLimit.js';

import {
  annotateLearningOsScript,
  generateLearningOsScriptImages,
  renderLearningOsScript,
  showLearningOsScript,
  showLearningOsScriptJob,
  storeLearningOsScript,
  streamLearningOsScriptAudio,
  streamLearningOsScriptImage,
  updateLearningOsScriptSegments,
} from './learningOs/scripts.js';

const router = Router();
const scriptIpRateLimit = createExpressRateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
});

router.use(
  scriptIpRateLimit,
  requireAuth,
  rateLimitStudyRoute({ key: 'script', max: 300, windowMs: 60 * 1000 })
);

router.get(
  '/media/:mediaId',
  rateLimitStudyRoute({ key: 'script-media-read', max: 240, windowMs: 60 * 1000 }),
  streamLearningOsScriptImage
);
router.post('/', requireEmailVerified, blockDemoUser, storeLearningOsScript);
router.post('/:episodeId/annotate', requireEmailVerified, blockDemoUser, annotateLearningOsScript);
router.patch(
  '/:episodeId/segments',
  requireEmailVerified,
  blockDemoUser,
  updateLearningOsScriptSegments
);
router.post('/:episodeId/render', requireEmailVerified, blockDemoUser, renderLearningOsScript);
router.post(
  '/:episodeId/images',
  requireEmailVerified,
  blockDemoUser,
  generateLearningOsScriptImages
);
router.get('/:episodeId/status', showLearningOsScript);
router.get('/job/:jobId', showLearningOsScriptJob);
router.get(
  '/:episodeId/audio/:renderId',
  rateLimitStudyRoute({ key: 'script-audio-read', max: 240, windowMs: 60 * 1000 }),
  streamLearningOsScriptAudio
);

export default router;
