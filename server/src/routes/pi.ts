import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  generatePISession,
  JLPTLevel,
  GrammarPointType,
  GRAMMAR_POINTS,
  isGrammarPointValidForLevel
} from '../services/piGenerator.js';
import { synthesizeBatchedTexts } from '../services/batchedTTSClient.js';
import { uploadToGCS } from '../services/storageClient.js';

const router = express.Router();

/**
 * POST /api/pi/generate-session
 * Generate a new PI practice session
 */
router.post('/generate-session', requireAuth, async (req, res) => {
  try {
    const { jlptLevel, itemCount, grammarPoint } = req.body;

    // Validate inputs
    if (!['N5', 'N4', 'N3', 'N2'].includes(jlptLevel)) {
      return res.status(400).json({ error: 'Invalid JLPT level. Must be N5, N4, N3, or N2.' });
    }

    if (![10, 15].includes(itemCount)) {
      return res.status(400).json({ error: 'Invalid item count. Must be 10 or 15.' });
    }

    // Validate grammar point
    if (!grammarPoint || !GRAMMAR_POINTS[grammarPoint as GrammarPointType]) {
      return res.status(400).json({ error: 'Invalid grammar point.' });
    }

    // Validate that grammar point matches JLPT level
    if (!isGrammarPointValidForLevel(grammarPoint as GrammarPointType, jlptLevel as JLPTLevel)) {
      const expectedLevel = GRAMMAR_POINTS[grammarPoint as GrammarPointType].level;
      return res.status(400).json({
        error: `Grammar point "${grammarPoint}" is for ${expectedLevel} level, but you selected ${jlptLevel}.`
      });
    }

    console.log(`Generating PI session: ${jlptLevel}, ${itemCount} items, grammar: ${grammarPoint}`);

    // Generate the session content with Gemini
    const session = await generatePISession(
      jlptLevel as JLPTLevel,
      itemCount,
      grammarPoint as GrammarPointType
    );

    console.log(`Generated ${session.items.length} PI items`);

    // Collect all texts that need audio generation
    const textsToSynthesize: { itemIndex: number; type: 'main' | 'A' | 'B'; text: string }[] = [];

    session.items.forEach((item, itemIndex) => {
      if (item.type === 'meaning_match' && item.sentencePair) {
        textsToSynthesize.push({ itemIndex, type: 'A', text: item.sentencePair.sentenceA });
        textsToSynthesize.push({ itemIndex, type: 'B', text: item.sentencePair.sentenceB });
      } else {
        textsToSynthesize.push({ itemIndex, type: 'main', text: item.japaneseSentence });
      }
    });

    console.log(`[PI] Batching ${textsToSynthesize.length} texts into single TTS call`);

    // Generate all audio in one batched TTS call
    const audioBuffers = await synthesizeBatchedTexts(
      textsToSynthesize.map(t => t.text),
      {
        voiceId: 'ja-JP-Neural2-B',
        languageCode: 'ja-JP',
        speed: 1.0,
      }
    );

    // Upload all audio buffers to GCS and map back to items
    const timestamp = Date.now();
    const audioUrls = await Promise.all(
      audioBuffers.map(async (buffer, index) => {
        const filename = `pi_${timestamp}_${index}.mp3`;
        return uploadToGCS({
          buffer,
          filename,
          contentType: 'audio/mpeg',
          folder: 'pi-audio',
        });
      })
    );

    // Map audio URLs back to items
    const itemsWithAudio = session.items.map((item, itemIndex) => {
      if (item.type === 'meaning_match' && item.sentencePair) {
        const audioIndexA = textsToSynthesize.findIndex(t => t.itemIndex === itemIndex && t.type === 'A');
        const audioIndexB = textsToSynthesize.findIndex(t => t.itemIndex === itemIndex && t.type === 'B');
        return {
          ...item,
          audioUrl: audioUrls[audioIndexA],
          audioUrlA: audioUrls[audioIndexA],
          audioUrlB: audioUrls[audioIndexB],
        };
      } else {
        const audioIndex = textsToSynthesize.findIndex(t => t.itemIndex === itemIndex && t.type === 'main');
        return {
          ...item,
          audioUrl: audioUrls[audioIndex],
        };
      }
    });

    console.log(`[PI] Audio generation complete: 1 TTS call (was ${textsToSynthesize.length})`);

    res.json({
      ...session,
      items: itemsWithAudio,
    });
  } catch (error: any) {
    console.error('Error generating PI session:', error);
    res.status(500).json({
      error: 'Failed to generate PI session',
      details: error.message,
    });
  }
});

export default router;
