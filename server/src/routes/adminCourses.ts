import { Router } from 'express';

import { requireAuth } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/roleAuth.js';

import {
  buildLearningOsAdminCoursePrompt,
  buildLearningOsAdminCourseScriptConfig,
  deleteLearningOsAdminCourseLineRendering,
  generateLearningOsAdminCourseAudio,
  generateLearningOsAdminCourseDialogue,
  generateLearningOsAdminCourseScript,
  listLearningOsAdminCourseLineRenderings,
  showLearningOsAdminCoursePipeline,
  streamLearningOsAdminCourseLineRendering,
  synthesizeLearningOsAdminCourseLine,
  updateLearningOsAdminCoursePipeline,
} from './learningOs/admin.js';

const router = Router();

// All admin course routes require auth + admin
router.use(requireAuth, requireAdmin);

router.post('/:id/build-prompt', buildLearningOsAdminCoursePrompt);
router.post('/:id/build-script-config', buildLearningOsAdminCourseScriptConfig);
router.post('/:id/generate-dialogue', generateLearningOsAdminCourseDialogue);
router.post('/:id/generate-script', generateLearningOsAdminCourseScript);
router.post('/:id/generate-audio', generateLearningOsAdminCourseAudio);
router.get('/:id/pipeline-data', showLearningOsAdminCoursePipeline);
router.put('/:id/pipeline-data', updateLearningOsAdminCoursePipeline);
router.post('/:id/synthesize-line', synthesizeLearningOsAdminCourseLine);
router.get('/:id/line-renderings', listLearningOsAdminCourseLineRenderings);
router.get('/:id/line-renderings/:renderingId/audio', streamLearningOsAdminCourseLineRendering);
router.delete('/:id/line-renderings/:renderingId', deleteLearningOsAdminCourseLineRendering);

export default router;
