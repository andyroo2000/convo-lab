import { Router } from 'express';
import { DEFAULT_SPEAKER_VOICES, DEFAULT_NARRATOR_VOICES } from '@languageflow/shared/src/constants-new.js';

import { prisma } from '../db/client.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { requireAdmin } from '../middleware/roleAuth.js';
import { uploadToGCS } from '../services/storageClient.js';
import {
  synthesizeFishAudioSpeech,
  resolveFishAudioVoiceId,
} from '../services/ttsProviders/FishAudioTTSProvider.js';
import { applyJapanesePronunciationOverrides } from '../services/pronunciation/overrideEngine.js';
import { processJapanese } from '../services/languageProcessor.js';

const router = Router();

// All admin script lab routes require auth + admin
router.use(requireAuth, requireAdmin);

/**
 * POST /api/admin/script-lab/courses
 * Create a new test course
 */
router.post('/courses', async (req: AuthRequest, res, next) => {
  try {
    const {
      title,
      sourceText,
      episodeId,
      targetLanguage = 'ja',
      nativeLanguage = 'en',
      jlptLevel,
      maxDurationMinutes = 30,
      speaker1Gender = 'male',
      speaker2Gender = 'female',
    } = req.body;

    if (!title || !sourceText) {
      throw new AppError('Title and sourceText are required', 400);
    }

    const userId = req.userId!;

    // Create episode if one wasn't provided
    let finalEpisodeId = episodeId;
    if (!finalEpisodeId) {
      const episode = await prisma.episode.create({
        data: {
          userId,
          title,
          sourceText,
          targetLanguage,
          nativeLanguage,
          jlptLevel,
          autoGenerateAudio: false,
          status: 'draft',
        },
      });
      finalEpisodeId = episode.id;
    }

    // Get default voices
    const l1VoiceId = DEFAULT_NARRATOR_VOICES.en;
    const speaker1VoiceId = DEFAULT_SPEAKER_VOICES.ja.speaker1;
    const speaker2VoiceId = DEFAULT_SPEAKER_VOICES.ja.speaker2;

    // Create test course
    const course = await prisma.course.create({
      data: {
        userId,
        title: `[TEST] ${title}`,
        description: `Test course for Script Lab: ${title}`,
        status: 'draft',
        isTestCourse: true, // Mark as test course
        targetLanguage,
        nativeLanguage,
        maxLessonDurationMinutes: maxDurationMinutes,
        l1VoiceId: l1VoiceId,
        l1VoiceProvider: 'fishaudio',
        speaker1Gender,
        speaker2Gender,
        speaker1VoiceId: speaker1VoiceId,
        speaker1VoiceProvider: 'fishaudio',
        speaker2VoiceId: speaker2VoiceId,
        speaker2VoiceProvider: 'fishaudio',
        jlptLevel,
      },
    });

    // Link episode to course
    await prisma.courseEpisode.create({
      data: {
        courseId: course.id,
        episodeId: finalEpisodeId,
        order: 0,
      },
    });

    res.json({
      courseId: course.id,
      isTestCourse: true,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/script-lab/courses
 * List all test courses
 */
router.get('/courses', async (req: AuthRequest, res, next) => {
  try {
    const courses = await prisma.course.findMany({
      where: {
        isTestCourse: true,
      },
      select: {
        id: true,
        title: true,
        status: true,
        createdAt: true,
        scriptJson: true,
        scriptUnitsJson: true,
        audioUrl: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Parse scriptJson to determine pipeline stage
    const coursesWithPipelineStatus = courses.map((course) => {
      let hasExchanges = false;
      let hasScript = false;
      let hasAudio = !!course.audioUrl;

      if (course.scriptJson) {
        const scriptData = course.scriptJson as any;
        if (scriptData._pipelineStage === 'exchanges' || scriptData._exchanges) {
          hasExchanges = true;
        }
        if (scriptData._pipelineStage === 'script' || scriptData._scriptUnits) {
          hasExchanges = true;
          hasScript = true;
        }
      }

      if (course.scriptUnitsJson) {
        hasScript = true;
      }

      return {
        id: course.id,
        title: course.title,
        status: course.status,
        createdAt: course.createdAt,
        hasExchanges,
        hasScript,
        hasAudio,
      };
    });

    res.json({ courses: coursesWithPipelineStatus });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/script-lab/courses/:id
 * Get detailed information about a specific test course
 */
router.get('/courses/:id', async (req: AuthRequest, res, next) => {
  try {
    const course = await prisma.course.findUnique({
      where: {
        id: req.params.id,
        isTestCourse: true,
      },
      include: {
        courseEpisodes: {
          include: {
            episode: true,
          },
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!course) {
      throw new AppError('Test course not found', 404);
    }

    // Parse scriptJson to determine pipeline stage
    let hasExchanges = false;
    let hasScript = false;
    let exchanges = null;
    let scriptUnits = null;

    if (course.scriptJson) {
      const scriptData = course.scriptJson as any;
      if (scriptData._pipelineStage === 'exchanges' || scriptData._exchanges) {
        hasExchanges = true;
        exchanges = scriptData._exchanges || scriptData;
      }
      if (scriptData._pipelineStage === 'script' || scriptData._scriptUnits) {
        hasExchanges = true;
        hasScript = true;
        exchanges = scriptData._exchanges;
        scriptUnits = scriptData._scriptUnits;
      }
    }

    if (course.scriptUnitsJson) {
      hasScript = true;
      scriptUnits = course.scriptUnitsJson;
    }

    const episode = course.courseEpisodes[0]?.episode;

    res.json({
      id: course.id,
      title: course.title,
      description: course.description,
      status: course.status,
      createdAt: course.createdAt,
      jlptLevel: course.jlptLevel,
      hasExchanges,
      hasScript,
      hasAudio: !!course.audioUrl,
      audioUrl: course.audioUrl,
      sourceText: episode?.sourceText || null,
      exchanges,
      scriptUnits,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/admin/script-lab/courses
 * Bulk delete test courses
 */
router.delete('/courses', async (req: AuthRequest, res, next) => {
  try {
    const { courseIds } = req.body;

    if (!Array.isArray(courseIds) || courseIds.length === 0) {
      throw new AppError('courseIds array is required', 400);
    }

    // Verify all courses are test courses
    const courses = await prisma.course.findMany({
      where: {
        id: { in: courseIds },
      },
      select: {
        id: true,
        isTestCourse: true,
      },
    });

    const nonTestCourses = courses.filter((c) => !c.isTestCourse);
    if (nonTestCourses.length > 0) {
      throw new AppError(
        'Cannot delete non-test courses via Script Lab. Use the standard admin interface.',
        400
      );
    }

    // Delete courses (cascade deletes will handle related records)
    const result = await prisma.course.deleteMany({
      where: {
        id: { in: courseIds },
        isTestCourse: true,
      },
    });

    res.json({ deleted: result.count });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/script-lab/test-pronunciation
 * Test audio generation with different text formats
 */
router.post('/test-pronunciation', async (req: AuthRequest, res, next) => {
  try {
    const { text, format, voiceId, speed = 1.0 } = req.body;

    if (!text || !format || !voiceId) {
      throw new AppError('text, format, and voiceId are required', 400);
    }

    const validFormats = ['kanji', 'kana', 'mixed', 'furigana_brackets'];
    if (!validFormats.includes(format)) {
      throw new AppError(
        `Invalid format. Must be one of: ${validFormats.join(', ')}`,
        400
      );
    }

    // Preprocess text based on format
    let preprocessedText = text;

    console.log(`[SCRIPT LAB] Testing format: ${format}, original text: "${text}"`);

    if (format === 'kana') {
      // Strip kanji, keep only kana
      const japaneseMetadata = await processJapanese(text);
      preprocessedText = japaneseMetadata.kana;
      console.log(`[SCRIPT LAB] Kana result: "${preprocessedText}"`);
    } else if (format === 'furigana_brackets') {
      // First get bracket notation from furigana service
      const japaneseMetadata = await processJapanese(text);
      console.log(`[SCRIPT LAB] Raw furigana: "${japaneseMetadata.furigana}"`);

      // Then apply pronunciation overrides to correct any wrong readings
      preprocessedText = applyJapanesePronunciationOverrides({
        text,
        reading: japaneseMetadata.furigana,
        furigana: japaneseMetadata.furigana,
      });
      console.log(`[SCRIPT LAB] Furigana brackets result: "${preprocessedText}"`);
    }
    // 'kanji' and 'mixed' keep text as-is

    // Resolve voice ID (strip fishaudio: prefix if present)
    const resolvedVoiceId = resolveFishAudioVoiceId(voiceId);

    // Generate audio with Fish Audio
    const audioBuffer = await synthesizeFishAudioSpeech({
      referenceId: resolvedVoiceId,
      text: preprocessedText,
      speed: speed,
    });

    // Calculate audio duration (approximate based on text length and speed)
    // Rough estimate: ~150 chars per minute at 1.0 speed
    const charsPerMinute = 150 * speed;
    const durationSeconds = (preprocessedText.length / charsPerMinute) * 60;

    // Upload to GCS
    const timestamp = Date.now();
    const filename = `${timestamp}-${format}.mp3`;
    const audioUrl = await uploadToGCS({
      buffer: audioBuffer,
      filename,
      contentType: 'audio/mpeg',
      folder: 'test-pronunciation',
    });

    res.json({
      preprocessedText,
      audioUrl,
      durationSeconds: Math.round(durationSeconds * 10) / 10, // Round to 1 decimal
      format,
      originalText: text,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
