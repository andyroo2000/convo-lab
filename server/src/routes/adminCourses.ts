import { DEFAULT_SPEAKER_VOICES } from '@languageflow/shared/src/constants-new.js';
import { Prisma } from '@prisma/client';
import { Router } from 'express';

import { prisma } from '../db/client.js';
import { courseQueue } from '../jobs/courseQueue.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { requireAdmin } from '../middleware/roleAuth.js';
import { generateConversationalLessonScript } from '../services/conversationalLessonScriptGenerator.js';
import {
  buildDialogueExtractionPrompt,
  runDialogueExtraction,
  DialogueExchange,
} from '../services/courseItemExtractor.js';
import { addReadingBrackets } from '../services/furiganaService.js';
import { LessonScriptUnit } from '../services/lessonScriptGenerator.js';
import { DEFAULT_SCRIPT_CONFIG, buildScriptConfig } from '../services/scriptGenerationConfig.js';
import { proofreadScript } from '../services/scriptProofreader.js';
import { uploadToGCS } from '../services/storageClient.js';
import {
  synthesizeFishAudioSpeech,
  resolveFishAudioVoiceId,
} from '../services/ttsProviders/FishAudioTTSProvider.js';
import { triggerWorkerJob } from '../services/workerTrigger.js';

const router = Router();

// All admin course routes require auth + admin
router.use(requireAuth, requireAdmin);

/**
 * POST /:id/build-prompt
 * Build and return the dialogue extraction prompt with fresh vocabulary/grammar seeds
 */
router.post('/:id/build-prompt', async (req: AuthRequest, res, next) => {
  try {
    const course = await prisma.course.findUnique({
      where: { id: req.params.id },
      include: {
        courseEpisodes: {
          include: { episode: true },
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!course) {
      throw new AppError('Course not found', 404);
    }

    const firstEpisode = course.courseEpisodes[0]?.episode;
    if (!firstEpisode?.sourceText) {
      throw new AppError('Course has no episode with source text', 400);
    }

    const result = await buildDialogueExtractionPrompt(
      firstEpisode.sourceText,
      firstEpisode.title,
      course.targetLanguage,
      course.nativeLanguage,
      course.maxLessonDurationMinutes,
      course.jlptLevel || undefined,
      (course.speaker1Gender as 'male' | 'female') || 'male',
      (course.speaker2Gender as 'male' | 'female') || 'female'
    );

    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /:id/build-script-config
 * Build and return the script generation configuration with course-specific values
 */
router.post('/:id/build-script-config', async (req: AuthRequest, res, next) => {
  try {
    const course = await prisma.course.findUnique({
      where: { id: req.params.id },
      include: {
        courseEpisodes: {
          include: { episode: true },
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!course) {
      throw new AppError('Course not found', 404);
    }

    const firstEpisode = course.courseEpisodes[0]?.episode;

    const config = buildScriptConfig(DEFAULT_SCRIPT_CONFIG, {
      targetLanguage: course.targetLanguage,
      nativeLanguage: course.nativeLanguage,
      episodeTitle: firstEpisode?.title || course.title,
      jlptLevel: course.jlptLevel || undefined,
    });

    res.json({ config });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /:id/generate-dialogue
 * Run dialogue extraction with optional custom prompt. Save exchanges to scriptJson.
 */
router.post('/:id/generate-dialogue', async (req: AuthRequest, res, next) => {
  try {
    const { customPrompt } = req.body;

    const course = await prisma.course.findUnique({
      where: { id: req.params.id },
      include: {
        courseEpisodes: {
          include: {
            episode: {
              include: {
                dialogue: { include: { speakers: true } },
              },
            },
          },
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!course) {
      throw new AppError('Course not found', 404);
    }

    const firstEpisode = course.courseEpisodes[0]?.episode;
    if (!firstEpisode?.sourceText) {
      throw new AppError('Course has no episode with source text', 400);
    }

    // Use custom prompt or build a fresh one
    let prompt = customPrompt;
    if (!prompt) {
      const result = await buildDialogueExtractionPrompt(
        firstEpisode.sourceText,
        firstEpisode.title,
        course.targetLanguage,
        course.nativeLanguage,
        course.maxLessonDurationMinutes,
        course.jlptLevel || undefined,
        (course.speaker1Gender as 'male' | 'female') || 'male',
        (course.speaker2Gender as 'male' | 'female') || 'female'
      );
      prompt = result.prompt;
    }

    // Get speaker voices from existing dialogue if available
    const speakerVoices =
      firstEpisode.dialogue?.speakers?.map((speaker) => ({
        speakerName: speaker.name,
        voiceId: speaker.voiceId,
      })) || [];

    const langDefaults = DEFAULT_SPEAKER_VOICES[course.targetLanguage];
    const speaker1Voice = course.speaker1VoiceId || langDefaults?.speaker1 || undefined;
    const speaker2Voice = course.speaker2VoiceId || langDefaults?.speaker2 || undefined;

    const exchanges = await runDialogueExtraction(
      prompt,
      course.targetLanguage,
      (course.speaker1Gender as 'male' | 'female') || 'male',
      (course.speaker2Gender as 'male' | 'female') || 'female',
      speakerVoices,
      speaker1Voice,
      speaker2Voice
    );

    // Save exchanges to scriptJson with pipeline stage marker
    await prisma.course.update({
      where: { id: course.id },
      data: {
        scriptJson: {
          _pipelineStage: 'exchanges',
          _exchanges: exchanges,
        } as unknown as Prisma.JsonValue,
        // Clear audio since we're regenerating
        audioUrl: null,
        timingData: Prisma.JsonNull,
      },
    });

    res.json({ exchanges });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /:id/generate-script
 * Generate script units from saved exchanges. Proofread + normalize furigana.
 * Delete + recreate CourseCoreItems.
 */
router.post('/:id/generate-script', async (req: AuthRequest, res, next) => {
  try {
    const course = await prisma.course.findUnique({
      where: { id: req.params.id },
      include: {
        courseEpisodes: {
          include: { episode: true },
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!course) {
      throw new AppError('Course not found', 404);
    }

    // Read exchanges from scriptJson
    const scriptJson = course.scriptJson as Record<string, unknown> | null;
    if (
      !scriptJson ||
      scriptJson._pipelineStage !== 'exchanges' ||
      !Array.isArray(scriptJson._exchanges)
    ) {
      throw new AppError('No dialogue exchanges found. Generate dialogue first.', 400);
    }

    const exchanges = scriptJson._exchanges as DialogueExchange[];
    const firstEpisode = course.courseEpisodes[0]?.episode;

    // Build speaker voice ID map
    const l2VoiceIds: Record<string, string> = {};
    for (const exchange of exchanges) {
      l2VoiceIds[exchange.speakerName] = exchange.speakerVoiceId;
    }

    // Generate conversational script
    const generatedScript = await generateConversationalLessonScript(
      exchanges,
      {
        episodeTitle: firstEpisode?.title || course.title,
        targetLanguage: course.targetLanguage,
        nativeLanguage: course.nativeLanguage,
        l1VoiceId: course.l1VoiceId,
        l2VoiceIds,
        jlptLevel: course.jlptLevel || undefined,
      },
      course.maxLessonDurationMinutes * 60
    );

    // Proofread
    let scriptUnits = generatedScript.units;
    await proofreadScript(scriptUnits, course.jlptLevel || undefined);

    // Normalize Japanese readings
    if (course.targetLanguage === 'ja') {
      scriptUnits = await Promise.all(
        scriptUnits.map(async (unit) => {
          if (unit.type !== 'L2' || !unit.text.trim()) {
            return unit;
          }
          if (unit.reading && unit.reading.trim()) {
            return unit;
          }
          const reading = await addReadingBrackets(unit.text, 'ja');
          return { ...unit, reading };
        })
      );
    }

    // Save script to course (with pipeline stage marker)
    await prisma.course.update({
      where: { id: course.id },
      data: {
        scriptJson: {
          _pipelineStage: 'script',
          _exchanges: exchanges,
          _scriptUnits: scriptUnits,
        } as unknown as Prisma.JsonValue,
        approxDurationSeconds: generatedScript.estimatedDurationSeconds,
        // Clear audio since we're regenerating
        audioUrl: null,
        timingData: Prisma.JsonNull,
      },
    });

    // Delete existing CourseCoreItems and recreate from exchanges
    await prisma.courseCoreItem.deleteMany({
      where: { courseId: course.id },
    });

    // Extract vocabulary from exchanges
    const vocabularyItems: Array<{
      textL2: string;
      readingL2: string | null;
      translationL1: string;
    }> = [];

    for (const exchange of exchanges) {
      if (exchange.vocabularyItems?.length) {
        for (const vocab of exchange.vocabularyItems) {
          vocabularyItems.push({
            textL2: vocab.textL2,
            readingL2: vocab.readingL2 || null,
            translationL1: vocab.translationL1,
          });
        }
      }
    }

    if (vocabularyItems.length > 0 && firstEpisode) {
      await prisma.courseCoreItem.createMany({
        data: vocabularyItems.map((item, idx) => ({
          courseId: course.id,
          textL2: item.textL2,
          readingL2: item.readingL2,
          translationL1: item.translationL1,
          complexityScore: idx,
          sourceEpisodeId: firstEpisode.id,
          sourceSentenceId: null,
        })),
      });
    }

    res.json({
      scriptUnits,
      estimatedDurationSeconds: generatedScript.estimatedDurationSeconds,
      vocabularyItemCount: vocabularyItems.length,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /:id/generate-audio
 * Queue audio assembly job with audioOnly flag.
 */
router.post('/:id/generate-audio', async (req: AuthRequest, res, next) => {
  try {
    const course = await prisma.course.findUnique({
      where: { id: req.params.id },
    });

    if (!course) {
      throw new AppError('Course not found', 404);
    }

    // Read scriptJson and prepare it for audio assembly
    const scriptJson = course.scriptJson as Record<string, unknown> | null;
    if (!scriptJson) {
      throw new AppError('No script data found. Generate script first.', 400);
    }

    // Extract script units from pipeline format and save as flat array for audio assembly
    let scriptUnits: LessonScriptUnit[];
    if (scriptJson._pipelineStage === 'script' && Array.isArray(scriptJson._scriptUnits)) {
      scriptUnits = scriptJson._scriptUnits as LessonScriptUnit[];
    } else if (Array.isArray(scriptJson)) {
      // Already a flat array of script units
      scriptUnits = scriptJson as unknown as LessonScriptUnit[];
    } else {
      throw new AppError(
        'Script data is not in the correct format for audio generation. Generate script first.',
        400
      );
    }

    // Save script units to scriptUnitsJson (separate from pipeline data in scriptJson)
    await prisma.course.update({
      where: { id: course.id },
      data: {
        scriptUnitsJson: scriptUnits as unknown as Prisma.JsonValue,
        status: 'generating',
      },
    });

    // Queue audio-only job
    const job = await courseQueue.add('generate-audio', {
      courseId: course.id,
      audioOnly: true,
    });

    // Trigger worker
    triggerWorkerJob().catch((err) => console.error('Worker trigger failed:', err));

    res.json({
      message: 'Audio generation started',
      jobId: job.id,
      courseId: course.id,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /:id/pipeline-data
 * Return current scriptJson with pipeline stage info
 */
router.get('/:id/pipeline-data', async (req: AuthRequest, res, next) => {
  try {
    const course = await prisma.course.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        status: true,
        scriptJson: true,
        scriptUnitsJson: true,
        audioUrl: true,
        approxDurationSeconds: true,
      },
    });

    if (!course) {
      throw new AppError('Course not found', 404);
    }

    const scriptJson = course.scriptJson as Record<string, unknown> | null;

    // Determine pipeline stage
    let stage: string | null = null;
    let exchanges: DialogueExchange[] | null = null;
    let scriptUnits: LessonScriptUnit[] | null = null;

    if (scriptJson) {
      if (scriptJson._pipelineStage === 'exchanges') {
        stage = 'exchanges';
        exchanges = (scriptJson._exchanges as DialogueExchange[]) || null;
      } else if (scriptJson._pipelineStage === 'script') {
        stage = 'script';
        exchanges = (scriptJson._exchanges as DialogueExchange[]) || null;
        scriptUnits = (scriptJson._scriptUnits as LessonScriptUnit[]) || null;
      } else if (Array.isArray(scriptJson)) {
        // Legacy: flat array = script units (old format before scriptUnitsJson)
        stage = 'script';
        scriptUnits = scriptJson as unknown as LessonScriptUnit[];
      }
    }

    // Fallback: if no script units from scriptJson, try scriptUnitsJson
    if (!scriptUnits && course.scriptUnitsJson && Array.isArray(course.scriptUnitsJson)) {
      stage = stage || 'script';
      scriptUnits = course.scriptUnitsJson as unknown as LessonScriptUnit[];
    }

    res.json({
      id: course.id,
      status: course.status,
      stage,
      exchanges,
      scriptUnits,
      audioUrl: course.audioUrl,
      approxDurationSeconds: course.approxDurationSeconds,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /:id/pipeline-data
 * Update scriptJson with edited exchanges or script.
 */
router.put('/:id/pipeline-data', async (req: AuthRequest, res, next) => {
  try {
    const { stage, data } = req.body;

    if (!stage || !data) {
      throw new AppError('Missing stage or data in request body', 400);
    }

    const course = await prisma.course.findUnique({
      where: { id: req.params.id },
    });

    if (!course) {
      throw new AppError('Course not found', 404);
    }

    const existingJson = (course.scriptJson as Record<string, unknown>) || {};

    if (stage === 'exchanges') {
      await prisma.course.update({
        where: { id: course.id },
        data: {
          scriptJson: {
            _pipelineStage: 'exchanges',
            _exchanges: data,
          } as unknown as Prisma.JsonValue,
          // Clear audio and script since exchanges changed
          audioUrl: null,
          timingData: Prisma.JsonNull,
        },
      });
    } else if (stage === 'script') {
      await prisma.course.update({
        where: { id: course.id },
        data: {
          scriptJson: {
            _pipelineStage: 'script',
            _exchanges: existingJson._exchanges || [],
            _scriptUnits: data,
          } as unknown as Prisma.JsonValue,
          // Clear audio since script changed
          audioUrl: null,
          timingData: Prisma.JsonNull,
        },
      });
    } else {
      throw new AppError('Invalid stage. Must be "exchanges" or "script"', 400);
    }

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

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
