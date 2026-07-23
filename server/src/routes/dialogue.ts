import { Router } from 'express';

import { requireAuth } from '../middleware/auth.js';
import { blockDemoUser } from '../middleware/demoAuth.js';
import { requireEmailVerified } from '../middleware/emailVerification.js';

import { generateLearningOsDialogue, showLearningOsDialogueJob } from './learningOs/dialogue.js';

const router = Router();

router.use(requireAuth);

router.post('/generate', requireEmailVerified, blockDemoUser, generateLearningOsDialogue);
router.get('/job/:jobId', showLearningOsDialogueJob);

export default router;
