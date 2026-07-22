import { Router } from 'express';

import { prisma } from '../db/client.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { requireAdmin } from '../middleware/roleAuth.js';
import { uploadToGCS } from '../services/storageClient.js';
import {
  synthesizeFishAudioSpeech,
  resolveFishAudioVoiceId,
} from '../services/ttsProviders/FishAudioTTSProvider.js';

import {
  buildLearningOsAdminCoursePrompt,
  buildLearningOsAdminCourseScriptConfig,
  generateLearningOsAdminCourseAudio,
  generateLearningOsAdminCourseDialogue,
  generateLearningOsAdminCourseScript,
  showLearningOsAdminCoursePipeline,
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

/**
 * POST /:id/synthesize-line
 * Synthesize a single line of text using Fish Audio TTS.
 * Saves result as a LineAudioRendering record.
 */
router.post('/:id/synthesize-line', async (req: AuthRequest, res, next) => {
  try {
    const { text, voiceId, speed, unitIndex } = req.body;

    if (!text || !voiceId || unitIndex === undefined) {
      throw new AppError('Missing required fields: text, voiceId, unitIndex', 400);
    }

    const course = await prisma.course.findUnique({
      where: { id: req.params.id },
    });

    if (!course) {
      throw new AppError('Course not found', 404);
    }

    if (!voiceId.startsWith('fishaudio:')) {
      throw new AppError('Only Fish Audio voices are supported for line synthesis', 400);
    }

    const referenceId = resolveFishAudioVoiceId(voiceId);
    const DEFAULT_SPEED = 1.0;
    const audioBuffer = await synthesizeFishAudioSpeech({
      referenceId,
      text,
      speed: speed || DEFAULT_SPEED,
    });

    const audioUrl = await uploadToGCS({
      buffer: audioBuffer,
      filename: `line-${unitIndex}.mp3`,
      contentType: 'audio/mpeg',
      folder: `courses/${course.id}/line-tests`,
    });

    const rendering = await prisma.lineAudioRendering.create({
      data: {
        courseId: course.id,
        unitIndex,
        text,
        speed: speed || DEFAULT_SPEED,
        voiceId,
        audioUrl,
      },
    });

    res.json({ audioUrl, renderingId: rendering.id });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /:id/line-renderings
 * Return all line audio renderings for a course.
 */
router.get('/:id/line-renderings', async (req: AuthRequest, res, next) => {
  try {
    const course = await prisma.course.findUnique({
      where: { id: req.params.id },
    });

    if (!course) {
      throw new AppError('Course not found', 404);
    }

    const renderings = await prisma.lineAudioRendering.findMany({
      where: { courseId: course.id },
      orderBy: [{ unitIndex: 'asc' }, { createdAt: 'desc' }],
    });

    res.json({ renderings });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /:id/line-renderings/:renderingId
 * Delete a specific line audio rendering.
 */
router.delete('/:id/line-renderings/:renderingId', async (req: AuthRequest, res, next) => {
  try {
    const rendering = await prisma.lineAudioRendering.findUnique({
      where: { id: req.params.renderingId },
    });

    if (!rendering || rendering.courseId !== req.params.id) {
      throw new AppError('Rendering not found', 404);
    }

    await prisma.lineAudioRendering.delete({
      where: { id: rendering.id },
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;
