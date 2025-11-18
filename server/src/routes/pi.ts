import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  generatePISession,
  JLPTLevel,
  GrammarPointType,
  GRAMMAR_POINTS,
  isGrammarPointValidForLevel
} from '../services/piGenerator.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const execAsync = promisify(exec);
const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

    // Generate audio for each item
    const itemsWithAudio = await Promise.all(
      session.items.map(async (item) => {
        try {
          // For meaning_match type, generate audio for both sentences
          if (item.type === 'meaning_match' && item.sentencePair) {
            const [audioUrlA, audioUrlB] = await Promise.all([
              generateAudio(item.sentencePair.sentenceA),
              generateAudio(item.sentencePair.sentenceB),
            ]);

            return {
              ...item,
              audioUrl: audioUrlA, // Default to sentenceA
              audioUrlA,
              audioUrlB,
            };
          } else {
            // For other types, just generate audio for the main sentence
            const audioUrl = await generateAudio(item.japaneseSentence);
            return {
              ...item,
              audioUrl,
            };
          }
        } catch (error) {
          console.error('Error generating audio for item:', error);
          // Return item without audio rather than failing the whole session
          return item;
        }
      })
    );

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

/**
 * Generate audio for Japanese text using Edge TTS
 */
async function generateAudio(japaneseText: string): Promise<string> {
  // Select a Japanese voice
  const voice = 'ja-JP-NanamiNeural'; // Female voice, clear pronunciation

  // Create unique filename
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(7);
  const filename = `pi_${timestamp}_${randomSuffix}.mp3`;

  // Determine paths
  const publicDir = path.join(__dirname, '../../public');
  const audioDir = path.join(publicDir, 'audio', 'pi');
  const filepath = path.join(audioDir, filename);

  // Ensure directory exists
  await fs.mkdir(audioDir, { recursive: true });

  // Generate audio with edge-tts
  const command = `edge-tts --voice "${voice}" --text "${japaneseText.replace(/"/g, '\\"')}" --write-media "${filepath}"`;

  try {
    await execAsync(command);
    console.log(`Generated audio: ${filename}`);

    // Return the URL path
    return `/audio/pi/${filename}`;
  } catch (error) {
    console.error('Error generating audio with edge-tts:', error);
    throw new Error('Failed to generate audio');
  }
}

export default router;
