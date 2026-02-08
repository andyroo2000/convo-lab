import { TTS_VOICES } from '@languageflow/shared/src/constants-new.js';
import { Episode, Sentence, Speaker } from '@prisma/client';

import { reviewDialogue, editDialogue } from './dialogueReviewer.js';
import { generateWithGemini } from './geminiClient.js';
import { LanguageMetadata } from './languageProcessor.js';
import {
  sampleVocabulary,
  formatWordsForPrompt,
  getProficiencyFramework,
  sampleGrammar,
  formatGrammarForPrompt,
} from './vocabularySeeding.js';
// import { getVoicesByGender } from '../../../shared/src/voiceSelection.ts';

export interface CoreItem {
  id: string;
  textL2: string;
  readingL2: string | null; // kana for Japanese
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

interface SentenceWithMetadata extends Omit<Sentence, 'metadata'> {
  metadata: LanguageMetadata;
  speaker?: Speaker;
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

  const { sentences } = episode.dialogue;
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
    sentencesToDecompose.map((item) => ({
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
  const { text } = sentence;
  let score = 0;

  // Base score: character count
  score += text.length;

  if (targetLang === 'ja') {
    // Japanese-specific scoring
    const metadata = sentence.metadata;

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
    if (commonParticles.some((p) => text.includes(p))) {
      score -= 3;
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
  const metadata = sentence.metadata;

  if (targetLang === 'ja' && metadata?.japanese?.kana) {
    return metadata.japanese.kana;
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
    const wordCount =
      targetLang === 'ja' || targetLang === 'zh'
        ? phrase.textL2.length
        : phrase.textL2.split(/\s+/).length;

    return {
      phrase,
      index,
      needsDecomposition: wordCount > 3,
    };
  });

  // Build prompt for all phrases at once
  const phrasesToDecompose = phrasesNeedingDecomposition.filter((p) => p.needsDecomposition);

  if (phrasesToDecompose.length === 0) {
    // All phrases are too short, return simple components
    return phrases.map((phrase) => [
      {
        textL2: phrase.textL2,
        readingL2: phrase.readingL2 || undefined,
        translationL1: phrase.translationL1,
        order: 0,
      },
    ]);
  }

  const prompt = `You are a language teaching expert specializing in the Pimsleur Method's backward-build technique.

Break down these ${targetLang.toUpperCase()} phrases into 2-4 teachable components each using backward-build methodology.

Backward-build means teaching the END of the phrase first, then progressively adding earlier parts.

Example for Japanese "東京に行きたいです" (I want to go to Tokyo):
- Component 0: "です" → "it is" (final particle, teach first)
- Component 1: "行きたいです" → "want to go" (add verb stem)
- Component 2: "東京に行きたいです" → "want to go to Tokyo" (add full phrase)

Phrases to decompose:
${phrasesToDecompose
  .map(
    (item, i) => `
${i + 1}. Phrase: "${item.phrase.textL2}"
   ${item.phrase.readingL2 ? `Reading: "${item.phrase.readingL2}"\n   ` : ''}Translation: "${item.phrase.translationL1}"`
  )
  .join('\n')}

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
        results.push([
          {
            textL2: phrases[i].textL2,
            readingL2: phrases[i].readingL2 || undefined,
            translationL1: phrases[i].translationL1,
            order: 0,
          },
        ]);
      } else {
        // Find decomposition result for this phrase
        const decompositionIndex = phrasesToDecompose.findIndex((p) => p.index === i);
        const decomposition = parsed.phrases[decompositionIndex];

        if (decomposition && decomposition.components) {
          results.push(
            decomposition.components.map(
              (comp: {
                textL2?: string;
                text?: string;
                reading?: string;
                readingL2?: string;
                translation?: string;
                translationL1?: string;
                order?: number;
              }) => ({
                textL2: comp.textL2 || comp.text || '',
                readingL2: comp.reading || comp.readingL2,
                translationL1: comp.translation || comp.translationL1 || '',
                order: comp.order || 0,
              })
            )
          );
        } else {
          // Fallback: return full phrase as single component
          results.push([
            {
              textL2: phrases[i].textL2,
              readingL2: phrases[i].readingL2 || undefined,
              translationL1: phrases[i].translationL1,
              order: 0,
            },
          ]);
        }
      }
    }

    return results;
  } catch (err) {
    console.error('Failed to batch decompose phrases, using fallback:', err);

    // Fallback: return all phrases as single components
    return phrases.map((phrase) => [
      {
        textL2: phrase.textL2,
        readingL2: phrase.readingL2 || undefined,
        translationL1: phrase.translationL1,
        order: 0,
      },
    ]);
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
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function decomposePhraseForPimsleur(
  textL2: string,
  translationL1: string,
  targetLang: string,
  readingL2: string | null
): Promise<PhraseComponent[]> {
  // For very short phrases (1-2 words), don't decompose
  const wordCount =
    targetLang === 'ja' || targetLang === 'zh'
      ? textL2.length // Character count for Asian languages
      : textL2.split(/\s+/).length; // Word count for others

  if (wordCount <= 3) {
    // Just return the full phrase as a single component
    return [
      {
        textL2,
        readingL2: readingL2 || undefined,
        translationL1,
        order: 0,
      },
    ];
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
    return parsed.map(
      (comp: {
        textL2?: string;
        text?: string;
        reading?: string;
        readingL2?: string;
        translation?: string;
        translationL1?: string;
        order?: number;
      }) => ({
        textL2: comp.textL2 || comp.text || '',
        readingL2: comp.reading || comp.readingL2,
        translationL1: comp.translation || comp.translationL1 || '',
        order: comp.order || 0,
      })
    );
  } catch (err) {
    console.error('Failed to decompose phrase, using fallback:', err);

    // Fallback: just return the full phrase
    return [
      {
        textL2,
        readingL2: readingL2 || undefined,
        translationL1,
        order: 0,
      },
    ];
  }
}

/**
 * Split long sentences with multiple questions or statements into separate exchanges
 * This keeps each turn to one sentence/question for better Pimsleur pacing
 */
async function splitLongSentences(
  sentences: (SentenceWithMetadata & { speaker: Speaker })[],
  targetLang: string
): Promise<(SentenceWithMetadata & { speaker: Speaker })[]> {
  const result: (SentenceWithMetadata & { speaker: Speaker })[] = [];

  for (const sentence of sentences) {
    // Check if sentence has multiple questions or statements
    // Japanese: Multiple sentences usually separated by 。or ！or ？
    // For now, simple split by sentence-ending punctuation
    const sentenceEnders = ['。', '！', '？', '!', '?'];
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
          console.warn(`  Split "${sentence.text}" into ${splits.length} parts`);
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
  episode: Episode & {
    dialogue: { sentences: (SentenceWithMetadata & { speaker: Speaker })[] } | null;
  },
  targetDurationMinutes: number = 15
): Promise<DialogueExchange[]> {
  if (!episode.dialogue || !episode.dialogue.sentences.length) {
    throw new Error('Episode has no dialogue sentences');
  }

  const { sentences } = episode.dialogue;
  const targetLang = episode.targetLanguage;

  // FIRST: Split long sentences (those with multiple questions or statements)
  const splitSentences = await splitLongSentences(sentences, targetLang);

  console.warn(
    `Split ${sentences.length} sentences into ${splitSentences.length} shorter exchanges`
  );

  // Estimate how many exchanges we need for target duration
  // Each exchange takes ~90 seconds (with vocab breakdown, anticipation drills, and spaced repetition)
  // This includes: introduction, vocabulary breakdown, anticipation prompts, and review cycles
  const estimatedSecondsPerExchange = 90;
  const targetSeconds = targetDurationMinutes * 60;
  const targetExchangeCount = Math.floor(targetSeconds / estimatedSecondsPerExchange);

  // Use all available sentences if we don't have enough, otherwise select diverse subset
  const selectedSentences =
    splitSentences.length <= targetExchangeCount
      ? splitSentences
      : selectDiverseSentences(splitSentences, targetExchangeCount);

  console.warn(
    `Selected ${selectedSentences.length} exchanges for ~${targetDurationMinutes} minute lesson`
  );

  // Extract vocabulary from each exchange in a single batch API call
  const vocabExtractionPrompt = `You are a language teaching expert. Extract ONLY 1-2 KEY vocabulary words or short phrases from each ${targetLang.toUpperCase()} sentence.

STRICT CRITERIA - Only extract words that are:
1. Content words (verbs, nouns, adjectives, useful expressions)
2. NOT particles, copulas, or grammar words (は, が, を, に, で, と, の, です, ます, だ)
3. NOT ultra-common words learners already know (今, ここ, それ, これ, etc.)
4. NOT demonstratives or pronouns unless teaching a specific pattern
5. Multi-syllable/character (avoid single-character words unless highly significant)
6. Teachable in isolation and reusable in other contexts

EXTRACT ONLY 1-2 WORDS PER SENTENCE - prioritize quality over quantity.

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
        // Filter vocabulary to remove stopwords and ultra-common words
        const filteredVocab = filterVocabularyItems(vocabData.vocabulary, targetLang);

        for (const vocab of filteredVocab) {
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
 * Filter vocabulary items to remove stopwords, particles, and ultra-common words
 */
function filterVocabularyItems(
  vocabList: Array<{ word: string; translation: string }>,
  targetLanguage: string
): Array<{ word: string; translation: string }> {
  const japaneseStopwords = [
    // Particles
    'は',
    'が',
    'を',
    'に',
    'で',
    'と',
    'の',
    'へ',
    'から',
    'まで',
    'より',
    // Copulas/auxiliary verbs
    'です',
    'だ',
    'である',
    'ます',
    'ました',
    'ません',
    // Ultra-common words
    '今',
    'ここ',
    'そこ',
    'あそこ',
    'これ',
    'それ',
    'あれ',
    'どれ',
    'いつ',
    'どこ',
    'なに',
    'なん',
    'だれ',
    'どう',
    // Common verbs
    'ある',
    'いる',
    'する',
    'なる',
  ];

  return vocabList.filter((item) => {
    const word = item.word;

    // Only apply Japanese-specific filtering for Japanese language
    if (targetLanguage === 'ja') {
      // Rule 1: Minimum length (at least 2 characters for Japanese)
      if (word.length < 2) return false;

      // Rule 2: Stopword check
      if (japaneseStopwords.includes(word)) return false;

      // Rule 3: Don't extract single hiragana/katakana unless it's a special case
      if (/^[\u3040-\u309F\u30A0-\u30FF]$/.test(word)) return false;
    }

    return true;
  });
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
  _sentence: SentenceWithMetadata,
  _text: string,
  _targetLang: string
): string | undefined {
  // For now, return undefined - could be enhanced to extract reading for specific words
  // This would require more sophisticated parsing of the metadata
  return undefined;
}

export interface PromptBuildResult {
  prompt: string;
  metadata: {
    targetExchangeCount: number;
    vocabularySeeds: string;
    grammarSeeds: string;
  };
}

/**
 * Build the dialogue extraction prompt with vocabulary/grammar seeds.
 * Extracted from extractDialogueExchangesFromSourceText for admin Script Lab use.
 */
export async function buildDialogueExtractionPrompt(
  sourceText: string,
  episodeTitle: string,
  targetLanguage: string,
  _nativeLanguage: string,
  targetDurationMinutes: number = 15,
  jlptLevel?: string,
  speaker1Gender: 'male' | 'female' = 'male',
  speaker2Gender: 'male' | 'female' = 'female'
): Promise<PromptBuildResult> {
  // Estimate how many exchanges we need for target duration
  const estimatedSecondsPerExchange = 90;
  const targetSeconds = targetDurationMinutes * 60;
  const targetExchangeCount = Math.max(6, Math.floor(targetSeconds / estimatedSecondsPerExchange));

  // Sample vocabulary to seed the dialogue if proficiency level is specified
  let vocabularySeed = '';
  if (jlptLevel && targetLanguage) {
    console.log(`[PromptBuilder] Attempting to sample vocabulary for ${targetLanguage}:${jlptLevel}`);
    try {
      const seedWords = await sampleVocabulary(targetLanguage, jlptLevel, 30);
      console.log(`[PromptBuilder] Got ${seedWords.length} vocabulary seed words`);
      if (seedWords.length > 0) {
        const framework = getProficiencyFramework(targetLanguage);
        vocabularySeed = `

SUGGESTED ${jlptLevel} VOCABULARY TO INCORPORATE:
Try to naturally use some of these ${framework} ${jlptLevel}-level words in the dialogue:
${formatWordsForPrompt(seedWords, targetLanguage)}

You don't need to use all of them - just incorporate 5-10 naturally where they fit the conversation context.`;
        console.log(`[PromptBuilder] Generated vocabulary seed section (${vocabularySeed.length} chars)`);
      }
    } catch (error) {
      console.warn(`[PromptBuilder] Could not load ${jlptLevel} vocabulary for ${targetLanguage}:`, error);
    }
  } else {
    console.log(`[PromptBuilder] Skipping vocabulary seeds: jlptLevel=${jlptLevel}, targetLanguage=${targetLanguage}`);
  }

  // Sample grammar to seed the dialogue if proficiency level is specified
  let grammarSeed = '';
  if (jlptLevel && targetLanguage) {
    console.log(`[PromptBuilder] Attempting to sample grammar for ${targetLanguage}:${jlptLevel}`);
    try {
      const seedGrammar = await sampleGrammar(targetLanguage, jlptLevel, 5);
      console.log(`[PromptBuilder] Got ${seedGrammar.length} grammar seed patterns`);
      if (seedGrammar.length > 0) {
        const framework = getProficiencyFramework(targetLanguage);
        grammarSeed = `

SUGGESTED ${jlptLevel} GRAMMAR PATTERNS TO INCORPORATE:
Try to naturally use 2-3 of these ${framework} ${jlptLevel}-level grammar patterns in the dialogue:
${formatGrammarForPrompt(seedGrammar)}

Use these patterns where they naturally fit the conversation flow.`;
        console.log(`[PromptBuilder] Generated grammar seed section (${grammarSeed.length} chars)`);
      }
    } catch (error) {
      console.warn(`[PromptBuilder] Could not load ${jlptLevel} grammar for ${targetLanguage}:`, error);
    }
  } else {
    console.log(`[PromptBuilder] Skipping grammar seeds: jlptLevel=${jlptLevel}, targetLanguage=${targetLanguage}`);
  }

  // Build JLPT level constraint if specified
  const jlptConstraint = jlptLevel
    ? `\n\nIMPORTANT JLPT LEVEL CONSTRAINT:
- Target level: ${jlptLevel} (${getJLPTDescription(jlptLevel)})
- Use vocabulary and grammar structures appropriate for students at this level
- Avoid using words or structures significantly above this level
- Focus on practical, conversational language at this proficiency level${vocabularySeed}${grammarSeed}`
    : '';

  const speakerGenderConstraint = `

SPEAKERS:
- Use exactly TWO speakers throughout the dialogue
- Speaker 1 is ${speaker1Gender}; choose a name that matches this gender
- Speaker 2 is ${speaker2Gender}; choose a name that matches this gender
- Start the conversation with Speaker 1 and alternate turns`;

  const prompt = `You are creating a Pimsleur-style language lesson based on this scenario:

Title: "${episodeTitle}"
Scenario: "${sourceText}"

Generate ${targetExchangeCount} dialogue exchanges in ${targetLanguage.toUpperCase()} for this scenario. Create a realistic back-and-forth conversation.

For each exchange:
1. Write the line in ${targetLanguage.toUpperCase()} as plain text (this goes in "textL2")
2. ${targetLanguage === 'ja' ? 'Provide a SEPARATE reading in BRACKET NOTATION - put hiragana in brackets after each kanji (this goes in "reading"). Example textL2: "北海道に行きました", reading: "北[ほっ]海[かい]道[どう]に行[い]きました"' : ''}
3. Provide an English translation
4. Identify the speaker (give them a name like "Kenji", "Maria", "Bartender", etc.)
5. Provide a relationship description for narration (e.g., "Your friend", "The bartender", "Your colleague")
6. Extract 2-4 key vocabulary words or short phrases that would be useful to teach

${jlptConstraint}

Guidelines:
- Make the conversation natural and realistic
- Vary between questions and statements
- Keep the two speaker names consistent across all exchanges
- IMPORTANT: Keep each turn SHORT - one simple sentence, or at most one sentence + a tiny follow-up interjection/question
- AVOID run-on sentences or multiple topics in one turn
- Each turn should focus on ONE idea that's easy to hold in working memory
- Include practical, useful phrases
- For vocabulary, extract words/phrases in the EXACT form used in the sentence (e.g., past tense "楽しかった" not dictionary form "楽しい")
- Extract meaningful chunks, not just single words (e.g., "was fun" not just "fun", "I rode" not just "rode")
- The translation should match the exact form extracted (e.g., "was fun" for "楽しかった", not "fun")

Examples of GOOD turn length:
- "How was your trip to Hokkaido?" (simple question)
- "It was amazing! I went cycling." (statement + brief detail)
- "Really? How long were you there?" (interjection + short question)

Examples of BAD turn length (TOO LONG):
- "I went to Hokkaido last month and stayed for two weeks cycling around the island, and the weather was perfect except for one rainy day." (too many ideas)
- "That sounds wonderful! I've always wanted to visit Hokkaido. Did you enjoy the food there and what was your favorite place?" (multiple topics)

${speakerGenderConstraint}

${
  targetLanguage === 'ja'
    ? `
IMPORTANT for Japanese:
SENTENCE READING FORMAT:
- Use BRACKET NOTATION: put hiragana in brackets after each kanji
- Example: "北[ほっ]海[かい]道[どう]に行[い]きました"
- For particles and kana-only words, write them normally without brackets: "に", "を", "は"

VOCABULARY WORDS:
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
`
    : ''
}

Return ONLY a JSON object (no markdown, no explanation):
{
  "exchanges": [
    {
      "order": 0,
      "speakerName": "Kenji",
      "relationshipName": "Your friend",
      "textL2": "${targetLanguage === 'ja' ? '北海道に行きました' : '...'}",${
        targetLanguage === 'ja'
          ? `
      "reading": "北[ほっ]海[かい]道[どう]に行[い]きました",`
          : ''
      }
      "translation": "...",
      "vocabulary": [
        {"word": "...", ${targetLanguage === 'ja' ? '"reading": "...", "jlptLevel": "N4",' : ''} "translation": "..."},
        {"word": "...", ${targetLanguage === 'ja' ? '"reading": "...", "jlptLevel": "N3",' : ''} "translation": "..."}
      ]
    }
  ]
}`;

  const result = {
    prompt,
    metadata: {
      targetExchangeCount,
      vocabularySeeds: vocabularySeed,
      grammarSeeds: grammarSeed,
    },
  };

  console.log(`[PromptBuilder] Returning prompt with metadata:`, {
    targetExchangeCount: result.metadata.targetExchangeCount,
    hasVocabularySeeds: result.metadata.vocabularySeeds.length > 0,
    hasGrammarSeeds: result.metadata.grammarSeeds.length > 0,
    vocabularySeedLength: result.metadata.vocabularySeeds.length,
    grammarSeedLength: result.metadata.grammarSeeds.length,
  });

  return result;
}

/**
 * Run dialogue extraction: send prompt to Gemini, parse response, assign voices.
 * Extracted from extractDialogueExchangesFromSourceText for admin Script Lab use.
 * Does NOT include the automatic review/edit pass — the admin IS the reviewer.
 */
export async function runDialogueExtraction(
  prompt: string,
  targetLanguage: string,
  speaker1Gender: 'male' | 'female' = 'male',
  speaker2Gender: 'male' | 'female' = 'female',
  speakerVoices?: { speakerName: string; voiceId: string }[],
  speaker1VoiceId?: string,
  speaker2VoiceId?: string
): Promise<DialogueExchange[]> {
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

  const voicesConfig = (TTS_VOICES[targetLanguage as keyof typeof TTS_VOICES]?.voices ||
    []) as Array<{
    id: string;
    gender: 'male' | 'female';
    provider?: string;
  }>;
  const preferredProvider = voicesConfig.some((voice) => voice.provider === 'fishaudio')
    ? 'fishaudio'
    : undefined;

  const getFallbackVoices = (lang: string): [string, string] => {
    if (lang.toLowerCase() === 'ja') {
      return ['ja-JP-Wavenet-B', 'ja-JP-Wavenet-C'];
    }
    return ['en-US-Wavenet-F', 'en-US-Wavenet-D'];
  };

  const [fallbackFemale, fallbackMale] = getFallbackVoices(targetLanguage);

  const pickVoiceByGender = (
    gender: 'male' | 'female',
    fallbackId: string,
    excludeId?: string
  ): string => {
    const preferredVoices = voicesConfig.filter(
      (voice) =>
        voice.gender === gender && (!preferredProvider || voice.provider === preferredProvider)
    );
    const fallbackVoices = voicesConfig.filter((voice) => voice.gender === gender);
    const candidates = (preferredVoices.length ? preferredVoices : fallbackVoices).filter(
      (voice) => voice.id !== excludeId
    );

    if (candidates.length > 0) {
      return candidates[Math.floor(Math.random() * candidates.length)].id;
    }

    return fallbackId;
  };

  const speaker1Fallback = speaker1Gender === 'female' ? fallbackFemale : fallbackMale;
  const speaker2Fallback = speaker2Gender === 'female' ? fallbackFemale : fallbackMale;

  const speaker1Default = speaker1VoiceId || pickVoiceByGender(speaker1Gender, speaker1Fallback);
  const speaker2Default =
    speaker2VoiceId || pickVoiceByGender(speaker2Gender, speaker2Fallback, speaker1Default);

  const availableVoices = [speaker1Default, speaker2Default];

  // Track unique speakers and assign voices
  const speakerVoiceMap = new Map<string, string>();
  let voiceIndex = 0;

  for (const exchange of parsed.exchanges) {
    // Check if we've already assigned a voice to this speaker
    let voiceId = speakerVoiceMap.get(exchange.speakerName);

    if (!voiceId) {
      // Try to find voice from original dialogue speakers if names match
      voiceId = speakerVoices?.find(
        (v) => v.speakerName.toLowerCase() === exchange.speakerName.toLowerCase()
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
      relationshipName: exchange.relationshipName || exchange.speakerName,
      speakerVoiceId: voiceId,
      textL2: exchange.textL2,
      readingL2: exchange.reading || null,
      translationL1: exchange.translation,
      vocabularyItems,
    });
  }

  console.warn(`Generated ${exchanges.length} dialogue exchanges from prompt`);
  return exchanges;
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
  _speaker1Gender: 'male' | 'female' = 'male',
  _speaker2Gender: 'male' | 'female' = 'female',
  speaker1VoiceId?: string,
  speaker2VoiceId?: string
): Promise<DialogueExchange[]> {
  console.warn(`Extracting dialogue from source text for episode: ${episodeTitle}`);
  console.warn(
    `Target duration: ${targetDurationMinutes} minutes, JLPT Level: ${jlptLevel || 'unspecified'}`
  );

  // Step 1: Build the prompt
  const { prompt } = await buildDialogueExtractionPrompt(
    sourceText,
    episodeTitle,
    targetLanguage,
    nativeLanguage,
    targetDurationMinutes,
    jlptLevel,
    _speaker1Gender,
    _speaker2Gender
  );

  try {
    // Step 2: Run extraction
    const exchanges = await runDialogueExtraction(
      prompt,
      targetLanguage,
      _speaker1Gender,
      _speaker2Gender,
      speakerVoices,
      speaker1VoiceId,
      speaker2VoiceId
    );

    console.warn(`✅ Generated ${exchanges.length} dialogue exchanges from source text`);

    // Step 3: MULTI-PASS GENERATION: Review and edit if needed
    if (jlptLevel && exchanges.length > 0) {
      console.warn('Reviewing dialogue quality...');
      const review = await reviewDialogue(exchanges, jlptLevel, targetLanguage);

      console.warn(`Dialogue review: ${review.overallScore}/10`);
      if (review.strengths.length > 0) {
        console.warn(`Strengths: ${review.strengths.join(', ')}`);
      }
      if (review.issues.length > 0) {
        console.warn(`Issues found: ${review.issues.length}`);
      }

      // Edit if review indicates revision needed
      if (review.needsRevision) {
        console.warn('Revising dialogue based on feedback...');
        const revisedExchanges = await editDialogue(exchanges, review, jlptLevel, targetLanguage);

        // Merge revised content back into exchanges
        for (let i = 0; i < Math.min(exchanges.length, revisedExchanges.length); i++) {
          exchanges[i].textL2 = revisedExchanges[i].textL2;
          exchanges[i].translationL1 = revisedExchanges[i].translationL1;
          // Keep existing timing, voice assignments, etc.
        }

        console.warn('Dialogue revision complete');
      }
    }

    return exchanges;
  } catch (err) {
    console.error('Failed to extract dialogue from source text:', err);
    throw new Error(
      `Failed to generate dialogue exchanges: ${err instanceof Error ? err.message : 'Unknown error'}`
    );
  }
}

/**
 * Get human-readable description for JLPT level
 */
function getJLPTDescription(level: string): string {
  const descriptions: Record<string, string> = {
    N5: 'Beginner - Basic grammar, ~700 vocabulary words',
    N4: 'Upper Beginner - Elementary grammar, ~1500 vocabulary words',
    N3: 'Intermediate - Everyday grammar, ~3750 vocabulary words',
    N2: 'Upper Intermediate - Advanced grammar, ~6000 vocabulary words',
    N1: 'Advanced - Complex grammar, ~10000 vocabulary words',
  };
  return descriptions[level] || level;
}

/**
 * Extract vocabulary from individual sentences (for future use)
 * This could be used to extract sub-phrases or individual words
 */
export function extractVocabularyFromSentence(sentence: string, _targetLang: string): string[] {
  // Future enhancement: use NLP to extract key vocabulary
  // For now, just return the full sentence
  return [sentence];
}
