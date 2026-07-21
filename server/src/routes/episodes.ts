import { Router } from 'express';

import { requireAuth } from '../middleware/auth.js';
import { blockDemoUser } from '../middleware/demoAuth.js';

import {
  deleteLearningOsEpisode,
  listLearningOsEpisodes,
  showLearningOsEpisode,
  storeLearningOsEpisode,
  updateLearningOsEpisode,
} from './learningOs/episodes.js';

const router = Router();

// All episode routes require authentication
router.use(requireAuth);

// Get all episodes for current user (demo users see admin's content)
router.get('/', listLearningOsEpisodes);

// Get single episode (demo users can view admin's episodes)
router.get('/:id', showLearningOsEpisode);

// Create new episode (blocked for demo users)
router.post('/', blockDemoUser, storeLearningOsEpisode);

// Update episode
router.patch('/:id', updateLearningOsEpisode);

// Delete episode (blocked for demo users)
router.delete('/:id', blockDemoUser, deleteLearningOsEpisode);

export default router;
