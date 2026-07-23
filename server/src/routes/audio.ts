import { Router } from 'express';

import { requireAuth } from '../middleware/auth.js';

import {
  generateAllSpeedsLearningOsAudio,
  generateLearningOsAudio,
  showLearningOsAudioJob,
} from './learningOs/audio.js';

const router = Router();

router.use(requireAuth);

router.post('/generate', generateLearningOsAudio);
router.post('/generate-all-speeds', generateAllSpeedsLearningOsAudio);
router.get('/job/:jobId', showLearningOsAudioJob);

export default router;
