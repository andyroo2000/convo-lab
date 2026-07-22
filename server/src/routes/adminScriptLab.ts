import { Router } from 'express';

import { requireAuth } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/roleAuth.js';

import {
  createLearningOsAdminScriptLabCourse,
  deleteLearningOsAdminSentenceScriptTests,
  deleteLearningOsAdminScriptLabCourses,
  generateLearningOsAdminSentenceScript,
  listLearningOsAdminSentenceScriptTests,
  listLearningOsAdminScriptLabCourses,
  showLearningOsAdminSentenceScriptTest,
  showLearningOsAdminScriptLabCourse,
  streamLearningOsAdminScriptLabAudio,
  synthesizeLearningOsAdminScriptLabLine,
  testLearningOsAdminPronunciation,
} from './learningOs/admin.js';

const router = Router();

// All admin script lab routes require auth + admin
router.use(requireAuth, requireAdmin);

router.post('/courses', createLearningOsAdminScriptLabCourse);
router.get('/courses', listLearningOsAdminScriptLabCourses);
router.get('/courses/:id', showLearningOsAdminScriptLabCourse);
router.delete('/courses', deleteLearningOsAdminScriptLabCourses);

/**
 * POST /api/admin/script-lab/test-pronunciation
 * Test audio generation with different text formats
 */
router.post('/test-pronunciation', testLearningOsAdminPronunciation);

/**
 * POST /api/admin/script-lab/sentence-script
 * Generate a single-sentence Pimsleur-style script for prompt iteration
 */
router.post('/sentence-script', generateLearningOsAdminSentenceScript);

/**
 * GET /api/admin/script-lab/sentence-tests
 * Paginated list of past sentence-script test results (summary fields only)
 */
router.get('/sentence-tests', listLearningOsAdminSentenceScriptTests);

/**
 * GET /api/admin/script-lab/sentence-tests/:id
 * Full record for a single past test
 */
router.get('/sentence-tests/:id', showLearningOsAdminSentenceScriptTest);

/**
 * DELETE /api/admin/script-lab/sentence-tests
 * Bulk delete sentence-script test results
 */
router.delete('/sentence-tests', deleteLearningOsAdminSentenceScriptTests);

/**
 * POST /api/admin/script-lab/synthesize-line
 * Synthesize a single line of text using Fish Audio TTS (no course required)
 */
router.post('/synthesize-line', synthesizeLearningOsAdminScriptLabLine);
router.get('/audio/:renderingId', streamLearningOsAdminScriptLabAudio);

export default router;
