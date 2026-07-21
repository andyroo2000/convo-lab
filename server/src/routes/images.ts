import { Router } from 'express';

import { requireAuth } from '../middleware/auth.js';

import { generateLearningOsImages, showLearningOsImageJob } from './learningOs/images.js';

const router = Router();

router.use(requireAuth);

router.post('/generate', generateLearningOsImages);
router.get('/job/:jobId', showLearningOsImageJob);

export default router;
