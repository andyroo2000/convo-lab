#!/usr/bin/env ts-node
/**
 * i18n Consistency Checker Harness
 *
 * Autonomously checks and fixes i18n consistency issues in ConvoLab:
 * - Missing translations across locales (ar, en, es, fr, ja, zh)
 * - Inconsistent translation keys
 * - Formatting issues in JSON files
 * - Unused translation keys
 * - Translation key usage validation against codebase
 *
 * Usage:
 *   npm run harness:i18n                           # Run full check and fix (500 turns)
 *   npm run harness:i18n -- --dry-run              # Report only, no fixes
 *   npm run harness:i18n -- --max-turns 1000       # Custom max turns
 *   npm run harness:i18n -- --quiet                # Minimal output
 */

import { query } from '@anthropic-ai/claude-agent-sdk';

interface HarnessOptions {
  dryRun?: boolean;
  maxTurns?: number;
  verbose?: boolean;
}

const DEFAULT_MAX_TURNS = 500; // High limit for comprehensive i18n fixes across all locales

async function runI18nHarness(options: HarnessOptions = {}) {
  const { dryRun = false, maxTurns = DEFAULT_MAX_TURNS, verbose = true } = options;

  console.log('🌍 ConvoLab i18n Consistency Checker Harness');
  console.log('═══════════════════════════════════════════\n');

  if (dryRun) {
    console.log('🔍 Running in DRY RUN mode (no changes will be made)\n');
  } else {
    console.log('⚡ Running in FIX mode (will make changes automatically)\n');
  }

  console.log(`⚙️  Max turns: ${maxTurns}`);

  if (maxTurns > 100) {
    console.log('\n⚠️  WARNING: Large run detected');
    console.log('   This may take hours and consume significant rate limit');
    console.log('   Max Plan limits: 225-900 messages per 5 hours');
    console.log('   The harness will stop if rate limits are hit\n');
  }

  console.log('Starting analysis...\n');

  const prompt = `
You are running an autonomous i18n translation checker for ConvoLab.

## CRITICAL: You MUST process ALL 15 locale files

Process EVERY file in this EXACT order. Do NOT skip any file:

1. audioCourse.json
2. auth.json
3. chunkPack.json
4. common.json
5. create.json
6. dialogue.json
7. errors.json
8. landing.json
9. library.json
10. narrowListening.json
11. notFound.json
12. onboarding.json
13. pricing.json
14. processingInstruction.json
15. settings.json

## Your Task

For EACH of the 15 files above, you must:

### 1. Read the English source file
- Read client/src/i18n/locales/en/[filename]
- Note all translation keys, structure, and English values

### 2. DEEP SCAN each target locale for English text
For each of ar, es, fr, ja, zh:
- Read client/src/i18n/locales/[locale]/[filename]
- **SCAN EVERY STRING VALUE** for English words
- Identify:
  - Missing keys (keys in en but not in this locale)
  - Extra keys (keys in this locale but not in en)
  - **ENGLISH TEXT in translation values** (e.g., "Delete" instead of "Eliminar")
  - Partial translations (e.g., "Click here para continuar")
  - Placeholder text like "[NEEDS_TRANSLATION]"
- Check JSON structure matches exactly

### 3. Detect English Text

For each string value, check if it contains English words that should be translated:
- **Exclude** proper nouns: ConvoLab, Google Cloud, TTS, GPT, etc.
- **Exclude** technical codes: N5, HSK, A1, B2, C1, etc.
- **Exclude** variable placeholders: {{name}}, {{count}}, etc.
- **TRANSLATE** everything else: buttons, labels, messages, descriptions

Examples of what to fix:
- ❌ "button": "Start" → ✅ "button": "開始" (ja) / "بدء" (ar)
- ❌ "description": "Click here to begin" → ✅ "description": "ここをクリックして開始" (ja)
- ❌ "title": "Audio Course" → ✅ "title": "音声コース" (ja)

### 4. ${dryRun ? 'Report all issues' : 'Fix all issues'}
${
  dryRun
    ? `
- List ALL missing keys for this file
- List ALL extra keys for this file
- List ALL strings containing untranslated English text
- Note any formatting issues
`
    : `
- Add missing translation keys
- Remove extra/obsolete keys
- **TRANSLATE all English text to the target language**
- Fix formatting (2-space indentation)
- Ensure consistent JSON structure

**IMPORTANT TRANSLATION RULES:**
- ar (Arabic): Translate to Modern Standard Arabic (العربية)
- es (Spanish): Translate to Spanish (Español)
- fr (French): Translate to French (Français)
- ja (Japanese): Translate to Japanese (日本語)
- zh (Chinese): Translate to Simplified Chinese (简体中文)
- Use natural, native-sounding translations
- Preserve variable placeholders like {{count}}, {{name}}
- Keep technical terms (ConvoLab, TTS, API) unchanged
- Maintain consistent terminology across the file
`
}

## Your Workflow - MANDATORY STEPS

1. **Process files sequentially** - Go through files 1-15 in order
2. **Announce each file** - State "Processing [filename]..." before working on it
3. **Read systematically** - Read en/[file], then ar/[file], es/[file], fr/[file], ja/[file], zh/[file]
4. **Deep scan** - Check EVERY string value for English text
5. **${dryRun ? 'Report' : 'Fix'}** - ${dryRun ? 'Report all issues found' : 'Translate all English text immediately'}
6. **Track progress** - After each file, state "Completed X of 15 files"
7. **Verify completion** - At the end, confirm all 15 files were processed
${!dryRun ? '8. **Commit once** - Use /commit once at the very end with all changes' : ''}

## Important Notes

- **DO NOT skip files** - Process all 15 files even if some appear translated
- **DO NOT skip strings** - Check every single string value for English
- **DO NOT use shortcuts** - Read each locale file individually
- **DO NOT leave English text** - Translate everything except proper nouns
- State your progress clearly: "Processing file X of 15: [filename]"
- For each file, report: "Found X untranslated strings in [locale]"
${!dryRun ? '- Only use /commit once at the end with all changes' : ''}
- At the end, provide a summary showing all 15 files were processed and all English text was translated

Begin with file 1: audioCourse.json
  `.trim();

  const startTime = Date.now();

  try {
    let messageCount = 0;
    let lastMessage = '';
    let lastProgressUpdate = Date.now();

    for await (const message of query({
      prompt,
      options: {
        cwd: '/Users/andrewlandry/source/convo-lab',
        permissionMode: dryRun ? 'default' : 'acceptEdits',
        maxTurns,
        allowedTools: dryRun
          ? ['Read', 'Glob', 'Grep']
          : ['Read', 'Edit', 'Glob', 'Grep', 'Bash', 'Skill'],
        systemPrompt: `You are an i18n expert maintaining ConvoLab's translations.
Follow the project's CLAUDE.md guidelines. Be thorough but efficient.
${dryRun ? 'This is a dry run - REPORT ONLY, make NO changes.' : 'Fix issues and use /commit when done.'}`,
      },
    })) {
      messageCount++;

      // Show progress every 10 turns or every 30 seconds
      const now = Date.now();
      if (messageCount % 10 === 0 || now - lastProgressUpdate > 30000) {
        const progress = ((messageCount / maxTurns) * 100).toFixed(1);
        console.log(`\n📊 Progress: ${messageCount}/${maxTurns} turns (${progress}%)`);
        lastProgressUpdate = now;
      }

      // Log assistant messages
      if (message.type === 'assistant' && message.message?.content) {
        for (const block of message.message.content) {
          if ('text' in block && block.text) {
            lastMessage = block.text;
            if (verbose) {
              console.log(`\n💬 Claude: ${block.text}`);
            }
          }
          if ('tool_use' in block && verbose) {
            console.log(`\n🔧 Using tool: ${block.tool_use.name}`);
          }
        }
      }

      // Log results
      if (message.type === 'result') {
        if (verbose) {
          console.log(`\n✓ Result: ${message.subtype}`);
        }

        // Store last result
        if (message.subtype === 'success') {
          lastMessage = 'Harness completed successfully';
        }
      }
    }

    const endTime = Date.now();
    const durationMs = endTime - startTime;
    const durationMin = (durationMs / 60000).toFixed(1);
    const durationHr = (durationMs / 3600000).toFixed(2);

    console.log('\n\n═══════════════════════════════════════════');
    console.log('✅ Harness Complete');
    console.log('═══════════════════════════════════════════\n');
    console.log(`📊 Total messages: ${messageCount}`);
    console.log(`⏱️  Duration: ${durationMin} minutes (${durationHr} hours)`);
    console.log(
      `📝 Final status: ${lastMessage.substring(0, 100)}${lastMessage.length > 100 ? '...' : ''}`
    );

    if (dryRun) {
      console.log('\n💡 This was a dry run. To apply fixes, run without --dry-run flag.');
    }
  } catch (error) {
    console.error('\n❌ Harness failed with error:');
    console.error(error);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);

// Check for --max-turns argument
let customMaxTurns = DEFAULT_MAX_TURNS;
const maxTurnsIndex = args.findIndex((arg) => arg === '--max-turns');
if (maxTurnsIndex !== -1 && args[maxTurnsIndex + 1]) {
  customMaxTurns = parseInt(args[maxTurnsIndex + 1], 10);
  if (isNaN(customMaxTurns)) {
    console.error('Invalid --max-turns value. Using default:', DEFAULT_MAX_TURNS);
    customMaxTurns = DEFAULT_MAX_TURNS;
  }
}

const options: HarnessOptions = {
  dryRun: args.includes('--dry-run'),
  verbose: !args.includes('--quiet'),
  maxTurns: customMaxTurns,
};

// Run the harness
runI18nHarness(options).catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
