import { Router } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { blockDemoUser } from '../middleware/demoAuth.js';
import { prisma } from '../db/client.js';
import { AppError } from '../middleware/errorHandler.js';
import { reviewCard, getDueCards, getDeckStats } from '../services/srsService.js';
import { extractVocabularyAudio } from '../services/audioExtractorService.js';

const router = Router();
router.use(requireAuth);

/**
 * Creates furigana bracket notation that only annotates kanji, not hiragana
 * Input: textL2="お正月休み", readingL2="おしょうがつやすみ"
 * Output: "お正月[しょうがつ]休[やす]み"
 */
function createFuriganaBracketNotation(textL2: string, readingL2: string): string {
  // Find hiragana characters in textL2 that can serve as anchors for alignment
  const anchors: Array<{ textPos: number; readingPos: number; char: string }> = [];

  for (let i = 0; i < textL2.length; i++) {
    const char = textL2[i];
    // Check if this is a hiragana character
    if (/[\u3040-\u309F]/.test(char)) {
      // Find this character in the reading, starting after the last anchor
      const lastReadingPos = anchors.length > 0 ? anchors[anchors.length - 1].readingPos + 1 : 0;
      const readingPos = readingL2.indexOf(char, lastReadingPos);

      if (readingPos !== -1) {
        anchors.push({ textPos: i, readingPos, char });
      }
    }
  }

  // Build the result using anchors to separate kanji blocks from hiragana
  let result = '';
  let textPos = 0;
  let readingPos = 0;

  for (const anchor of anchors) {
    // Process any kanji before this anchor
    if (textPos < anchor.textPos) {
      const kanjiBlock = textL2.substring(textPos, anchor.textPos);
      const kanjiReading = readingL2.substring(readingPos, anchor.readingPos);

      // Only add brackets if it's actually kanji
      if (/[\u4E00-\u9FAF]/.test(kanjiBlock)) {
        result += `${kanjiBlock}[${kanjiReading}]`;
      } else {
        result += kanjiBlock;
      }
    }

    // Add the anchor hiragana (no brackets needed)
    result += anchor.char;
    textPos = anchor.textPos + 1;
    readingPos = anchor.readingPos + 1;
  }

  // Process any remaining kanji at the end
  if (textPos < textL2.length) {
    const remainingText = textL2.substring(textPos);
    const remainingReading = readingL2.substring(readingPos);

    if (/[\u4E00-\u9FAF]/.test(remainingText)) {
      result += `${remainingText}[${remainingReading}]`;
    } else {
      result += remainingText;
    }
  }

  return result;
}

// GET /api/srs/decks - Get all decks for current user
router.get('/decks', async (req: AuthRequest, res, next) => {
  try {
    const decks = await prisma.deck.findMany({
      where: { userId: req.userId },
      include: {
        _count: {
          select: { cards: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(decks);
  } catch (error) {
    next(error);
  }
});

// GET /api/srs/decks/:deckId - Get deck with stats
router.get('/decks/:deckId', async (req: AuthRequest, res, next) => {
  try {
    const deck = await prisma.deck.findFirst({
      where: { id: req.params.deckId, userId: req.userId },
    });

    if (!deck) {
      throw new AppError('Deck not found', 404);
    }

    const stats = await getDeckStats(req.userId!, deck.id);

    res.json({ ...deck, stats });
  } catch (error) {
    next(error);
  }
});

// POST /api/srs/decks - Create or get deck for language
router.post('/decks', blockDemoUser, async (req: AuthRequest, res, next) => {
  try {
    const { language, name, description } = req.body;

    if (!language) {
      throw new AppError('Language is required', 400);
    }

    // Find or create deck for this language
    const deck = await prisma.deck.upsert({
      where: {
        userId_language: {
          userId: req.userId!,
          language,
        },
      },
      create: {
        userId: req.userId!,
        language,
        name: name || `${language.toUpperCase()} Vocabulary`,
        description,
      },
      update: {
        name: name || undefined,
        description: description || undefined,
      },
    });

    res.json(deck);
  } catch (error) {
    next(error);
  }
});

// POST /api/srs/cards - Create card from CourseCoreItem
router.post('/cards', blockDemoUser, async (req: AuthRequest, res, next) => {
  try {
    const { coreItemId, enableRecognition = true, enableAudio = true } = req.body;

    if (!coreItemId) {
      throw new AppError('coreItemId is required', 400);
    }

    // Get core item
    const coreItem = await prisma.courseCoreItem.findUnique({
      where: { id: coreItemId },
      include: { course: true },
    });

    if (!coreItem) {
      throw new AppError('Core vocabulary item not found', 404);
    }

    // Fix readingL2 format: convert pure kana to bracket notation
    let readingL2 = coreItem.readingL2;
    if (readingL2 && !readingL2.includes('[') && readingL2 !== coreItem.textL2) {
      // readingL2 is pure kana - we need to create proper bracket notation
      // that only adds furigana to kanji, not hiragana
      readingL2 = createFuriganaBracketNotation(coreItem.textL2, readingL2);
      console.log(`Converted reading from pure kana to bracket notation: ${readingL2}`);
    }

    // Get audio from source sentence
    let audioUrl = null;
    console.log('Creating card for:', {
      textL2: coreItem.textL2,
      readingL2: coreItem.readingL2,
      generatedReadingL2: readingL2,
      sourceSentenceId: coreItem.sourceSentenceId,
    });

    if (coreItem.sourceSentenceId) {
      const sentence = await prisma.sentence.findUnique({
        where: { id: coreItem.sourceSentenceId },
        select: {
          audioUrl: true,
          audioUrl_0_85: true,
        },
      });
      audioUrl = sentence?.audioUrl_0_85 || sentence?.audioUrl;
      console.log('Retrieved audio from sourceSentenceId:', audioUrl);
    } else {
      // Fallback: search for a sentence containing this vocabulary
      console.log('No sourceSentenceId, searching for sentence containing:', coreItem.textL2);

      if (coreItem.sourceEpisodeId) {
        // First find the dialogue for this episode
        const dialogue = await prisma.dialogue.findUnique({
          where: { episodeId: coreItem.sourceEpisodeId },
        });

        if (dialogue) {
          // Then search for sentence in that dialogue
          const sentence = await prisma.sentence.findFirst({
            where: {
              dialogueId: dialogue.id,
              text: {
                contains: coreItem.textL2,
              },
            },
            select: {
              audioUrl: true,
              audioUrl_0_85: true,
            },
            orderBy: {
              order: 'asc', // Get first occurrence
            },
          });

          if (sentence) {
            audioUrl = sentence.audioUrl_0_85 || sentence.audioUrl;
            console.log('Found sentence containing vocab, using audio:', audioUrl);
          } else {
            console.warn('No sentence found containing:', coreItem.textL2);
          }
        } else {
          console.warn('No dialogue found for episodeId:', coreItem.sourceEpisodeId);
          console.warn('This is likely a Course episode which does not have per-sentence audio.');
          console.warn('Course vocabulary audio would need to be generated separately or extracted from course audio.');
        }
      }
    }

    // If still no audio found, try extracting from course audio
    if (!audioUrl) {
      console.log(`Attempting to extract audio from course for "${coreItem.textL2}"`);
      audioUrl = await extractVocabularyAudio(coreItemId);

      if (!audioUrl) {
        console.warn(`No audio found for vocabulary "${coreItem.textL2}". Consider generating TTS audio for vocabulary cards.`);
      }
    }

    // Create or get deck for this language
    const deck = await prisma.deck.upsert({
      where: {
        userId_language: {
          userId: req.userId!,
          language: coreItem.course.targetLanguage,
        },
      },
      create: {
        userId: req.userId!,
        language: coreItem.course.targetLanguage,
        name: `${coreItem.course.targetLanguage.toUpperCase()} Vocabulary`,
      },
      update: {},
    });

    // Check for existing card
    const existingCard = await prisma.card.findFirst({
      where: { userId: req.userId, coreItemId },
    });

    if (existingCard) {
      throw new AppError('Card already exists for this vocabulary item', 400);
    }

    // Create card with denormalized data
    const card = await prisma.card.create({
      data: {
        deckId: deck.id,
        userId: req.userId!,
        coreItemId,
        textL2: coreItem.textL2,
        readingL2, // Use the generated bracket notation
        translationL1: coreItem.translationL1,
        audioUrl,
        enableRecognition,
        enableAudio,
      },
    });

    res.json(card);
  } catch (error) {
    next(error);
  }
});

// GET /api/srs/cards - Get cards for user (with optional filters)
router.get('/cards', async (req: AuthRequest, res, next) => {
  try {
    const { deckId, coreItemId } = req.query;

    const where: any = { userId: req.userId };

    if (deckId) {
      where.deckId = deckId as string;
    }

    if (coreItemId) {
      where.coreItemId = coreItemId as string;
    }

    const cards = await prisma.card.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    res.json(cards);
  } catch (error) {
    next(error);
  }
});

// PUT /api/srs/cards/:cardId - Update card
router.put('/cards/:cardId', blockDemoUser, async (req: AuthRequest, res, next) => {
  try {
    const { cardId } = req.params;
    const { textL2, readingL2, translationL1, enableRecognition, enableAudio } = req.body;

    // Verify card belongs to user
    const existingCard = await prisma.card.findFirst({
      where: { id: cardId, userId: req.userId },
    });

    if (!existingCard) {
      throw new AppError('Card not found', 404);
    }

    // Update card
    const card = await prisma.card.update({
      where: { id: cardId },
      data: {
        textL2: textL2 !== undefined ? textL2 : undefined,
        readingL2: readingL2 !== undefined ? readingL2 : undefined,
        translationL1: translationL1 !== undefined ? translationL1 : undefined,
        enableRecognition: enableRecognition !== undefined ? enableRecognition : undefined,
        enableAudio: enableAudio !== undefined ? enableAudio : undefined,
      },
    });

    res.json(card);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/srs/cards/:cardId - Delete card
router.delete('/cards/:cardId', blockDemoUser, async (req: AuthRequest, res, next) => {
  try {
    const { cardId } = req.params;

    // Verify card belongs to user
    const existingCard = await prisma.card.findFirst({
      where: { id: cardId, userId: req.userId },
    });

    if (!existingCard) {
      throw new AppError('Card not found', 404);
    }

    // Delete card (reviews will cascade delete)
    await prisma.card.delete({
      where: { id: cardId },
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// GET /api/srs/decks/:deckId/due - Get due cards for review
router.get('/decks/:deckId/due', async (req: AuthRequest, res, next) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;

    const cards = await getDueCards(req.userId!, req.params.deckId, limit);

    res.json(cards);
  } catch (error) {
    next(error);
  }
});

// POST /api/srs/reviews - Submit card review
router.post('/reviews', async (req: AuthRequest, res, next) => {
  try {
    const { cardId, cardType, rating, durationMs } = req.body;

    if (!cardId || !cardType || !rating) {
      throw new AppError('cardId, cardType, and rating are required', 400);
    }

    if (!['recognition', 'audio'].includes(cardType)) {
      throw new AppError('Invalid card type', 400);
    }

    if (![1, 2, 3, 4].includes(rating)) {
      throw new AppError('Invalid rating (must be 1-4)', 400);
    }

    const result = await reviewCard({
      cardId,
      userId: req.userId!,
      cardType,
      rating,
      durationMs,
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

// GET /api/srs/stats - Get overall SRS statistics
router.get('/stats', async (req: AuthRequest, res, next) => {
  try {
    const totalCards = await prisma.card.count({ where: { userId: req.userId } });
    const totalReviews = await prisma.review.count({ where: { userId: req.userId } });

    const recentReviews = await prisma.review.findMany({
      where: { userId: req.userId },
      orderBy: { reviewedAt: 'desc' },
      take: 10,
      include: {
        card: {
          select: {
            textL2: true,
            translationL1: true,
          },
        },
      },
    });

    res.json({
      totalCards,
      totalReviews,
      recentReviews,
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/srs/cards/:cardId - Delete card
router.delete('/cards/:cardId', blockDemoUser, async (req: AuthRequest, res, next) => {
  try {
    const deleted = await prisma.card.deleteMany({
      where: {
        id: req.params.cardId,
        userId: req.userId,
      },
    });

    if (deleted.count === 0) {
      throw new AppError('Card not found', 404);
    }

    res.json({ message: 'Card deleted successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;
