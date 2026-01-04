#!/usr/bin/env ts-node
/**
 * Language Seed Data Generation Harness
 *
 * Autonomously generates vocabulary and grammar seed data for all supported languages.
 * Uses Claude Agent SDK to systematically research and create comprehensive lists.
 *
 * Languages: Chinese (HSK), Spanish (CEFR), French (CEFR), Arabic (CEFR)
 *
 * Usage:
 *   npm run harness:lang-seeds                 # All languages
 *   npm run harness:lang-seeds:test            # Quick test (Chinese HSK1 only)
 *   npm run harness:lang-seeds:chinese         # Chinese only
 *   npm run harness:lang-seeds:spanish         # Spanish only
 *   npm run harness:lang-seeds:french          # French only
 *   npm run harness:lang-seeds:arabic          # Arabic only
 */

import { query } from '@anthropic-ai/claude-agent-sdk';

interface HarnessOptions {
  language?: string;
  level?: string;
  test?: boolean;
  maxTurns?: number;
}

const LANGUAGE_CONFIGS = {
  zh: {
    name: 'Chinese (Mandarin)',
    framework: 'HSK',
    levels: ['HSK1', 'HSK2', 'HSK3', 'HSK4', 'HSK5', 'HSK6'],
    vocabularyTargets: { HSK1: 150, HSK2: 300, HSK3: 600, HSK4: 1200, HSK5: 2500, HSK6: 5000 },
    grammarTargets: { HSK1: 40, HSK2: 80, HSK3: 120, HSK4: 160, HSK5: 200, HSK6: 240 },
    needsReading: true, // pinyin
  },
  es: {
    name: 'Spanish',
    framework: 'CEFR',
    levels: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
    vocabularyTargets: { A1: 800, A2: 1500, B1: 3000, B2: 6000, C1: 10000, C2: 15000 },
    grammarTargets: { A1: 50, A2: 80, B1: 120, B2: 150, C1: 180, C2: 200 },
    needsReading: false,
  },
  fr: {
    name: 'French',
    framework: 'CEFR',
    levels: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
    vocabularyTargets: { A1: 800, A2: 1500, B1: 3000, B2: 6000, C1: 10000, C2: 15000 },
    grammarTargets: { A1: 50, A2: 80, B1: 120, B2: 150, C1: 180, C2: 200 },
    needsReading: false,
  },
  ar: {
    name: 'Arabic',
    framework: 'CEFR',
    levels: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
    vocabularyTargets: { A1: 800, A2: 1500, B1: 3000, B2: 6000, C1: 10000, C2: 15000 },
    grammarTargets: { A1: 50, A2: 80, B1: 120, B2: 150, C1: 180, C2: 200 },
    needsReading: false,
  },
};

const DEFAULT_MAX_TURNS = 100;

async function runLanguageSeedsHarness(options: HarnessOptions = {}) {
  const { language, level, test = false, maxTurns = DEFAULT_MAX_TURNS } = options;

  console.log('🌍 ConvoLab Language Seed Data Generator');
  console.log('═══════════════════════════════════════\n');

  if (test) {
    console.log('🧪 Running in TEST mode (small samples)\n');
  }

  // Determine which languages and levels to process
  const languagesToProcess = language ? [language] : Object.keys(LANGUAGE_CONFIGS);
  const configsToProcess = languagesToProcess.map((lang) => ({
    code: lang,
    ...LANGUAGE_CONFIGS[lang as keyof typeof LANGUAGE_CONFIGS],
  }));

  // Build task list
  const tasks: Array<{ lang: string; langName: string; framework: string; level: string }> = [];
  for (const config of configsToProcess) {
    const levels = level ? [level] : config.levels;
    for (const lvl of levels) {
      tasks.push({
        lang: config.code,
        langName: config.name,
        framework: config.framework,
        level: lvl,
      });
    }
  }

  console.log(`📋 Tasks to complete: ${tasks.length * 2} (${tasks.length} vocab + ${tasks.length} grammar)\n`);

  if (tasks.length > 10 && !test) {
    console.log('⚠️  WARNING: Large run detected');
    console.log('   This may take several hours');
    console.log('   Progress will be saved after each file\n');
  }

  console.log('Starting generation...\n');

  const prompt = buildPrompt(configsToProcess, level, test);

  try {
    let messageCount = 0;

    for await (const message of query({
      prompt,
      options: {
        cwd: '/Users/andrewlandry/source/convo-lab',
        permissionMode: 'acceptEdits',
        maxTurns,
        allowedTools: ['Read', 'Write', 'Glob', 'Grep', 'Bash', 'WebSearch', 'WebFetch'],
        systemPrompt: `You are a language education expert and curriculum designer with deep knowledge of language proficiency frameworks (HSK, CEFR). You excel at creating comprehensive, level-appropriate vocabulary and grammar lists for language learners.

Your task is to generate seed data files for ConvoLab's language learning system.

CRITICAL: Before generating any content, search for existing high-quality datasets on GitHub and other sources. We successfully used community-vetted GitHub datasets for Japanese (expanding vocabulary lists 10-50x), and you should do the same for Chinese, Spanish, French, and Arabic.

Be thorough, accurate, and ensure all content is appropriate for each proficiency level.`,
      },
    })) {
      messageCount++;

      // Show agent progress
      if (message.type === 'text') {
        console.log(`\n[Turn ${messageCount}] ${message.text.slice(0, 200)}${message.text.length > 200 ? '...' : ''}`);
      } else if (message.type === 'tool_use') {
        console.log(`\n[Turn ${messageCount}] Using tool: ${message.name}`);
      }
    }

    console.log('\n\n✅ Language seed generation complete!');
    console.log(`📁 Files saved to: server/src/data/vocabulary/ and server/src/data/grammar/`);
  } catch (error: any) {
    console.error('\n❌ Error during generation:', error.message);
    throw error;
  }
}

function buildPrompt(configs: any[], specificLevel?: string, testMode = false): string {
  const tasks = configs.flatMap((config) => {
    const levels = specificLevel ? [specificLevel] : config.levels;
    return levels.flatMap((level) => [
      { lang: config.code, name: config.name, framework: config.framework, level, type: 'vocabulary', ...config },
      { lang: config.code, name: config.name, framework: config.framework, level, type: 'grammar', ...config },
    ]);
  });

  let prompt = `You are generating language seed data files for ConvoLab's language learning system.

${testMode ? '## 🧪 TEST MODE\nGenerate SMALL SAMPLE lists (5 vocabulary words, 3 grammar points) to verify the system works.\n' : ''}

## Your Task

You must create ${tasks.length} JSON files. Process them in order without stopping:

`;

  tasks.forEach((task, idx) => {
    const target = testMode
      ? task.type === 'vocabulary' ? 5 : 3
      : task.type === 'vocabulary'
      ? task.vocabularyTargets[task.level]
      : task.grammarTargets[task.level];

    prompt += `${idx + 1}. ${task.name} ${task.level} ${task.type} (${target} items)\n`;
  });

  prompt += `\n## File Format

### Vocabulary Files
Location: \`server/src/data/vocabulary/{language}/{level}.json\`

Structure:
\`\`\`json
{
  "language": "zh",
  "level": "HSK1",
  "framework": "HSK",
  "vocabulary": [
    {
      "word": "你好",
      "reading": "nǐ hǎo",
      "translation": "hello",
      "partOfSpeech": "greeting"
    }
  ]
}
\`\`\`

${configs.some(c => c.needsReading) ? `**Reading field**:
- Chinese: Use pinyin with tone marks (nǐ hǎo)
- Other languages: Omit reading field
` : ''}

### Grammar Files
Location: \`server/src/data/grammar/{language}/{level}.json\`

Structure:
\`\`\`json
{
  "language": "es",
  "level": "A1",
  "framework": "CEFR",
  "grammarPoints": [
    {
      "pattern": "ser + adjective",
      "meaning": "to describe characteristics",
      "usage": "Use 'ser' for permanent or defining characteristics",
      "example": "Soy estudiante",
      "exampleTranslation": "I am a student"
    }
  ]
}
\`\`\`

## Generation Guidelines

For each language/level, follow this process:

### Step 1: Find GitHub Datasets (CRITICAL)
**Before generating anything**, search GitHub for comprehensive, community-vetted datasets:

- Use the Bash tool with curl or the Grep tool to search for existing repositories
- Look for patterns like:
  - "HSK vocabulary list" (for Chinese)
  - "CEFR Spanish vocabulary" (for Spanish)
  - "French A1 A2 word list" (for French)
  - "Arabic CEFR grammar patterns" (for Arabic)
- **Prioritize**: Official datasets, widely-used study resources, community-maintained lists
- **Example**: For Japanese, we used GitHub repos that expanded N5 from 30→718 words, N4 from 50→666 words

### Step 2: Review and Process Dataset
If you find a good GitHub dataset:
- Read/fetch the data
- Verify it matches the proficiency level
- Convert to our JSON format
- Ensure all required fields are present (word, reading, translation, partOfSpeech)

### Step 3: Generate if Needed
Only generate from scratch if:
- No suitable GitHub dataset exists for this language/level
- Dataset needs significant supplementation
- Dataset quality is questionable

When generating:
- **Vocabulary**: High-frequency, essential words
  - Varied parts of speech (nouns, verbs, adjectives, etc.)
  - Level-appropriate (not too easy, not too hard)
  - For Chinese: accurate pinyin with tone marks
- **Grammar**: Core patterns for this level
  - Clear explanations
  - Natural, authentic examples
  - Accurate translations

### Step 4: Create File
Use the Write tool to create the JSON file at the correct path.

### Step 5: Move to Next File
Continue to the next file immediately. Do NOT stop to ask if you should continue.

## Quality Standards

✅ **Accurate**: Correct translations, readings, and grammar explanations
✅ **Level-appropriate**: Content matches the proficiency level
✅ **Comprehensive**: Covers essential vocabulary/grammar for the level
✅ **Well-formatted**: Valid JSON with proper structure
✅ **Natural**: Examples sound authentic and natural

## IMPORTANT - Autonomous Mode

You are in AUTONOMOUS MODE:
- ✅ Process ALL ${tasks.length} files automatically
- ✅ Move from file 1 → file 2 → ... → file ${tasks.length} without asking
- ❌ Do NOT stop after completing a few files
- ❌ Do NOT ask "should I continue?"
- ❌ Do NOT create recommendations for next session

If you find yourself thinking "let me stop here and suggest next steps", STOP THAT THOUGHT and continue to the next file instead.

Begin with file 1.
`;

  return prompt.trim();
}

// Parse command line arguments
const args = process.argv.slice(2);
const options: HarnessOptions = {};

for (const arg of args) {
  if (arg.startsWith('--language=')) {
    options.language = arg.split('=')[1];
  } else if (arg.startsWith('--level=')) {
    options.level = arg.split('=')[1];
  } else if (arg === '--test') {
    options.test = true;
  } else if (arg.startsWith('--max-turns=')) {
    options.maxTurns = parseInt(arg.split('=')[1], 10);
  }
}

// Run the harness
runLanguageSeedsHarness(options).catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
