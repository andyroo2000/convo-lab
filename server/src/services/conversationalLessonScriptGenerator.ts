import { generateWithGemini } from './geminiClient';
import { DialogueExchange, VocabularyItem } from './courseItemExtractor';
import { LessonScriptUnit } from './lessonScriptGenerator';

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
export async function generateConversationalLessonScript(
  exchanges: DialogueExchange[],
  context: ConversationalScriptContext
): Promise<GeneratedConversationalScript> {
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

  console.log(`✅ Generated conversational script with ${units.length} units, ~${Math.round(totalSeconds / 60)} minutes`);

  return {
    units,
    estimatedDurationSeconds: totalSeconds,
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
      text: `${exchange.relationshipName} says:`,
      voiceId: context.l1VoiceId,
    },
    { type: 'pause', seconds: 0.5 },
    // Play in target language (full speed only)
    {
      type: 'L2',
      text: exchange.textL2,
      reading: exchange.readingL2 || undefined,
      voiceId: exchange.speakerVoiceId,
      speed: 1.0,
    },
    { type: 'pause', seconds: 1.0 },
    // Translation so learner understands what was asked
    {
      type: 'narration_L1',
      text: `That means: "${exchange.translationL1}"`,
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
      units.push(
        {
          type: 'narration_L1',
          text: `"${vocabItem.translationL1}" is:`,
          voiceId: context.l1VoiceId,
        },
        { type: 'pause', seconds: 0.5 },
        // First repetition
        {
          type: 'L2',
          text: vocabItem.textL2,
          reading: vocabItem.readingL2,
          voiceId: exchange.speakerVoiceId,
          speed: 1.0,
        },
        { type: 'pause', seconds: 1.0 },
        // Second repetition
        {
          type: 'L2',
          text: vocabItem.textL2,
          reading: vocabItem.readingL2,
          voiceId: exchange.speakerVoiceId,
          speed: 1.0,
        },
        { type: 'pause', seconds: 1.5 }
      );

      // Mark this vocabulary as introduced
      introducedVocab.add(vocabItem.textL2);
    }

    // After vocabulary breakdown, present full phrase: slow → pause → normal
    units.push(
      {
        type: 'narration_L1',
        text: `Let's hear the full phrase again.`,
        voiceId: context.l1VoiceId,
      },
      { type: 'pause', seconds: 0.5 },
      // Slowly
      {
        type: 'L2',
        text: exchange.textL2,
        reading: exchange.readingL2 || undefined,
        voiceId: exchange.speakerVoiceId,
        speed: 0.75,
      },
      { type: 'pause', seconds: 1.5 },
      // Normal speed
      {
        type: 'L2',
        text: exchange.textL2,
        reading: exchange.readingL2 || undefined,
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
  targetLanguage: string
): Promise<Array<{ textL2: string; translation: string }>> {
  if (vocabularyItems.length <= 1) {
    // Too few items to build progressive chunks
    return [];
  }

  const vocabList = vocabularyItems
    .map((v, i) => `${i + 1}. "${v.textL2}" (${v.translationL1})`)
    .join('\n');

  const prompt = `You are a language teaching expert using the Pimsleur Method's progressive phrase building technique.

Full sentence: "${fullTextL2}" (${fullTranslation})

Vocabulary items to combine:
${vocabList}

Create 2-4 progressive phrase chunks that build up from the vocabulary items to the full sentence. Each chunk should:
- Combine 2-3 vocabulary items into a meaningful phrase
- Be progressively longer, building toward the full sentence
- Be natural and grammatically correct in ${targetLanguage.toUpperCase()}
- Each phrase should be a stepping stone to the next

Example for "About 2 weeks. It was my first long trip":
1. "long trip" → "long trip"
2. "first long trip" → "first long trip"
3. "about 2 weeks" → "about 2 weeks"
4. "about 2 weeks. first long trip" → "about 2 weeks. it was my first long trip"

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

    return parsed.map((item: any) => ({
      textL2: item.phrase || item.textL2 || item.text,
      translation: item.translation,
    }));
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
      text: `You respond: "${exchange.translationL1}"`,
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
      units.push(
        // Introduce the word/phrase
        {
          type: 'narration_L1',
          text: `Here's how you say "${vocabItem.translationL1}".`,
          voiceId: context.l1VoiceId,
        },
        { type: 'pause', seconds: 0.5 },
        // First repetition
        {
          type: 'L2',
          text: vocabItem.textL2,
          reading: vocabItem.readingL2,
          voiceId: exchange.speakerVoiceId,
          speed: 1.0,
        },
        { type: 'pause', seconds: 1.0 },
        // Second repetition
        {
          type: 'L2',
          text: vocabItem.textL2,
          reading: vocabItem.readingL2,
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
    const progressiveChunks = vocabToTeach.length > 0
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
          text: `Now say: "${chunk.translation}".`,
          voiceId: context.l1VoiceId,
        },
        { type: 'pause', seconds: 2.5 }, // Pause for learner to try
        {
          type: 'L2',
          text: chunk.textL2,
          reading: undefined, // Could enhance to get reading
          voiceId: exchange.speakerVoiceId,
          speed: 1.0,
        },
        { type: 'pause', seconds: 1.5 }
      );
    }

    // STEP 3: Full phrase presentation (UPDATED!)
    units.push(
      {
        type: 'narration_L1',
        text: `Now the full phrase: "${exchange.translationL1}".`,
        voiceId: context.l1VoiceId,
      },
      { type: 'pause', seconds: 0.5 },
      // Play slowly first
      {
        type: 'L2',
        text: exchange.textL2,
        reading: exchange.readingL2 || undefined,
        voiceId: exchange.speakerVoiceId,
        speed: 0.75,
      },
      { type: 'pause', seconds: 2.5 }, // Pause for learner to try
      // Then at normal speed
      {
        type: 'L2',
        text: exchange.textL2,
        reading: exchange.readingL2 || undefined,
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
      // Slow then normal
      {
        type: 'L2',
        text: exchange.textL2,
        reading: exchange.readingL2 || undefined,
        voiceId: exchange.speakerVoiceId,
        speed: 0.75,
      },
      { type: 'pause', seconds: 2.5 },
      {
        type: 'L2',
        text: exchange.textL2,
        reading: exchange.readingL2 || undefined,
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
      // Japanese/Asian languages: ~1.5 seconds per 5 characters
      // Other languages: ~3 words per second
      const charCount = unit.text.length;
      const speed = unit.speed || 1.0;
      duration += (charCount / 5 * 1.5) / speed + 0.5;
    }
  }

  return duration;
}
