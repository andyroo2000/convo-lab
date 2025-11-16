import { Episode, Sentence } from '@prisma/client';
import { generateWithGemini } from './geminiClient';

export interface CoreItem {
  id: string;
  textL2: string;
  readingL2: string | null; // kana for Japanese, pinyin for Chinese
  translationL1: string;
  complexityScore: number;
  sourceEpisodeId: string;
  sourceSentenceId: string;
  order: number;
  // Pimsleur backward-build components (individual words/phrases)
  components?: PhraseComponent[];
}

export interface PhraseComponent {
  textL2: string;
  readingL2?: string;
  translationL1: string;
  order: number; // Order in backward build (0 = final component, higher = earlier)
}

// Dialogue exchange for scenario-based lessons
export interface DialogueExchange {
  order: number;
  speakerName: string;
  relationshipName: string; // e.g., "Your friend", "The bartender", for narration context
  speakerVoiceId: string;
  textL2: string;
  readingL2: string | null;
  translationL1: string;
  vocabularyItems: VocabularyItem[]; // Key words/phrases from this exchange
}

export interface VocabularyItem {
  textL2: string;
  readingL2?: string;
  translationL1: string;
  jlptLevel?: string; // JLPT level: N5, N4, N3, N2, N1 (for Japanese vocabulary)
  components?: PhraseComponent[]; // Backward-build components for this word/phrase
}

interface SentenceWithMetadata extends Sentence {
  metadata: any;
  speaker?: any;
}

/**
 * Extract 8-15 core vocabulary items from an Episode's dialogue
 * Prioritizes shorter, high-utility phrases suitable for Pimsleur-style drilling
 */
export async function extractCoreItems(
  episode: Episode & { dialogue: { sentences: SentenceWithMetadata[] } | null },
  minItems: number = 8,
  maxItems: number = 15
): Promise<CoreItem[]> {
  if (!episode.dialogue || !episode.dialogue.sentences.length) {
    throw new Error('Episode has no dialogue sentences');
  }

  const sentences = episode.dialogue.sentences;
  const targetLang = episode.targetLanguage;

  // Score and rank all sentences
  const scoredSentences = sentences.map((sentence) => ({
    sentence,
    score: calculateComplexityScore(sentence, targetLang),
  }));

  // Sort by complexity (simpler first) and select diverse items
  scoredSentences.sort((a, b) => a.score - b.score);

  // Select items: prioritize simpler items but ensure variety
  const selectedItems: CoreItem[] = [];
  const targetCount = Math.min(maxItems, Math.max(minItems, Math.floor(sentences.length / 3)));

  // Take items across the complexity spectrum
  const step = Math.floor(scoredSentences.length / targetCount);

  // Collect all sentences that need decomposition
  const sentencesToDecompose: Array<{
    sentence: SentenceWithMetadata;
    score: number;
    index: number;
  }> = [];

  for (let i = 0; i < targetCount && i * step < scoredSentences.length; i++) {
    const { sentence, score } = scoredSentences[i * step];
    sentencesToDecompose.push({ sentence, score, index: i });
  }

  // Batch decompose all phrases in a single API call
  const allComponents = await batchDecomposePhrasesForPimsleur(
    sentencesToDecompose.map(item => ({
      textL2: item.sentence.text,
      translationL1: item.sentence.translation,
      readingL2: extractReading(item.sentence, targetLang),
    })),
    targetLang
  );

  // Build final items with components
  for (let i = 0; i < sentencesToDecompose.length; i++) {
    const { sentence, score, index } = sentencesToDecompose[i];
    const components = allComponents[i];

    selectedItems.push({
      id: sentence.id,
      textL2: sentence.text,
      readingL2: extractReading(sentence, targetLang),
      translationL1: sentence.translation,
      complexityScore: score,
      sourceEpisodeId: episode.id,
      sourceSentenceId: sentence.id,
      order: index,
      components,
    });
  }

  return selectedItems;
}

/**
 * Calculate complexity score for a sentence
 * Lower score = simpler/better for core items
 * Considers: length, character complexity, question vs statement
 */
function calculateComplexityScore(sentence: SentenceWithMetadata, targetLang: string): number {
  const text = sentence.text;
  let score = 0;

  // Base score: character count
  score += text.length;

  if (targetLang === 'ja') {
    // Japanese-specific scoring
    const metadata = sentence.metadata as any;

    if (metadata?.japanese?.kanji) {
      // Count kanji characters (more complex than kana)
      const kanjiCount = (metadata.japanese.kanji.match(/[\u4e00-\u9faf]/g) || []).length;
      score += kanjiCount * 2; // Kanji adds complexity
    }

    // Questions are often simpler/more useful for drilling
    if (text.includes('？') || text.includes('?')) {
      score -= 5;
    }

    // Common particles indicate natural sentence structure (good for drilling)
    const commonParticles = ['か', 'ね', 'よ', 'ください'];
    if (commonParticles.some(p => text.includes(p))) {
      score -= 3;
    }
  } else if (targetLang === 'zh') {
    // Chinese-specific scoring
    const metadata = sentence.metadata as any;

    if (metadata?.chinese?.pinyin) {
      // Count syllables (pinyin words)
      const syllableCount = metadata.chinese.pinyin.split(/\s+/).length;
      score += syllableCount;
    }

    if (text.includes('？') || text.includes('?')) {
      score -= 5;
    }
  } else {
    // For other languages, use word count as proxy
    const wordCount = text.split(/\s+/).length;
    score += wordCount * 2;

    if (text.includes('?')) {
      score -= 5;
    }
  }

  // Very short phrases are excellent core items
  if (text.length <= 10) {
    score -= 10;
  }

  // Very long sentences are poor core items (better for dialogue integration)
  if (text.length > 50) {
    score += 20;
  }

  return Math.max(0, score);
}

/**
 * Extract phonetic reading from sentence metadata
 */
function extractReading(sentence: SentenceWithMetadata, targetLang: string): string | null {
  const metadata = sentence.metadata as any;

  if (targetLang === 'ja' && metadata?.japanese?.kana) {
    return metadata.japanese.kana;
  } else if (targetLang === 'zh' && metadata?.chinese?.pinyin) {
    return metadata.chinese.pinyin;
  }

  // For languages without phonetic systems, return null
  return null;
}

/**
 * Batch decompose multiple phrases in a single AI call to avoid rate limiting
 * Returns an array of PhraseComponent arrays, one for each input phrase
 */
async function batchDecomposePhrasesForPimsleur(
  phrases: Array<{
    textL2: string;
    translationL1: string;
    readingL2: string | null;
  }>,
  targetLang: string
): Promise<PhraseComponent[][]> {
  if (phrases.length === 0) {
    return [];
  }

  // Filter out very short phrases that don't need decomposition
  const phrasesNeedingDecomposition = phrases.map((phrase, index) => {
    const wordCount = targetLang === 'ja' || targetLang === 'zh'
      ? phrase.textL2.length
      : phrase.textL2.split(/\s+/).length;

    return {
      phrase,
      index,
      needsDecomposition: wordCount > 3,
    };
  });

  // Build prompt for all phrases at once
  const phrasesToDecompose = phrasesNeedingDecomposition.filter(p => p.needsDecomposition);

  if (phrasesToDecompose.length === 0) {
    // All phrases are too short, return simple components
    return phrases.map(phrase => [{
      textL2: phrase.textL2,
      readingL2: phrase.readingL2 || undefined,
      translationL1: phrase.translationL1,
      order: 0,
    }]);
  }

  const prompt = `You are a language teaching expert specializing in the Pimsleur Method's backward-build technique.

Break down these ${targetLang.toUpperCase()} phrases into 2-4 teachable components each using backward-build methodology.

Backward-build means teaching the END of the phrase first, then progressively adding earlier parts.

Example for Japanese "東京に行きたいです" (I want to go to Tokyo):
- Component 0: "です" → "it is" (final particle, teach first)
- Component 1: "行きたいです" → "want to go" (add verb stem)
- Component 2: "東京に行きたいです" → "want to go to Tokyo" (add full phrase)

Phrases to decompose:
${phrasesToDecompose.map((item, i) => `
${i + 1}. Phrase: "${item.phrase.textL2}"
   ${item.phrase.readingL2 ? `Reading: "${item.phrase.readingL2}"\n   ` : ''}Translation: "${item.phrase.translationL1}"`).join('\n')}

Return ONLY a JSON object with this structure (no markdown, no explanation):
{
  "phrases": [
    {
      "phraseIndex": 0,
      "components": [
        {"textL2": "...", "reading": "...", "translation": "...", "order": 0},
        {"textL2": "...", "reading": "...", "translation": "...", "order": 1}
      ]
    },
    {
      "phraseIndex": 1,
      "components": [...]
    }
  ]
}

Guidelines for each phrase:
- Start with the most meaningful ending (2-4 characters/words)
- Build backward by adding meaningful chunks
- Each component should be pronounceable and make linguistic sense
- Include 2-4 components total (not too many steps)
- Order 0 is taught FIRST (the ending), higher orders taught later
${phrases[0].readingL2 ? '- Include phonetic reading for each component\n' : '- Omit "reading" field if not applicable\n'}`;

  try {
    const response = await generateWithGemini(prompt);

    // Parse JSON response (strip markdown code blocks if present)
    let jsonText = response.trim();
    if (jsonText.includes('```')) {
      const match = jsonText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
      if (match && match[1]) {
        jsonText = match[1].trim();
      }
    }

    const parsed = JSON.parse(jsonText);

    if (!parsed.phrases || !Array.isArray(parsed.phrases)) {
      throw new Error('Invalid response format: missing phrases array');
    }

    // Map results back to original phrase order
    const results: PhraseComponent[][] = [];

    for (let i = 0; i < phrases.length; i++) {
      const phraseInfo = phrasesNeedingDecomposition[i];

      if (!phraseInfo.needsDecomposition) {
        // Simple phrase, return as single component
        results.push([{
          textL2: phrases[i].textL2,
          readingL2: phrases[i].readingL2 || undefined,
          translationL1: phrases[i].translationL1,
          order: 0,
        }]);
      } else {
        // Find decomposition result for this phrase
        const decompositionIndex = phrasesToDecompose.findIndex(p => p.index === i);
        const decomposition = parsed.phrases[decompositionIndex];

        if (decomposition && decomposition.components) {
          results.push(decomposition.components.map((comp: any) => ({
            textL2: comp.textL2 || comp.text,
            readingL2: comp.reading || comp.readingL2,
            translationL1: comp.translation || comp.translationL1,
            order: comp.order || 0,
          })));
        } else {
          // Fallback: return full phrase as single component
          results.push([{
            textL2: phrases[i].textL2,
            readingL2: phrases[i].readingL2 || undefined,
            translationL1: phrases[i].translationL1,
            order: 0,
          }]);
        }
      }
    }

    return results;
  } catch (err) {
    console.error('Failed to batch decompose phrases, using fallback:', err);

    // Fallback: return all phrases as single components
    return phrases.map(phrase => [{
      textL2: phrase.textL2,
      readingL2: phrase.readingL2 || undefined,
      translationL1: phrase.translationL1,
      order: 0,
    }]);
  }
}

/**
 * Decompose a phrase into components for Pimsleur backward-build method
 * Uses AI to intelligently break down phrases into teachable chunks
 * NOTE: Use batchDecomposePhrasesForPimsleur for multiple phrases to avoid rate limiting
 *
 * Example: "北海道を自転車で旅行されたそうですね" becomes:
 *   - Component 0 (final): "そうですね" (I heard / it seems)
 *   - Component 1: "旅行されたそうですね" (traveled, I heard)
 *   - Component 2: "自転車で旅行されたそうですね" (by bicycle traveled, I heard)
 *   - Component 3: "北海道を自転車で旅行されたそうですね" (full phrase)
 */
async function decomposePhraseForPimsleur(
  textL2: string,
  translationL1: string,
  targetLang: string,
  readingL2: string | null
): Promise<PhraseComponent[]> {
  // For very short phrases (1-2 words), don't decompose
  const wordCount = targetLang === 'ja' || targetLang === 'zh'
    ? textL2.length  // Character count for Asian languages
    : textL2.split(/\s+/).length; // Word count for others

  if (wordCount <= 3) {
    // Just return the full phrase as a single component
    return [{
      textL2,
      readingL2: readingL2 || undefined,
      translationL1,
      order: 0,
    }];
  }

  const prompt = `You are a language teaching expert specializing in the Pimsleur Method's backward-build technique.

Break down this ${targetLang.toUpperCase()} phrase into 2-4 teachable components using backward-build methodology:

Phrase: "${textL2}"
${readingL2 ? `Reading: "${readingL2}"\n` : ''}Translation: "${translationL1}"

Backward-build means teaching the END of the phrase first, then progressively adding earlier parts.

Example for Japanese "東京に行きたいです" (I want to go to Tokyo):
- Component 0: "です" → "it is" (final particle, teach first)
- Component 1: "行きたいです" → "want to go" (add verb stem)
- Component 2: "東京に行きたいです" → "want to go to Tokyo" (add full phrase)

Return ONLY a JSON array with this structure (no markdown, no explanation):
[
  {"textL2": "...", "reading": "...", "translation": "...", "order": 0},
  {"textL2": "...", "reading": "...", "translation": "...", "order": 1},
  ...
]

Guidelines:
- Start with the most meaningful ending (2-4 characters/words)
- Build backward by adding meaningful chunks
- Each component should be pronounceable and make linguistic sense
- Include 2-4 components total (not too many steps)
- Order 0 is taught FIRST (the ending), higher orders taught later
${readingL2 ? '- Include phonetic reading for each component\n' : '- Omit "reading" field if not applicable\n'}`;

  try {
    const response = await generateWithGemini(prompt);

    // Parse JSON response (strip markdown code blocks if present)
    let jsonText = response.trim();
    if (jsonText.includes('```')) {
      const match = jsonText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
      if (match && match[1]) {
        jsonText = match[1].trim();
      }
    }

    const parsed = JSON.parse(jsonText);

    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error('Invalid response format');
    }

    // Convert to PhraseComponent format
    return parsed.map((comp: any) => ({
      textL2: comp.textL2 || comp.text,
      readingL2: comp.reading || comp.readingL2,
      translationL1: comp.translation || comp.translationL1,
      order: comp.order || 0,
    }));
  } catch (err) {
    console.error('Failed to decompose phrase, using fallback:', err);

    // Fallback: just return the full phrase
    return [{
      textL2,
      readingL2: readingL2 || undefined,
      translationL1,
      order: 0,
    }];
  }
}

/**
 * Split long sentences with multiple questions or statements into separate exchanges
 * This keeps each turn to one sentence/question for better Pimsleur pacing
 */
async function splitLongSentences(
  sentences: (SentenceWithMetadata & { speaker: any })[],
  targetLang: string
): Promise<(SentenceWithMetadata & { speaker: any })[]> {
  const result: (SentenceWithMetadata & { speaker: any })[] = [];

  for (const sentence of sentences) {
    // Check if sentence has multiple questions or statements
    // Japanese: Multiple sentences usually separated by 。or ！or ？
    // For now, simple split by sentence-ending punctuation
    const sentenceEnders = ['。', '！', '？', '!', '?'];
    let needsSplit = false;
    let splitCount = 0;

    for (const ender of sentenceEnders) {
      const count = (sentence.text.match(new RegExp(`\\${ender}`, 'g')) || []).length;
      splitCount += count;
    }

    // If more than 1 sentence-ending punctuation, try to split
    if (splitCount > 1) {
      try {
        // Use AI to intelligently split the sentence
        const splitPrompt = `Split this ${targetLang.toUpperCase()} sentence into separate individual sentences. Each sentence should be a complete thought or question.

Original sentence: "${sentence.text}"
Translation: "${sentence.translation}"

Return ONLY a JSON array (no markdown, no explanation):
[
  {
    "text": "first sentence in ${targetLang}",
    "translation": "English translation"
  },
  {
    "text": "second sentence in ${targetLang}",
    "translation": "English translation"
  }
]`;

        const response = await generateWithGemini(splitPrompt);

        // Parse JSON
        let jsonText = response.trim();
        if (jsonText.includes('```')) {
          const match = jsonText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
          if (match && match[1]) {
            jsonText = match[1].trim();
          }
        }

        const splits = JSON.parse(jsonText);

        if (Array.isArray(splits) && splits.length > 1) {
          // Successfully split - add each as separate sentence
          for (const split of splits) {
            result.push({
              ...sentence,
              text: split.text,
              translation: split.translation,
            });
          }
          console.log(`  Split "${sentence.text}" into ${splits.length} parts`);
          continue;
        }
      } catch (err) {
        console.error('Failed to split sentence, keeping as-is:', err);
      }
    }

    // Couldn't split or only one sentence - add as-is
    result.push(sentence);
  }

  return result;
}

/**
 * Extract dialogue exchanges for scenario-based Pimsleur lessons
 * Each exchange includes the speaker's line and key vocabulary items to teach
 *
 * UPDATED: Now splits long sentences and extracts based on target duration
 */
export async function extractDialogueExchanges(
  episode: Episode & { dialogue: { sentences: (SentenceWithMetadata & { speaker: any })[] } | null },
  targetDurationMinutes: number = 15
): Promise<DialogueExchange[]> {
  if (!episode.dialogue || !episode.dialogue.sentences.length) {
    throw new Error('Episode has no dialogue sentences');
  }

  const sentences = episode.dialogue.sentences;
  const targetLang = episode.targetLanguage;

  // FIRST: Split long sentences (those with multiple questions or statements)
  const splitSentences = await splitLongSentences(sentences, targetLang);

  console.log(`Split ${sentences.length} sentences into ${splitSentences.length} shorter exchanges`);

  // Estimate how many exchanges we need for target duration
  // Each exchange takes ~90-120 seconds (with vocab breakdown)
  const estimatedSecondsPerExchange = 100;
  const targetSeconds = targetDurationMinutes * 60;
  const targetExchangeCount = Math.floor(targetSeconds / estimatedSecondsPerExchange);

  // Use all available sentences if we don't have enough, otherwise select diverse subset
  const selectedSentences = splitSentences.length <= targetExchangeCount
    ? splitSentences
    : selectDiverseSentences(splitSentences, targetExchangeCount);

  console.log(`Selected ${selectedSentences.length} exchanges for ~${targetDurationMinutes} minute lesson`);

  // Extract vocabulary from each exchange in a single batch API call
  const vocabExtractionPrompt = `You are a language teaching expert. Extract 2-4 key vocabulary words or short phrases from each of these ${targetLang.toUpperCase()} sentences that would be useful to teach in isolation.

For each sentence, identify the most important words/phrases that a learner should know. Focus on:
- Verbs and verb phrases
- Key nouns
- Useful expressions or particles
- Avoid very simple words like "is", "the", etc.

Sentences:
${selectedSentences.map((s, i) => `${i + 1}. "${s.text}" (${s.translation})`).join('\n')}

Return ONLY a JSON object (no markdown, no explanation):
{
  "exchanges": [
    {
      "sentenceIndex": 0,
      "vocabulary": [
        {"word": "...", "translation": "..."},
        {"word": "...", "translation": "..."}
      ]
    }
  ]
}`;

  try {
    const response = await generateWithGemini(vocabExtractionPrompt);

    // Parse JSON
    let jsonText = response.trim();
    if (jsonText.includes('```')) {
      const match = jsonText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
      if (match && match[1]) {
        jsonText = match[1].trim();
      }
    }

    const parsed = JSON.parse(jsonText);

    // Build dialogue exchanges
    const exchanges: DialogueExchange[] = [];

    for (let i = 0; i < selectedSentences.length; i++) {
      const sentence = selectedSentences[i];
      const vocabData = parsed.exchanges?.[i];

      const vocabularyItems: VocabularyItem[] = [];
      if (vocabData && vocabData.vocabulary) {
        for (const vocab of vocabData.vocabulary) {
          vocabularyItems.push({
            textL2: vocab.word,
            readingL2: extractReadingForText(sentence, vocab.word, targetLang),
            translationL1: vocab.translation,
          });
        }
      }

      exchanges.push({
        order: i,
        speakerName: sentence.speaker?.name || 'Speaker',
        relationshipName: sentence.speaker?.name || 'Speaker', // Use speaker name as relationship for legacy episodes
        speakerVoiceId: sentence.speaker?.voiceId || '',
        textL2: sentence.text,
        readingL2: extractReading(sentence, targetLang),
        translationL1: sentence.translation,
        vocabularyItems,
      });
    }

    return exchanges;
  } catch (err) {
    console.error('Failed to extract dialogue exchanges:', err);
    // Fallback: return exchanges without vocabulary breakdown
    return selectedSentences.map((sentence, i) => ({
      order: i,
      speakerName: sentence.speaker?.name || 'Speaker',
      relationshipName: sentence.speaker?.name || 'Speaker', // Use speaker name as relationship for legacy episodes
      speakerVoiceId: sentence.speaker?.voiceId || '',
      textL2: sentence.text,
      readingL2: extractReading(sentence, targetLang),
      translationL1: sentence.translation,
      vocabularyItems: [],
    }));
  }
}

/**
 * Select diverse sentences from dialogue for lesson
 */
function selectDiverseSentences(
  sentences: SentenceWithMetadata[],
  count: number
): SentenceWithMetadata[] {
  const step = Math.floor(sentences.length / count);
  const selected: SentenceWithMetadata[] = [];

  for (let i = 0; i < count && i * step < sentences.length; i++) {
    selected.push(sentences[i * step]);
  }

  return selected;
}

/**
 * Extract phonetic reading for a specific word/phrase from sentence metadata
 */
function extractReadingForText(
  sentence: SentenceWithMetadata,
  text: string,
  targetLang: string
): string | undefined {
  const metadata = sentence.metadata as any;

  // For now, return undefined - could be enhanced to extract reading for specific words
  // This would require more sophisticated parsing of the metadata
  return undefined;
}

/**
 * Extract dialogue exchanges directly from episode sourceText (the original prompt)
 * This provides richer context than using pre-generated dialogue
 * Optionally targets a specific JLPT level for Japanese
 */
export async function extractDialogueExchangesFromSourceText(
  sourceText: string,
  episodeTitle: string,
  targetLanguage: string,
  nativeLanguage: string,
  targetDurationMinutes: number = 15,
  jlptLevel?: string,
  speakerVoices?: { speakerName: string; voiceId: string }[],
  speaker1Gender: 'male' | 'female' = 'male',
  speaker2Gender: 'male' | 'female' = 'female'
): Promise<DialogueExchange[]> {
  console.log(`Extracting dialogue from source text for episode: ${episodeTitle}`);
  console.log(`Target duration: ${targetDurationMinutes} minutes, JLPT Level: ${jlptLevel || 'unspecified'}`);

  // Estimate how many exchanges we need for target duration
  // Each exchange takes ~90-120 seconds (with vocab breakdown)
  const estimatedSecondsPerExchange = 100;
  const targetSeconds = targetDurationMinutes * 60;
  const targetExchangeCount = Math.max(6, Math.floor(targetSeconds / estimatedSecondsPerExchange));

  // Build JLPT level constraint if specified
  const jlptConstraint = jlptLevel
    ? `\n\nIMPORTANT JLPT LEVEL CONSTRAINT:
- Target level: ${jlptLevel} (${getJLPTDescription(jlptLevel)})
- Use vocabulary and grammar structures appropriate for students at this level
- Avoid using words or structures significantly above this level
- Focus on practical, conversational language at this proficiency level`
    : '';

  const prompt = `You are creating a Pimsleur-style language lesson based on this scenario:

Title: "${episodeTitle}"
Scenario: "${sourceText}"

Generate ${targetExchangeCount} dialogue exchanges in ${targetLanguage.toUpperCase()} for this scenario. Create a realistic back-and-forth conversation.

For each exchange:
1. Write the line in ${targetLanguage.toUpperCase()}
2. Provide an English translation
3. Identify the speaker (give them a name like "Kenji", "Maria", "Bartender", etc.)
4. Provide a relationship description for narration (e.g., "Your friend", "The bartender", "Your colleague")
5. Extract 2-4 key vocabulary words or short phrases that would be useful to teach

${jlptConstraint}

Guidelines:
- Make the conversation natural and realistic
- Vary between questions and statements
- IMPORTANT: Keep each turn SHORT - one simple sentence, or at most one sentence + a tiny follow-up interjection/question
- AVOID run-on sentences or multiple topics in one turn
- Each turn should focus on ONE idea that's easy to hold in working memory
- Include practical, useful phrases
- For vocabulary, focus on verbs, key nouns, and useful expressions

Examples of GOOD turn length:
- "How was your trip to Hokkaido?" (simple question)
- "It was amazing! I went cycling." (statement + brief detail)
- "Really? How long were you there?" (interjection + short question)

Examples of BAD turn length (TOO LONG):
- "I went to Hokkaido last month and stayed for two weeks cycling around the island, and the weather was perfect except for one rainy day." (too many ideas)
- "That sounds wonderful! I've always wanted to visit Hokkaido. Did you enjoy the food there and what was your favorite place?" (multiple topics)

${targetLanguage === 'ja' ? `
IMPORTANT for Japanese vocabulary:
- "word" should contain ONLY Japanese characters (kanji/kana), NO romanization
- "reading" should contain the hiragana reading (e.g., "ほっかいどう" for 北海道)
- "jlptLevel" should indicate the JLPT level where this word is typically taught (N5, N4, N3, N2, N1)
  - N5 = beginner (basic words like これ, ありがとう, 行く)
  - N4 = upper beginner
  - N3 = intermediate
  - N2 = upper intermediate
  - N1 = advanced
- Do NOT include romanization in parentheses
- Example: {"word": "北海道", "reading": "ほっかいどう", "translation": "Hokkaido", "jlptLevel": "N4"}
` : ''}

Return ONLY a JSON object (no markdown, no explanation):
{
  "exchanges": [
    {
      "order": 0,
      "speakerName": "Kenji",
      "relationshipName": "Your friend",
      "textL2": "...",
      "translation": "...",
      "vocabulary": [
        {"word": "...", ${targetLanguage === 'ja' ? '"reading": "...", "jlptLevel": "N4",' : ''} "translation": "..."},
        {"word": "...", ${targetLanguage === 'ja' ? '"reading": "...", "jlptLevel": "N3",' : ''} "translation": "..."}
      ]
    }
  ]
}`;

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

    if (!parsed.exchanges || !Array.isArray(parsed.exchanges)) {
      throw new Error('Invalid response format: missing exchanges array');
    }

    // Build dialogue exchanges
    const exchanges: DialogueExchange[] = [];

    // Define multiple voices per gender for each language (to support same-gender dialogues)
    const voicesByGender: Record<string, { male: string[]; female: string[] }> = {
      'ja': {
        male: ['ja-JP-Neural2-C', 'ja-JP-Neural2-D'], // Avoiding D as primary (sounds young)
        female: ['ja-JP-Neural2-B', 'ja-JP-Wavenet-B']
      },
      'zh': {
        male: ['zh-CN-YunxiNeural', 'zh-CN-YunyangNeural'],
        female: ['zh-CN-XiaoxiaoNeural', 'zh-CN-XiaoyiNeural']
      },
      'es': {
        male: ['es-ES-AlvaroNeural', 'es-ES-PabloNeural'],
        female: ['es-ES-ElviraNeural', 'es-ES-AbrilNeural']
      },
      'fr': {
        male: ['fr-FR-HenriNeural', 'fr-FR-AlainNeural'],
        female: ['fr-FR-DeniseNeural', 'fr-FR-BrigitteNeural']
      },
      'en': {
        male: ['en-US-Journey-D', 'en-US-Neural2-D'],
        female: ['en-US-Journey-F', 'en-US-Neural2-F']
      },
    };

    // Get voices for target language with fallback to English
    const languageVoices = voicesByGender[targetLanguage] || voicesByGender['en'];

    // Create ordered voice array based on gender preferences
    // First unique speaker gets first voice of their gender, second gets second voice
    // This ensures different voices even if both speakers are the same gender
    const availableVoices = [
      languageVoices[speaker1Gender][0], // First voice for speaker 1's gender
      languageVoices[speaker2Gender][speaker1Gender === speaker2Gender ? 1 : 0], // If same gender, use second voice
    ];

    // Track unique speakers and assign voices
    const speakerVoiceMap = new Map<string, string>();
    let voiceIndex = 0;

    for (const exchange of parsed.exchanges) {
      // Check if we've already assigned a voice to this speaker
      let voiceId = speakerVoiceMap.get(exchange.speakerName);

      if (!voiceId) {
        // Try to find voice from original dialogue speakers if names match
        voiceId = speakerVoices?.find(v =>
          v.speakerName.toLowerCase() === exchange.speakerName.toLowerCase()
        )?.voiceId;

        // Otherwise assign next available voice
        if (!voiceId) {
          voiceId = availableVoices[voiceIndex % availableVoices.length];
          voiceIndex++;
        }

        speakerVoiceMap.set(exchange.speakerName, voiceId);
      }

      const vocabularyItems: VocabularyItem[] = [];
      if (exchange.vocabulary && Array.isArray(exchange.vocabulary)) {
        for (const vocab of exchange.vocabulary) {
          // Clean up word text - remove any romanization in parentheses
          let cleanedWord = vocab.word;
          // Remove patterns like " (romaji)" or "（romaji）"
          cleanedWord = cleanedWord.replace(/\s*[（(][^)）]*[)）]\s*/g, '').trim();

          vocabularyItems.push({
            textL2: cleanedWord,
            readingL2: vocab.reading || undefined,
            translationL1: vocab.translation,
            jlptLevel: vocab.jlptLevel || undefined,
          });
        }
      }

      exchanges.push({
        order: exchange.order,
        speakerName: exchange.speakerName,
        relationshipName: exchange.relationshipName || exchange.speakerName, // Fallback to speakerName if not provided
        speakerVoiceId: voiceId,
        textL2: exchange.textL2,
        readingL2: null, // Could be enhanced to generate readings
        translationL1: exchange.translation,
        vocabularyItems,
      });
    }

    console.log(`✅ Generated ${exchanges.length} dialogue exchanges from source text`);
    return exchanges;
  } catch (err) {
    console.error('Failed to extract dialogue from source text:', err);
    throw new Error(`Failed to generate dialogue exchanges: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
}

/**
 * Get human-readable description for JLPT level
 */
function getJLPTDescription(level: string): string {
  const descriptions: Record<string, string> = {
    'N5': 'Beginner - Basic grammar, ~700 vocabulary words',
    'N4': 'Upper Beginner - Elementary grammar, ~1500 vocabulary words',
    'N3': 'Intermediate - Everyday grammar, ~3750 vocabulary words',
    'N2': 'Upper Intermediate - Advanced grammar, ~6000 vocabulary words',
    'N1': 'Advanced - Complex grammar, ~10000 vocabulary words',
  };
  return descriptions[level] || level;
}

/**
 * Extract vocabulary from individual sentences (for future use)
 * This could be used to extract sub-phrases or individual words
 */
export function extractVocabularyFromSentence(
  sentence: string,
  targetLang: string
): string[] {
  // Future enhancement: use NLP to extract key vocabulary
  // For now, just return the full sentence
  return [sentence];
}
