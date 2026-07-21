import { Router } from 'express';

import { requireAuth } from '../middleware/auth.js';

import { streamLearningOsEpisodeAudio } from './learningOs/audio.js';

const router = Router();

router.use(requireAuth);
router.get('/:episodeId/audio/:track', streamLearningOsEpisodeAudio);

export default router;
