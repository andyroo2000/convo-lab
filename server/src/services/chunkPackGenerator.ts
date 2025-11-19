import { GoogleGenerativeAI } from '@google/generative-ai';
import { JLPTLevel, ChunkPackTheme, getThemeMetadata } from '../config/chunkThemes.js';
import { GeneratedChunkPack } from '../types/chunkPack.js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

/**
 * Generate a chunk pack with 5-8 lexical chunks, examples, story, and exercises
 */
export async function generateChunkPack(
  jlptLevel: JLPTLevel,
  theme: ChunkPackTheme
): Promise<GeneratedChunkPack> {
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash-exp',
    generationConfig: {
      temperature: 0.9,
      responseMimeType: 'application/json',
    },
  });

  const prompt = buildChunkPackPrompt(jlptLevel, theme);

  try {
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const data = JSON.parse(responseText);

    // Strip furigana from all text before returning
    return cleanChunkPackFurigana(data);
  } catch (error) {
    console.error('Error generating chunk pack:', error);
    throw new Error('Failed to generate chunk pack');
  }
}

/**
 * Remove furigana from text (bracket notation or parentheses)
 */
function removeFurigana(text: string): string {
  return text
    .replace(/\[[^\]]+\]/g, '')      // Bracket notation: 買[か]い物[もの] -> 買い物
    .replace(/（[^）]+）/g, '')      // Full-width parentheses
    .replace(/\([^)]+\)/g, '')       // Half-width parentheses
    .replace(/\s+/g, ' ')            // Clean up extra spaces
    .trim();
}

/**
 * Recursively clean furigana from chunk pack data
 */
function cleanChunkPackFurigana(data: GeneratedChunkPack): GeneratedChunkPack {
  return {
    ...data,
    title: removeFurigana(data.title),
    chunks: data.chunks.map(chunk => ({
      ...chunk,
      form: removeFurigana(chunk.form),
    })),
    examples: data.examples.map(example => ({
      ...example,
      sentence: removeFurigana(example.sentence),
    })),
    stories: data.stories.map(story => ({
      ...story,
      title: removeFurigana(story.title),
      storyText: removeFurigana(story.storyText),
      segments: story.segments.map(segment => ({
        ...segment,
        japaneseText: removeFurigana(segment.japaneseText),
      })),
    })),
    exercises: data.exercises.map(exercise => ({
      ...exercise,
      prompt: removeFurigana(exercise.prompt),
      options: exercise.options.map(opt => removeFurigana(opt)),
      correctOption: removeFurigana(exercise.correctOption),
    })),
  };
}

function buildChunkPackPrompt(jlptLevel: JLPTLevel, theme: ChunkPackTheme): string {
  const themeMetadata = getThemeMetadata(theme);
  const vocabularyConstraints = getVocabularyConstraints(jlptLevel);
  const chunkGuidance = getChunkGuidanceForTheme(theme, jlptLevel);

  return `You are a Japanese language learning expert specializing in lexical chunks and usage-based learning.

Generate a "Lexical Chunk Pack" that teaches 5-8 high-value Japanese chunks for ${jlptLevel} learners on the theme: "${themeMetadata.name}".

THEME CONTEXT: ${themeMetadata.description}
USAGE CONTEXT: ${themeMetadata.usageContext}
EXAMPLE CHUNKS FOR THIS THEME: ${themeMetadata.exampleChunks.join(', ')}

${chunkGuidance}

=== PEDAGOGICAL PRINCIPLES ===

1. **CHUNK FIRST, GRAMMAR SECOND**
   - Focus on multi-word units learners can reuse immediately
   - Patterns (〜ておく, 〜てしまう), sentence frames (〜と思います), fixed expressions (お疲れ様です)
   - Grammar explanation is minimal; usage and meaning are primary

2. **HIGH FREQUENCY & USEFULNESS**
   - Choose chunks that appear very often in natural conversation
   - Avoid obscure idioms
   - Prefer chunks learners will use in real situations

3. **LEVEL-APPROPRIATE COMPLEXITY**
${getLevelGuidance(jlptLevel)}

4. **RECYCLING REQUIREMENT**
   - Every chunk MUST appear:
     - In at least 2 different example sentences
     - In the story at least 2 times (ideally 3-4 times)
   - This creates a mini "input flood" for strong memory

5. **NATURALNESS OVER TEXTBOOK-NESS**
   - Chunks must sound like something a real Japanese speaker would say
   - Avoid robotic or overly stiff phrasing
   - Use natural context and register

${vocabularyConstraints}

=== OUTPUT REQUIREMENTS ===

Return a JSON object with this EXACT structure:

{
  "title": "Short pack title (e.g., '毎日の習慣 - Daily Routines')",
  "chunks": [
    {
      "form": "Japanese chunk (e.g., 「〜ておきます」or「買い物する」)",
      "translation": "Natural English gloss (e.g., 'do ~ in advance')",
      "literalGloss": "Optional literal meaning (can be null if not helpful)",
      "register": "polite" | "casual" | "neutral",
      "function": "Short usage description (e.g., 'preparing for later')",
      "notes": "1-2 short notes on nuance, constraints, or common collocations (50-80 chars)"
    }
    // ... 5-8 chunks total
  ],
  "examples": [
    {
      "chunkForm": "The exact form from chunks array that this demonstrates",
      "sentence": "Natural Japanese sentence",
      "english": "English translation",
      "contextNote": "Optional one-line context (e.g., 'friend to friend', 'at work') - can be null"
    }
    // ... 2-3 examples per chunk (10-24 total)
  ],
  "stories": [
    {
      "title": "Short Japanese or English title",
      "type": "narrative" | "dialogue",
      "storyText": "Full Japanese story (5-8 sentences, coherent, reuses ALL chunks naturally)",
      "english": "Full English translation",
      "segments": [
        {
          "japaneseText": "Individual sentence",
          "englishTranslation": "Translation of this sentence"
        }
        // ... 5-8 segments (one per sentence)
      ]
    }
    // Generate exactly 1 story
  ],
  "exercises": [
    {
      "exerciseType": "chunk_to_meaning" | "meaning_to_chunk" | "gap_fill_mc",
      "prompt": "Question/prompt",
      "options": ["option 1", "option 2", "option 3"],
      "correctOption": "The exact correct option from options array",
      "explanation": "Short usage-based explanation (60-100 chars)"
    }
    // ... 8-12 exercises total, mix of all 3 types
  ]
}

=== EXERCISE TYPE GUIDANCE ===

**CRITICAL**: All options must be DISTINCT and DIFFERENT from each other. Never repeat the same option twice.

**chunk_to_meaning** (3-4 exercises):
- prompt: Show the chunk in Japanese (e.g., "What does 〜ておきます mean?")
- options: 2-3 DISTINCT possible meanings (each option must be clearly different)
- correctOption: The right meaning
- explanation: When/how it's used

**meaning_to_chunk** (3-4 exercises):
- prompt: Give English meaning or situation (e.g., "How do you say 'do something in advance'?")
- options: 2-3 DISTINCT chunk options (each must be different)
- correctOption: The right chunk
- explanation: Why this chunk fits

**gap_fill_mc** (2-4 exercises):
- prompt: Sentence with blank (e.g., "明日までに終わらせて___。")
- options: 2-3 DISTINCT chunk options that could fill the gap (each must be different)
- correctOption: The most natural chunk
- explanation: Why this chunk is best in this context

=== STORY REQUIREMENTS ===

The story MUST:
1. Be coherent and thematically consistent with "${themeMetadata.name}"
2. Use ALL chunks in the pack at least twice
3. Sound natural - like something a Japanese person would write/say
4. Be suitable for audio playback (clear sentence breaks)
5. Match ${jlptLevel} vocabulary level
6. Be 5-8 sentences long (not too short, not too long)
7. Type can be "narrative" (one speaker) or "dialogue" (conversation)

For dialogue stories:
- Use clear speaker markers like「田中：」「鈴木：」
- Keep turns relatively short (1-2 sentences per turn)
- Make the conversation feel natural and contextual

=== QUALITY CONTROL CHECKLIST ===

Before outputting, verify:
✓ Exactly 5-8 chunks selected
✓ All chunks are high-frequency and useful
✓ All chunks match ${jlptLevel} level
✓ Every chunk appears in at least 2 examples
✓ Every chunk appears in story at least 2 times
✓ Story is coherent and natural
✓ All example sentences are level-appropriate
✓ 8-12 exercises, balanced across types
✓ All exercises test chunks directly (not grammar knowledge)
✓ **CRITICAL**: Every exercise has DISTINCT options (no duplicates)
✓ Explanations focus on usage, not rules
✓ Nothing sounds robotic or textbook-y

Now generate the chunk pack.`;
}

function getVocabularyConstraints(jlptLevel: JLPTLevel): string {
  switch (jlptLevel) {
    case 'N5':
      return `=== VOCABULARY CONSTRAINTS (N5) ===
- Use only basic, concrete vocabulary (people, daily objects, places, basic actions)
- Kanji usage: Minimal - mostly hiragana, use kanji only for very common words (日, 月, 人, 食べる, etc.)
- Sentence length: Short and simple (5-12 words maximum)
- Grammar: Present tense, past tense, です/ます forms only
- Avoid: Abstract concepts, complex grammar, long sentences`;

    case 'N4':
      return `=== VOCABULARY CONSTRAINTS (N4) ===
- Expand to more abstract vocabulary (feelings, plans, descriptions)
- Kanji usage: Common N4 kanji, but still provide readings for learners
- Sentence length: Medium (8-15 words)
- Grammar: Can use て-form combinations, たい, basic conditionals
- Include: Time expressions, some adverbs, comparison phrases
- Avoid: Advanced grammar, specialized vocabulary`;

    case 'N3':
      return `=== VOCABULARY CONSTRAINTS (N3) ===
- Include more nuanced and abstract vocabulary
- Kanji usage: Standard N3 kanji, expect literacy at this level
- Sentence length: Medium to long (10-20 words)
- Grammar: Complex structures (conditionals, ように, ために, passive, etc.)
- Include: Discourse markers, sentence-level patterns, subtle distinctions
- Avoid: Very formal or archaic expressions`;
  }
}

function getLevelGuidance(jlptLevel: JLPTLevel): string {
  switch (jlptLevel) {
    case 'N5':
      return `   - N5: Extremely simple, concrete, polite forms first
   - Focus on survival Japanese and basic interactions
   - Chunks should be memorizable and immediately usable
   - Prefer ます/です forms for politeness`;

    case 'N4':
      return `   - N4: More abstract, slightly longer chunks, introduce casual forms
   - Include sentence-level patterns (〜と思います, 〜かもしれません)
   - Mix polite and casual register appropriately
   - Focus on expressing opinions, plans, and feelings`;

    case 'N3':
      return `   - N3: Richer nuance, complex sentence patterns
   - Include discourse-level chunks and subtle distinctions
   - Expect learners to handle longer multi-clause sentences
   - Focus on workplace, social expectations, subtle reasoning`;
  }
}

function getChunkGuidanceForTheme(theme: ChunkPackTheme, jlptLevel: JLPTLevel): string {
  const themeMetadata = getThemeMetadata(theme);

  // Provide specific guidance based on the theme
  return `=== CHUNK SELECTION GUIDANCE FOR "${themeMetadata.name}" ===

Example chunks for this theme: ${themeMetadata.exampleChunks.join(', ')}

Choose chunks that:
1. Are directly useful for: ${themeMetadata.usageContext}
2. Are high-frequency in this context
3. Match ${jlptLevel} complexity level
4. Can be recycled naturally in a coherent story about ${themeMetadata.name}

For this theme, prioritize:
${getThemeSpecificPriorities(theme)}`;
}

function getThemeSpecificPriorities(theme: ChunkPackTheme): string {
  // Provide theme-specific priorities
  const priorities: Record<ChunkPackTheme, string> = {
    // N5 themes
    daily_routine: '- Time-related chunks, sequential actions, polite requests',
    greetings: '- Fixed expressions, social formulas, workplace/school phrases',
    shopping: '- Request chunks, asking for items, politeness markers',
    family: '- Existence verbs, relationship markers, age/description chunks',
    school: '- Academic vocabulary chunks, likes/dislikes, ability expressions',
    food: '- Preference chunks, taste descriptions, ordering phrases',
    weather: '- Description chunks, future/prediction, condition markers',
    hobbies: '- Activity chunks, frequency, preference expressions',

    // N4 themes
    health: '- Obligation chunks, advice patterns, regret expressions',
    travel: '- Planning chunks, experience markers, intention patterns',
    opinions: '- Hedging chunks, uncertainty markers, hearsay expressions',
    plans: '- Intention chunks, decision markers, future plans',
    feelings: '- Emotion chunks with て-form, reaction patterns',
    requests: '- Polite request patterns, permission chunks',
    advice: '- Recommendation chunks, conditional patterns',
    experiences: '- Past experience chunks, completion markers',

    // N3 themes
    work: '- Professional chunks, obligation patterns, workplace formulas',
    social_life: '- Expectation chunks, social norm markers',
    habits: '- Habitual action chunks, routine markers',
    expectations: '- Certainty chunks, prediction patterns',
    comparisons: '- Comparison chunks, degree markers',
    reasoning: '- Causal chunks, attribution patterns',
    preferences: '- Preference chunks, choice markers',
    goals: '- Purpose chunks, objective markers',
  };

  return priorities[theme] || '- Context-appropriate chunks for this theme';
}
