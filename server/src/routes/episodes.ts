import { Router } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { prisma } from '../db/client.js';
import { AppError } from '../middleware/errorHandler.js';
import { processLanguageText } from '../services/languageProcessor.js';

const router = Router();

// All episode routes require authentication
router.use(requireAuth);

// Helper function to add furigana metadata to dialogue sentences on-the-fly
async function enrichDialogueWithFurigana(episode: any) {
  console.log('enrichDialogueWithFurigana called for episode:', episode.id);

  if (!episode.dialogue?.sentences) {
    console.log('No dialogue or sentences found');
    return episode;
  }

  const targetLanguage = episode.targetLanguage;
  console.log('Target language:', targetLanguage);
  console.log('Number of sentences:', episode.dialogue.sentences.length);

  // Generate furigana for all sentences and their variations
  const enrichedSentences = await Promise.all(
    episode.dialogue.sentences.map(async (sentence: any) => {
      // Process main text
      const metadata = await processLanguageText(sentence.text, targetLanguage);
      console.log('Sentence:', sentence.text, '-> metadata:', metadata);

      // Process variations if they exist
      let variationsMetadata = [];
      if (sentence.variations && sentence.variations.length > 0) {
        variationsMetadata = await Promise.all(
          sentence.variations.map((variation: string) =>
            processLanguageText(variation, targetLanguage)
          )
        );
      }

      return {
        ...sentence,
        metadata,
        variationsMetadata,
      };
    })
  );

  return {
    ...episode,
    dialogue: {
      ...episode.dialogue,
      sentences: enrichedSentences,
    },
  };
}

// Get all episodes for current user
router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const episodes = await prisma.episode.findMany({
      where: {
        userId: req.userId,
        // Only return episodes that have dialogues (exclude course-only episodes)
        dialogue: {
          isNot: null
        }
      },
      include: {
        dialogue: {
          include: {
            sentences: true,
            speakers: true,
          },
        },
        images: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Add furigana metadata to all episodes with dialogues
    const enrichedEpisodes = await Promise.all(
      episodes.map(episode => enrichDialogueWithFurigana(episode))
    );

    res.json(enrichedEpisodes);
  } catch (error) {
    next(error);
  }
});

// Get single episode
router.get('/:id', async (req: AuthRequest, res, next) => {
  try {
    const episode = await prisma.episode.findFirst({
      where: {
        id: req.params.id,
        userId: req.userId,
      },
      include: {
        dialogue: {
          include: {
            sentences: {
              orderBy: { order: 'asc' },
            },
            speakers: true,
          },
        },
        images: {
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!episode) {
      throw new AppError('Episode not found', 404);
    }

    // Add furigana metadata on-the-fly
    const enrichedEpisode = await enrichDialogueWithFurigana(episode);

    // Disable caching since furigana is generated dynamically
    res.set('Cache-Control', 'no-store');
    res.json(enrichedEpisode);
  } catch (error) {
    next(error);
  }
});

// Create new episode
router.post('/', async (req: AuthRequest, res, next) => {
  try {
    const { title, sourceText, targetLanguage, nativeLanguage, audioSpeed = 'medium' } = req.body;

    if (!title || !sourceText || !targetLanguage || !nativeLanguage) {
      throw new AppError('Missing required fields', 400);
    }

    const episode = await prisma.episode.create({
      data: {
        userId: req.userId!,
        title,
        sourceText,
        targetLanguage,
        nativeLanguage,
        audioSpeed,
        status: 'draft',
      },
    });

    res.json(episode);
  } catch (error) {
    next(error);
  }
});

// Update episode
router.patch('/:id', async (req: AuthRequest, res, next) => {
  try {
    const { title, status } = req.body;

    const episode = await prisma.episode.updateMany({
      where: {
        id: req.params.id,
        userId: req.userId,
      },
      data: {
        ...(title && { title }),
        ...(status && { status }),
        updatedAt: new Date(),
      },
    });

    if (episode.count === 0) {
      throw new AppError('Episode not found', 404);
    }

    res.json({ message: 'Episode updated' });
  } catch (error) {
    next(error);
  }
});

// Delete episode
router.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    const deleted = await prisma.episode.deleteMany({
      where: {
        id: req.params.id,
        userId: req.userId,
      },
    });

    if (deleted.count === 0) {
      throw new AppError('Episode not found', 404);
    }

    res.json({ message: 'Episode deleted' });
  } catch (error) {
    next(error);
  }
});

export default router;
