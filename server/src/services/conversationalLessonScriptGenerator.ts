import { DialogueExchange, VocabularyItem } from './courseItemExtractor.js';
import { generateWithGemini } from './geminiClient.js';
import { LessonScriptUnit } from './lessonScriptGenerator.js';
import { parseFuriganaUnits, stripFuriganaToKana } from './pronunciation/furiganaUtils.js';
import { buildSpeakerIntro } from './speakerNarration.js';

/**
 * Extract the reading for a vocabulary word from the parent exchange's reading.
 * Only works with bracket-notation furigana (e.g. "北海道[ほっかいどう]に行[い]きました").
 * Returns undefined for pure kana readings since kanji→kana mapping can't be inferred reliably.
 *
 * Example:
 * - Exchange reading: "この前[まえ]北海道[ほっかいどう]に行[い]ったって言[い]ってたよね？"
 * - Vocab word: "北海道"
 * - Returns: "ほっかいどう"
 */
function extractVocabReadingFromContext(
  vocabWord: string,
  _exchangeText: string,
  exchangeReading: string | null
): string | undefined {
  if (!exchangeReading || !vocabWord) {
    return undefined;
  }

  // Only attempt extraction from bracket-notation furigana.
  // Pure kana readings can't reliably map back to kanji substrings
  // (kanji→kana is not 1:1 in character count, so position-based slicing breaks).
  if (!exchangeReading.includes('[')) {
    return undefined;
  }

  // Parse bracket notation into (surface, reading) pairs
  const rawUnits = parseFuriganaUnits(exchangeReading);
  if (rawUnits.length === 0) {
    return undefined;
  }

  // Split plain-text units (surface === reading) into individual characters
  // so vocab words that span a kanji unit + adjacent kana can be found.
  // e.g. 特[とく]にラーメン → units "特"/"とく" + "に"/"に" + "ラ"/"ラ" ...
  const units: { surface: string; reading: string }[] = [];
  for (const u of rawUnits) {
    if (u.surface === u.reading && u.surface.length > 1) {
      for (const ch of u.surface) {
        units.push({ surface: ch, reading: ch });
      }
    } else {
      units.push(u);
    }
  }

  // Find contiguous units whose surfaces concatenate to the vocab word
  const target = vocabWord.trim();
  if (!target) return undefined;

  for (let start = 0; start < units.length; start++) {
    let surface = '';
    let reading = '';

    for (let end = start; end < units.length; end++) {
      surface += units[end].surface;
      reading += units[end].reading;

      if (surface === target) {
        return reading;
      }
      if (surface.length >= target.length) {
        break;
      }
    }
  }

  return undefined;
}

/**
 * Estimate learner recall pause duration based on phrase length.
 * Short (single word) → 3s, medium phrase → 5s, full sentence → 7s.
 * Uses character count which works well for Japanese and other languages.
 */
function estimateRecallPause(text: string): number {
  const len = text.length;
  if (len <= 6) return 3;
  if (len <= 15) return 5;
  return 7;
}

interface ConversationalScriptContext {
  episodeTitle: string;
  targetLanguage: string;
  nativeLanguage: string;
  l1VoiceId: string; // English narrator
  l2VoiceIds: Record<string, string>; // Map of speaker names to voice IDs
  jlptLevel?: string; // Optional JLPT level for Japanese (N5-N1)
}

export interface GeneratedConversationalScript {
  units: LessonScriptUnit[];
  estimatedDurationSeconds: number;
}

/**
 * Generate a Pimsleur-style conversational lesson script
 * Follows the format: scenario setup → dialogue exchange → vocabulary breakdown → build up response → next exchange
 */
const REVIEW_REPEAT_PAUSE_SECONDS = 3.0;
const REVIEW_SLOW_SPEED = 0.85;
const MIN_DURATION_RATIO = 0.9;
const MAX_DURATION_RATIO = 1.05;
const MAX_REVIEW_ROUNDS = 5;

export async function generateConversationalLessonScript(
  exchanges: DialogueExchange[],
  context: ConversationalScriptContext,
  targetDurationSeconds?: number
): Promise<GeneratedConversationalScript> {
  // eslint-disable-next-line no-console
  console.log('🚀 Generating conversational Pimsleur-style lesson script...');

  const units: LessonScriptUnit[] = [];
  let totalSeconds = 0;

  // Track introduced vocabulary across entire lesson to avoid teaching duplicates
  const introducedVocab = new Set<string>();

  // Generate scenario introduction using AI
  const jlptInfo = context.jlptLevel
    ? ` This lesson is designed for students at JLPT ${context.jlptLevel} level.`
    : '';

  const scenarioPrompt = `You are creating a Pimsleur-style ${context.targetLanguage.toUpperCase()} language lesson for ${context.nativeLanguage.toUpperCase()} speakers.${jlptInfo}

Based on this dialogue context: "${context.episodeTitle}"

Write a compelling 2-3 sentence scenario setup that:
- Starts with "Pretend you are..." or "Imagine you are..."
- Sets up a realistic conversational scenario (e.g., "at a Japanese bar", "talking to a friend", "meeting someone new")
- Explains who you're talking to and what the conversation is about
- Makes the learner feel immersed in the situation
- Write in second person ("you are...", "you're talking to...")

Example: "Pretend you are an American traveler talking to a bartender at a Japanese bar in Hokkaido. He's curious about your recent cycling trip and is asking you questions about your adventure."

Write only the scenario setup, no additional formatting:`;

  try {
    const scenarioIntro = await generateWithGemini(scenarioPrompt);

    units.push(
      { type: 'marker', label: 'Lesson Start' },
      {
        type: 'narration_L1',
        text: scenarioIntro.trim(),
        voiceId: context.l1VoiceId,
      },
      { type: 'pause', seconds: 1.5 }
    );
    totalSeconds += 20; // Estimate for intro
  } catch (err) {
    console.error('Failed to generate scenario intro:', err);
    units.push(
      { type: 'marker', label: 'Lesson Start' },
      {
        type: 'narration_L1',
        text: `Welcome to this lesson. Let's learn some useful ${context.targetLanguage.toUpperCase()} phrases through conversation.`,
        voiceId: context.l1VoiceId,
      },
      { type: 'pause', seconds: 1.5 }
    );
    totalSeconds += 15;
  }

  // Process each dialogue exchange
  for (let i = 0; i < exchanges.length; i++) {
    const exchange = exchanges[i];
    const isUserResponse = i % 2 === 1; // Alternate: other person asks, you respond

    // eslint-disable-next-line no-console
    console.log(`  Processing exchange ${i + 1}/${exchanges.length}: ${exchange.speakerName}`);

    if (isUserResponse) {
      // This is YOUR response - teach how to say it
      const responseUnits = await generateResponseTeachingUnits(exchange, context, introducedVocab);
      units.push(...responseUnits);
      totalSeconds += estimateUnitsDuration(responseUnits);
    } else {
      // This is the OTHER PERSON speaking - just play it
      const questionUnits = generateQuestionUnits(exchange, context, introducedVocab);
      units.push(...questionUnits);
      totalSeconds += estimateUnitsDuration(questionUnits);
    }
  }

  // Outro
  units.push(
    { type: 'marker', label: 'Lesson End' },
    {
      type: 'narration_L1',
      text: "Great work! You've learned some very useful phrases today. Keep practicing, and we'll see you in the next lesson.",
      voiceId: context.l1VoiceId,
    },
    { type: 'pause', seconds: 2.0 }
  );
  totalSeconds += 10;

  let finalUnits = units;
  let finalSeconds = totalSeconds;

  if (
    targetDurationSeconds &&
    finalSeconds < targetDurationSeconds * MIN_DURATION_RATIO &&
    exchanges.length > 0
  ) {
    const padded = padScriptToTargetDuration(units, exchanges, context, targetDurationSeconds);
    finalUnits = padded.units;
    finalSeconds = padded.estimatedDurationSeconds;

    // eslint-disable-next-line no-console
    console.log(
      `⏱️  Added ${padded.reviewRounds} review round(s) to reach target duration (${Math.round(
        targetDurationSeconds / 60
      )} min)`
    );
  }

  // eslint-disable-next-line no-console
  console.log(
    `✅ Generated conversational script with ${finalUnits.length} units, ~${Math.round(
      finalSeconds / 60
    )} minutes`
  );

  return {
    units: finalUnits,
    estimatedDurationSeconds: Math.round(finalSeconds),
  };
}

/**
 * Generate units for the other person asking a question or making a statement
 * NOW INCLUDES: Translation and vocabulary breakdown so learner understands what's being asked
 */
function generateQuestionUnits(
  exchange: DialogueExchange,
  context: ConversationalScriptContext,
  introducedVocab: Set<string>
): LessonScriptUnit[] {
  const units: LessonScriptUnit[] = [];

  // Narrator introduces what they're saying
  units.push(
    {
      type: 'narration_L1',
      text: buildSpeakerIntro(exchange),
      voiceId: context.l1VoiceId,
    },
    { type: 'pause', seconds: 0.5 },
    // Play in target language (full speed only)
    {
      type: 'L2',
      text: exchange.textL2,
      reading: exchange.readingL2 || undefined,
      translation: exchange.translationL1,
      voiceId: exchange.speakerVoiceId,
      speed: 1.0,
    },
    { type: 'pause', seconds: 1.0 },
    // Translation so learner understands what was asked
    {
      type: 'narration_L1',
      text: normalizeNarratorText(`That means: "${exchange.translationL1}"`),
      voiceId: context.l1VoiceId,
    },
    { type: 'pause', seconds: 1.0 }
  );

  // If we have vocabulary items, teach them (after filtering)
  if (exchange.vocabularyItems && exchange.vocabularyItems.length > 0) {
    const vocabToTeach = filterVocabularyItems(
      exchange.vocabularyItems,
      introducedVocab,
      context.jlptLevel
    );

    for (const vocabItem of vocabToTeach) {
      // Extract context-aware reading from the parent exchange
      const contextReading =
        extractVocabReadingFromContext(vocabItem.textL2, exchange.textL2, exchange.readingL2) ||
        vocabItem.readingL2;

      units.push(
        {
          type: 'narration_L1',
          text: normalizeNarratorText(`"${vocabItem.translationL1}" is:`),
          voiceId: context.l1VoiceId,
        },
        { type: 'pause', seconds: 0.5 },
        // First repetition
        {
          type: 'L2',
          text: vocabItem.textL2,
          reading: contextReading,
          translation: vocabItem.translationL1,
          voiceId: exchange.speakerVoiceId,
          speed: 1.0,
        },
        { type: 'pause', seconds: 3.0 },
        // Second repetition
        {
          type: 'L2',
          text: vocabItem.textL2,
          reading: contextReading,
          translation: vocabItem.translationL1,
          voiceId: exchange.speakerVoiceId,
          speed: 1.0,
        },
        { type: 'pause', seconds: 1.5 }
      );

      // Mark this vocabulary as introduced
      introducedVocab.add(vocabItem.textL2);
    }

    // After vocabulary breakdown, present full phrase twice at normal speed
    units.push(
      {
        type: 'narration_L1',
        text: `Let's hear the full phrase again.`,
        voiceId: context.l1VoiceId,
      },
      { type: 'pause', seconds: 0.5 },
      {
        type: 'L2',
        text: exchange.textL2,
        reading: exchange.readingL2 || undefined,
        translation: exchange.translationL1,
        voiceId: exchange.speakerVoiceId,
        speed: 1.0,
      },
      { type: 'pause', seconds: 3.0 },
      {
        type: 'L2',
        text: exchange.textL2,
        reading: exchange.readingL2 || undefined,
        translation: exchange.translationL1,
        voiceId: exchange.speakerVoiceId,
        speed: 1.0,
      },
      { type: 'pause', seconds: 1.5 }
    );
  } else {
    units.push({ type: 'pause', seconds: 1.5 });
  }

  return units;
}

/**
 * Generate progressive phrase chunks for building up to full sentence
 * Uses AI to create intermediate phrases from vocabulary items
 */
async function generateProgressivePhraseChunks(
  fullTextL2: string,
  fullTranslation: string,
  vocabularyItems: VocabularyItem[],
  _targetLanguage: string
): Promise<Array<{ textL2: string; translation: string }>> {
  if (vocabularyItems.length <= 1) {
    // Too few items to build progressive chunks
    return [];
  }

  const vocabList = vocabularyItems
    .map((v, i) => `${i + 1}. "${v.textL2}" (${v.translationL1})`)
    .join('\n');

  const prompt = `You are a language teaching expert using the Pimsleur Method's backward-build technique.

Full sentence: "${fullTextL2}" (${fullTranslation})

Vocabulary items already taught individually (listed right-to-left from the sentence):
${vocabList}

Create 2-4 progressive phrase chunks that build up from the END of the sentence toward the beginning.

Rules:
- Build RIGHT-TO-LEFT: start with items near the end of the sentence, progressively add items toward the beginning
- Every chunk must COMBINE multiple vocabulary items — never repeat a single word that was already taught individually
- Every chunk must be grammatically complete and natural-sounding
- GOOD chunks: complete clauses, verb phrases with particles, adverb+predicate combinations
- BAD chunks: dangling subjects without predicates, objects split from their verbs, incomplete grammar
- The final chunk should be the complete sentence

Example for Japanese sentence "初めての長い旅でした" (It was my first long trip):
Vocab taught: 旅 (trip), 長い (long), 初めて (first time)
GOOD chunks:
1. "長い旅" (long trip) — combines two end-of-sentence vocab items
2. "初めての長い旅でした" (it was my first long trip) — full sentence
BAD chunks:
- "初めての" alone (dangling — grammatically incomplete, no predicate)
- "旅でした" (just repeats single vocab 旅 with copula)

Return ONLY a JSON array (no markdown, no explanation):
[
  {"phrase": "...", "translation": "..."},
  {"phrase": "...", "translation": "..."}
]`;

  try {
    const response = await generateWithGemini(prompt);

    // Parse JSON
    let jsonText = response.trim();
    if (jsonText.includes('```')) {
      const match = jsonText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
      if (match && match[1]) {
        jsonText = match[1].trim();
      }
    }

    const parsed = JSON.parse(jsonText);

    if (!Array.isArray(parsed) || parsed.length === 0) {
      return [];
    }

    return parsed.map((item: unknown) => {
      if (
        typeof item === 'object' &&
        item !== null &&
        'translation' in item &&
        typeof item.translation === 'string'
      ) {
        const obj = item as Record<string, unknown>;
        const textL2 =
          (typeof obj.phrase === 'string' && obj.phrase) ||
          (typeof obj.textL2 === 'string' && obj.textL2) ||
          (typeof obj.text === 'string' && obj.text) ||
          '';
        return {
          textL2,
          translation: item.translation,
        };
      }
      // Fallback for malformed items
      return {
        textL2: '',
        translation: '',
      };
    });
  } catch (err) {
    console.error('Failed to generate progressive phrase chunks:', err);
    return [];
  }
}

/**
 * Generate units for teaching the user how to respond
 * This is the core Pimsleur method: break down → build up
 */
async function generateResponseTeachingUnits(
  exchange: DialogueExchange,
  context: ConversationalScriptContext,
  introducedVocab: Set<string>
): Promise<LessonScriptUnit[]> {
  const units: LessonScriptUnit[] = [];

  // Narrator says what you'll respond in English
  units.push(
    {
      type: 'narration_L1',
      text: normalizeNarratorText(`You respond: "${exchange.translationL1}"`),
      voiceId: context.l1VoiceId,
    },
    { type: 'pause', seconds: 1.0 }
  );

  // If we have vocabulary items, teach them piece by piece (after filtering)
  if (exchange.vocabularyItems && exchange.vocabularyItems.length > 0) {
    const vocabToTeach = filterVocabularyItems(
      exchange.vocabularyItems,
      introducedVocab,
      context.jlptLevel
    );

    // STEP 1: Teach each vocabulary item individually
    for (const vocabItem of vocabToTeach) {
      // Extract context-aware reading from the parent exchange
      const contextReading =
        extractVocabReadingFromContext(vocabItem.textL2, exchange.textL2, exchange.readingL2) ||
        vocabItem.readingL2;

      units.push(
        // Introduce the word/phrase
        {
          type: 'narration_L1',
          text: normalizeNarratorText(`Here's how you say "${vocabItem.translationL1}".`),
          voiceId: context.l1VoiceId,
        },
        { type: 'pause', seconds: 0.5 },
        // First repetition
        {
          type: 'L2',
          text: vocabItem.textL2,
          reading: contextReading,
          translation: vocabItem.translationL1,
          voiceId: exchange.speakerVoiceId,
          speed: 1.0,
        },
        { type: 'pause', seconds: 3.0 },
        // Second repetition
        {
          type: 'L2',
          text: vocabItem.textL2,
          reading: contextReading,
          translation: vocabItem.translationL1,
          voiceId: exchange.speakerVoiceId,
          speed: 1.0,
        },
        { type: 'pause', seconds: 1.5 }
      );

      // Mark this vocabulary as introduced
      introducedVocab.add(vocabItem.textL2);
    }

    // STEP 2: Progressive phrase building (NEW!)
    // Generate intermediate phrase chunks using AI - BUT ONLY if we taught vocabulary
    // If we filtered out all vocab, skip progressive building (full phrase was likely taught earlier)
    const progressiveChunks =
      vocabToTeach.length > 0
        ? await generateProgressivePhraseChunks(
            exchange.textL2,
            exchange.translationL1,
            vocabToTeach, // Use only the vocab we ACTUALLY taught
            context.targetLanguage
          )
        : [];

    // Teach each progressive chunk
    for (const chunk of progressiveChunks) {
      units.push(
        {
          type: 'narration_L1',
          text: normalizeNarratorText(`Now say: "${chunk.translation}".`),
          voiceId: context.l1VoiceId,
        },
        { type: 'pause', seconds: estimateRecallPause(chunk.textL2) },
        {
          type: 'L2',
          text: chunk.textL2,
          reading: undefined,
          translation: chunk.translation,
          voiceId: exchange.speakerVoiceId,
          speed: 1.0,
        },
        { type: 'pause', seconds: 1.5 }
      );
    }

    // STEP 3: Full phrase presentation
    units.push(
      {
        type: 'narration_L1',
        text: normalizeNarratorText(`Now the full phrase: "${exchange.translationL1}".`),
        voiceId: context.l1VoiceId,
      },
      { type: 'pause', seconds: 0.5 },
      {
        type: 'L2',
        text: exchange.textL2,
        reading: exchange.readingL2 || undefined,
        translation: exchange.translationL1,
        voiceId: exchange.speakerVoiceId,
        speed: 1.0,
      },
      { type: 'pause', seconds: estimateRecallPause(exchange.textL2) },
      {
        type: 'L2',
        text: exchange.textL2,
        reading: exchange.readingL2 || undefined,
        translation: exchange.translationL1,
        voiceId: exchange.speakerVoiceId,
        speed: 1.0,
      },
      { type: 'pause', seconds: 2.0 }
    );
  } else {
    // No vocabulary breakdown, just teach the full phrase
    units.push(
      {
        type: 'narration_L1',
        text: `Here's how you say that.`,
        voiceId: context.l1VoiceId,
      },
      { type: 'pause', seconds: 0.5 },
      {
        type: 'L2',
        text: exchange.textL2,
        reading: exchange.readingL2 || undefined,
        translation: exchange.translationL1,
        voiceId: exchange.speakerVoiceId,
        speed: 1.0,
      },
      { type: 'pause', seconds: 2.5 },
      {
        type: 'L2',
        text: exchange.textL2,
        reading: exchange.readingL2 || undefined,
        translation: exchange.translationL1,
        voiceId: exchange.speakerVoiceId,
        speed: 1.0,
      },
      { type: 'pause', seconds: 2.0 }
    );
  }

  return units;
}

/**
 * Filter vocabulary items to exclude already-known words
 * - Skip words already introduced earlier in the lesson
 * - Skip words below the learner's JLPT level
 */
function filterVocabularyItems(
  vocabularyItems: VocabularyItem[],
  introducedVocab: Set<string>,
  learnerJlptLevel?: string
): VocabularyItem[] {
  const jlptLevelOrder = ['N5', 'N4', 'N3', 'N2', 'N1'];
  const learnerLevelIndex = learnerJlptLevel ? jlptLevelOrder.indexOf(learnerJlptLevel) : -1;

  return vocabularyItems.filter((item) => {
    // Skip if already introduced in this lesson
    if (introducedVocab.has(item.textL2)) {
      return false;
    }

    // Skip if below learner's JLPT level (only for Japanese)
    if (learnerJlptLevel && item.jlptLevel) {
      const wordLevelIndex = jlptLevelOrder.indexOf(item.jlptLevel);
      // If word level is lower index than learner level, it's easier → skip it
      // E.g., learner is N3 (index 2), word is N5 (index 0) → skip
      if (wordLevelIndex !== -1 && wordLevelIndex < learnerLevelIndex) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Normalize narrator text to sound more natural when spoken by TTS
 * - Replaces "/" with " or " to avoid TTS saying "slash"
 * - Adds commas around " or " to create natural pauses
 * - Adds comma after quoted phrases ending with " is:" for better rhythm
 */
function normalizeNarratorText(text: string): string {
  let normalized = text
    // Replace "/" with " or "
    .replace(/\//g, ' or ');

  // Add commas around " or " when it appears in quoted text for natural pauses
  // Example: "In or at" becomes "In, or at,"
  normalized = normalized.replace(
    /"([^"]+)\s+or\s+([^"]+)"/g,
    (_match, before, after) => `"${before.trim()}, or ${after.trim()},"`
  );

  // Add comma before " is:" at the end of phrases for natural pause
  // Example: "In, or at," is: (creates rhythm: "In, or at, <pause> is:")
  normalized = normalized.replace(/,"\s+is:/g, '," is:');

  return normalized;
}

/**
 * Estimate duration of script units in seconds
 */
function estimateUnitsDuration(units: LessonScriptUnit[]): number {
  let duration = 0;

  for (const unit of units) {
    if (unit.type === 'pause') {
      duration += unit.seconds;
    } else if (unit.type === 'narration_L1') {
      // ~3 words per second for narration
      const wordCount = unit.text.split(/\s+/).length;
      duration += wordCount / 3 + 0.5; // +0.5 for natural pausing
    } else if (unit.type === 'L2') {
      const normalizedText = normalizeL2TextForEstimate(unit);
      // Japanese/Asian languages: ~1.5 seconds per 5 characters
      // Other languages: ~3 words per second
      const charCount = normalizedText.length;
      const speed = unit.speed || 1.0;
      duration += ((charCount / 5) * 1.5) / speed + 0.5;
    }
  }

  return duration;
}

function normalizeL2TextForEstimate(unit: LessonScriptUnit): string {
  if (unit.type !== 'L2') {
    return '';
  }

  const reading = unit.reading?.trim();
  if (reading && /[\u3040-\u30ff]/.test(reading)) {
    const normalized = reading.includes('[') ? stripFuriganaToKana(reading) : reading;
    if (normalized.trim()) {
      return normalized;
    }
  }

  return unit.text;
}

function padScriptToTargetDuration(
  units: LessonScriptUnit[],
  exchanges: DialogueExchange[],
  context: ConversationalScriptContext,
  targetDurationSeconds: number
): { units: LessonScriptUnit[]; estimatedDurationSeconds: number; reviewRounds: number } {
  if (exchanges.length === 0) {
    return { units, estimatedDurationSeconds: estimateUnitsDuration(units), reviewRounds: 0 };
  }

  const baseSeconds = estimateUnitsDuration(units);
  if (baseSeconds >= targetDurationSeconds * MIN_DURATION_RATIO) {
    return { units, estimatedDurationSeconds: baseSeconds, reviewRounds: 0 };
  }

  const reviewRound = buildReviewRoundUnits(exchanges, context, 1);
  const reviewSeconds = estimateUnitsDuration(reviewRound);
  if (reviewSeconds <= 0) {
    return { units, estimatedDurationSeconds: baseSeconds, reviewRounds: 0 };
  }

  const missingSeconds = targetDurationSeconds - baseSeconds;
  const requiredRounds = Math.max(1, Math.ceil(missingSeconds / reviewSeconds));
  const roundsToAdd = Math.min(MAX_REVIEW_ROUNDS, requiredRounds);

  const reviewRounds: LessonScriptUnit[][] = [];
  for (let round = 1; round <= roundsToAdd; round++) {
    reviewRounds.push(buildReviewRoundUnits(exchanges, context, round));
  }

  let paddedUnits = [...units, ...reviewRounds.flat()];
  let finalSeconds = estimateUnitsDuration(paddedUnits);

  while (finalSeconds > targetDurationSeconds * MAX_DURATION_RATIO && reviewRounds.length > 0) {
    reviewRounds.pop();
    paddedUnits = [...units, ...reviewRounds.flat()];
    finalSeconds = estimateUnitsDuration(paddedUnits);
  }

  // Add trailing silence to prevent final word cutoff
  paddedUnits.push({
    type: 'pause',
    seconds: 1.5,
  });
  finalSeconds += 1.5;

  return {
    units: paddedUnits,
    estimatedDurationSeconds: finalSeconds,
    reviewRounds: reviewRounds.length,
  };
}

function buildReviewRoundUnits(
  exchanges: DialogueExchange[],
  context: ConversationalScriptContext,
  roundNumber: number
): LessonScriptUnit[] {
  const units: LessonScriptUnit[] = [];

  units.push(
    { type: 'marker', label: `Review Round ${roundNumber}` },
    {
      type: 'narration_L1',
      text: "Let's review some key phrases.",
      voiceId: context.l1VoiceId,
    },
    { type: 'pause', seconds: 1.0 }
  );

  for (const exchange of exchanges) {
    units.push(
      {
        type: 'narration_L1',
        text: normalizeNarratorText(`How do you say: "${exchange.translationL1}"?`),
        voiceId: context.l1VoiceId,
      },
      { type: 'pause', seconds: estimateRecallPause(exchange.textL2) },
      {
        type: 'L2',
        text: exchange.textL2,
        reading: exchange.readingL2 || undefined,
        translation: exchange.translationL1,
        voiceId: exchange.speakerVoiceId,
        speed: REVIEW_SLOW_SPEED,
      },
      { type: 'pause', seconds: REVIEW_REPEAT_PAUSE_SECONDS },
      {
        type: 'L2',
        text: exchange.textL2,
        reading: exchange.readingL2 || undefined,
        translation: exchange.translationL1,
        voiceId: exchange.speakerVoiceId,
        speed: 1.0,
      },
      { type: 'pause', seconds: REVIEW_REPEAT_PAUSE_SECONDS }
    );
  }

  return units;
}
