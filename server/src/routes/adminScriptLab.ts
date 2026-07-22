import {
  DEFAULT_SPEAKER_VOICES,
  DEFAULT_NARRATOR_VOICES,
} from '@languageflow/shared/src/constants-new.js';
import { Router } from 'express';

import { prisma } from '../db/client.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { requireAdmin } from '../middleware/roleAuth.js';
import { generateWithGemini } from '../services/geminiClient.js';
import { applyJapanesePronunciationOverrides } from '../services/pronunciation/overrideEngine.js';
import { generateSentenceScript } from '../services/scriptLabSentenceGenerator.js';
import { uploadToGCS } from '../services/storageClient.js';
import {
  synthesizeFishAudioSpeech,
  resolveFishAudioVoiceId,
} from '../services/ttsProviders/FishAudioTTSProvider.js';

import {
  createLearningOsAdminScriptLabCourse,
  deleteLearningOsAdminScriptLabCourses,
  listLearningOsAdminScriptLabCourses,
  showLearningOsAdminScriptLabCourse,
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
router.post('/test-pronunciation', async (req: AuthRequest, res, next) => {
  try {
    const { text, format, voiceId, speed = 1.0 } = req.body;

    if (!text || !format || !voiceId) {
      throw new AppError('text, format, and voiceId are required', 400);
    }

    const validFormats = ['kanji', 'kana', 'mixed', 'furigana_brackets'];
    if (!validFormats.includes(format)) {
      throw new AppError(`Invalid format. Must be one of: ${validFormats.join(', ')}`, 400);
    }

    // Preprocess text based on format
    let preprocessedText = text;

    /* eslint-disable no-console */
    console.log(`[SCRIPT LAB] Testing format: ${format}, original text: "${text}"`);

    if (format === 'kana' || format === 'furigana_brackets') {
      const formatDesc =
        format === 'kana'
          ? 'pure hiragana (replace all kanji with their hiragana readings)'
          : 'bracket-notation furigana where each kanji word is followed by [hiragana reading]. Example: 北海道[ほっかいどう]に行[い]った。 Hiragana/katakana/punctuation stay as-is.';
      const prompt = `Convert this Japanese text to ${formatDesc}. Return ONLY the converted text, no explanation.\n\nText: "${text}"`;
      const result = await generateWithGemini(prompt);
      preprocessedText = result.trim();
      console.log(`[SCRIPT LAB] Gemini ${format} result: "${preprocessedText}"`);

      // Apply pronunciation overrides for consistency
      preprocessedText = applyJapanesePronunciationOverrides({
        text,
        reading: preprocessedText,
        furigana: format === 'furigana_brackets' ? preprocessedText : null,
      });
      console.log(`[SCRIPT LAB] After overrides: "${preprocessedText}"`);
    }
    /* eslint-enable no-console */
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

/**
 * POST /api/admin/script-lab/sentence-script
 * Generate a single-sentence Pimsleur-style script for prompt iteration
 */
router.post('/sentence-script', async (req: AuthRequest, res, next) => {
  try {
    const {
      sentence,
      translation,
      targetLanguage = 'ja',
      nativeLanguage = 'en',
      jlptLevel,
      promptOverride,
      l1VoiceId,
      l2VoiceId,
    } = req.body;

    if (!sentence || typeof sentence !== 'string' || !sentence.trim()) {
      throw new AppError('sentence is required', 400);
    }

    const resolvedL1VoiceId =
      typeof l1VoiceId === 'string' && l1VoiceId.trim()
        ? l1VoiceId.trim()
        : DEFAULT_NARRATOR_VOICES.en;
    const resolvedL2VoiceId =
      typeof l2VoiceId === 'string' && l2VoiceId.trim()
        ? l2VoiceId.trim()
        : DEFAULT_SPEAKER_VOICES.ja.speaker1;
    const resolvedTranslation = typeof translation === 'string' ? translation.trim() : undefined;
    const resolvedPromptOverride = typeof promptOverride === 'string' ? promptOverride : undefined;

    const result = await generateSentenceScript({
      sentence: sentence.trim(),
      translation: resolvedTranslation,
      targetLanguage,
      nativeLanguage,
      jlptLevel,
      l1VoiceId: resolvedL1VoiceId,
      l2VoiceId: resolvedL2VoiceId,
      promptOverride: resolvedPromptOverride,
    });

    // Persist the test result
    const testRecord = await prisma.sentenceScriptTest.create({
      data: {
        userId: req.userId!,
        sentence: sentence.trim(),
        translation: result.translation,
        targetLanguage,
        nativeLanguage,
        jlptLevel: jlptLevel || null,
        l1VoiceId: resolvedL1VoiceId,
        l2VoiceId: resolvedL2VoiceId,
        promptTemplate: result.resolvedPrompt,
        unitsJson: result.units ?? undefined,
        rawResponse: result.rawResponse,
        estimatedDurationSecs: result.estimatedDurationSeconds,
        parseError: result.parseError || null,
      },
    });

    res.json({ ...result, testId: testRecord.id });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/script-lab/sentence-tests
 * Paginated list of past sentence-script test results (summary fields only)
 */
router.get('/sentence-tests', async (req: AuthRequest, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;

    const tests = await prisma.sentenceScriptTest.findMany({
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        sentence: true,
        translation: true,
        estimatedDurationSecs: true,
        parseError: true,
        createdAt: true,
      },
    });

    const hasMore = tests.length > limit;
    if (hasMore) tests.pop();

    res.json({
      tests,
      nextCursor: hasMore ? tests[tests.length - 1]?.id : null,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/script-lab/sentence-tests/:id
 * Full record for a single past test
 */
router.get('/sentence-tests/:id', async (req: AuthRequest, res, next) => {
  try {
    const test = await prisma.sentenceScriptTest.findUnique({
      where: { id: req.params.id },
    });

    if (!test) {
      throw new AppError('Sentence test not found', 404);
    }

    res.json(test);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/admin/script-lab/sentence-tests
 * Bulk delete sentence-script test results
 */
router.delete('/sentence-tests', async (req: AuthRequest, res, next) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      throw new AppError('ids array is required', 400);
    }

    const result = await prisma.sentenceScriptTest.deleteMany({
      where: { id: { in: ids } },
    });

    res.json({ deleted: result.count });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/script-lab/synthesize-line
 * Synthesize a single line of text using Fish Audio TTS (no course required)
 */
router.post('/synthesize-line', async (req: AuthRequest, res, next) => {
  try {
    const { text, voiceId, speed } = req.body;

    if (!text || !voiceId) {
      throw new AppError('text and voiceId are required', 400);
    }

    if (!voiceId.startsWith('fishaudio:')) {
      throw new AppError('Only Fish Audio voices are supported for line synthesis', 400);
    }

    const referenceId = resolveFishAudioVoiceId(voiceId);
    const audioBuffer = await synthesizeFishAudioSpeech({
      referenceId,
      text,
      speed: speed || 1.0,
    });

    const filename = `${Date.now()}-script-lab-line.mp3`;
    const audioUrl = await uploadToGCS({
      buffer: audioBuffer,
      filename,
      contentType: 'audio/mpeg',
      folder: 'script-lab/line-tests',
    });

    res.json({ audioUrl });
  } catch (error) {
    next(error);
  }
});

export default router;
