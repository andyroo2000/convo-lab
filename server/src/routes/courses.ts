import { Router } from 'express';

import { requireAuth } from '../middleware/auth.js';
import { blockDemoUser } from '../middleware/demoAuth.js';
import { requireEmailVerified } from '../middleware/emailVerification.js';

import {
  deleteLearningOsCourse,
  generateLearningOsCourse,
  listLearningOsCourses,
  resetLearningOsCourseGeneration,
  retryLearningOsCourseGeneration,
  showLearningOsCourse,
  showLearningOsCourseGenerationStatus,
  storeLearningOsCourse,
  updateLearningOsCourse,
} from './learningOs/courses.js';

const router = Router();

router.use(requireAuth);

router.get('/', listLearningOsCourses);
router.get('/:id', showLearningOsCourse);
router.post('/', blockDemoUser, storeLearningOsCourse);
router.post('/:id/generate', requireEmailVerified, blockDemoUser, generateLearningOsCourse);
router.get('/:id/status', showLearningOsCourseGenerationStatus);
router.post('/:id/reset', resetLearningOsCourseGeneration);
router.post('/:id/retry', blockDemoUser, retryLearningOsCourseGeneration);
router.patch('/:id', updateLearningOsCourse);
router.delete('/:id', blockDemoUser, deleteLearningOsCourse);

export default router;
