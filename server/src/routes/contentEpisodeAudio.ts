import { Router } from 'express';
import { rateLimit as createExpressRateLimit } from 'express-rate-limit';

import { requireAuth } from '../middleware/auth.js';
import { rateLimitStudyRoute } from '../middleware/studyRateLimit.js';

import { streamLearningOsEpisodeAudio } from './learningOs/audio.js';

const router = Router();
const episodeAudioIpRateLimit = createExpressRateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
});
const episodeAudioUserRateLimit = rateLimitStudyRoute({
  key: 'learning-os-episode-audio-proxy',
  max: 600,
  windowMs: 60 * 1000,
});

router.use(episodeAudioIpRateLimit, requireAuth);
router.get('/:episodeId/audio/:track', episodeAudioUserRateLimit, streamLearningOsEpisodeAudio);

export default router;
