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
 *   npm run harness:i18n -- --watchdog-timeout 300000  # Custom watchdog timeout
 *   npm run harness:i18n -- --disable-watchdog     # Disable watchdog for debugging
 */

import { query } from '@anthropic-ai/claude-agent-sdk';
import { runResilientHarness } from './utils/resilient-harness-wrapper.js';
import { enhanceSystemPrompt } from './utils/timeout-system-prompt.js';
import { formatDuration } from './utils/format-duration.js';

interface HarnessOptions {
  dryRun?: boolean;
  maxTurns?: number;
  verbose?: boolean;
  watchdogTimeout?: number; // Progress watchdog timeout in ms
  disableWatchdog?: boolean; // Disable watchdog entirely
}

const DEFAULT_MAX_TURNS = 50000; // High limit for comprehensive i18n fixes across all locales

async function runI18nHarness(options: HarnessOptions = {}) {
  const {
    dryRun = false,
    maxTurns = DEFAULT_MAX_TURNS,
    verbose = true,
    watchdogTimeout,
    disableWatchdog = false,
  } = options;

  console.log('🌍 ConvoLab i18n Consistency Checker Harness');
  console.log('═══════════════════════════════════════════\n');

  if (dryRun) {
    console.log('🔍 Running in DRY RUN mode (no changes will be made)\n');
  } else {
    console.log('⚡ Running in FIX mode (will make changes automatically)\n');
  }

  console.log(`⚙️  Max turns: ${maxTurns}`);
  if (!disableWatchdog) {
    console.log(`⏱️  Watchdog timeout: ${watchdogTimeout || 300000}ms`);
  }

  if (maxTurns > 100) {
    console.log('\n⚠️  WARNING: Large run detected');
    console.log('   This may take hours and consume significant rate limit');
    console.log('   Max Plan limits: 225-900 messages per 5 hours');
    console.log('   The harness will stop if rate limits are hit\n');
  }

  console.log('Starting analysis...\n');

  const prompt = `
You are running an autonomous i18n translation checker for ConvoLab.

## CRITICAL: You MUST process ALL 13 locale files

Process EVERY file in this EXACT order. Do NOT skip any file:

1. audioCourse.json
2. auth.json
3. common.json
4. create.json
5. dialogue.json
6. errors.json
7. landing.json
8. library.json
9. narrowListening.json
10. notFound.json
11. onboarding.json
12. pricing.json
13. settings.json

## Your Task

For EACH of the 13 files above, you must:

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

## Progress Tracking

Create /tmp/i18n-progress.json to track your work:
\`\`\`json
{
  "startedAt": "ISO timestamp",
  "currentFile": 1,
  "totalFiles": 13,
  "localesComplete": {
    "audioCourse.json": ["en", "ar", "es", "fr", "ja", "zh"],
    "auth.json": []
  },
  "issuesFound": 0,
  "issuesFixed": 0,
  "filesComplete": 0
}
\`\`\`

Update this file after completing each locale. Report progress every 5 files:
\`cat /tmp/i18n-progress.json | jq '.'\`

## Your Workflow - MANDATORY STEPS

1. **Process files sequentially** - Go through files 1-13 in order
2. **Announce each file** - State "Processing [filename]..." before working on it
3. **Read systematically** - Read en/[file], then ar/[file], es/[file], fr/[file], ja/[file], zh/[file]
4. **Deep scan** - Check EVERY string value for English text
5. **${dryRun ? 'Report' : 'Fix'}** - ${dryRun ? 'Report all issues found' : 'Translate all English text immediately'}
6. **Track progress** - After each file, update /tmp/i18n-progress.json and state "Completed X of 13 files"
7. **Verify completion** - At the end, confirm all 13 files were processed
${!dryRun ? '8. **Commit once** - Use /commit once at the very end with all changes' : ''}

## Important Notes

- **DO NOT skip files** - Process all 13 files even if some appear translated
- **DO NOT skip strings** - Check every single string value for English
- **DO NOT use shortcuts** - Read each locale file individually
- **DO NOT leave English text** - Translate everything except proper nouns
- State your progress clearly: "Processing file X of 13: [filename]"
- For each file, report: "Found X untranslated strings in [locale]"
${!dryRun ? '- Only use /commit once at the end with all changes' : ''}
- At the end, provide a summary showing all 13 files were processed and all English text was translated

${!dryRun ? `
## Pre-Commit Hook Awareness

When you commit, the pre-commit hook will:
- Run lint-staged (lints staged files)
- Run server tests if server files changed
- Fail the commit if either fails

JSON files should pass linting if properly formatted (2-space indent, no trailing commas).

## Session Completion Rules

You are in AUTONOMOUS MODE. This means:
- ✅ Process ALL 13 translation files automatically without stopping
- ✅ Move from file 1 → file 2 → ... → file 13 without asking
- ✅ Only create ONE commit at the very end
- ❌ Do NOT stop after completing a few files
- ❌ Do NOT ask "should I continue?"
- ❌ Do NOT create "Recommendations for Next Session"
- ❌ Do NOT provide suggestions for follow-up work
- ❌ Do NOT stop until all 13 files complete OR you hit turn limit (${maxTurns})

If you find yourself thinking "let me stop here and suggest next steps", STOP THAT THOUGHT and continue to the next file instead.
` : ''}

Begin with file 1: audioCourse.json
  `.trim();

  await runResilientHarness(
    {
      harnessName: 'i18n',
      watchdogTimeoutMs: watchdogTimeout || 300000, // 5 minutes default for i18n (lots of file reads)
      disableWatchdog,
    },
    async (context) => {
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
              ? ['Read', 'Glob', 'Grep', 'Bash']
              : ['Read', 'Edit', 'Write', 'Glob', 'Grep', 'Bash', 'Skill'],
            systemPrompt: enhanceSystemPrompt(`You are an i18n expert maintaining ConvoLab's translations.
Follow the project's CLAUDE.md guidelines. Be thorough but efficient.
${dryRun ? 'This is a dry run - REPORT ONLY, make NO changes.' : 'Fix issues and use /commit when done.'}`),
          },
        })) {
          messageCount++;

          // Record progress for watchdog
          context.recordProgress();

          // Show progress every 10 turns or every 30 seconds
          const now = Date.now();
          if (messageCount % 10 === 0 || now - lastProgressUpdate > 30000) {
            const progress = ((messageCount / maxTurns) * 100).toFixed(1);
            console.log(`\n📊 Progress: ${messageCount}/${maxTurns} turns (${progress}%)`);
            lastProgressUpdate = now;
          }

          // Checkpoint logging every 50 messages
          if (messageCount % 50 === 0) {
            context.logCheckpoint(messageCount, startTime, lastMessage);
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

        console.log('\n\n═══════════════════════════════════════════');
        console.log('✅ i18n Harness Complete');
        console.log('═══════════════════════════════════════════\n');
        console.log(`📊 Total messages: ${messageCount}`);
        console.log(`⏱️  Duration: ${formatDuration(durationMs)}`);
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
  );
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

// Check for --watchdog-timeout argument
let customWatchdogTimeout: number | undefined;
const watchdogTimeoutIndex = args.findIndex((arg) => arg === '--watchdog-timeout');
if (watchdogTimeoutIndex !== -1 && args[watchdogTimeoutIndex + 1]) {
  customWatchdogTimeout = parseInt(args[watchdogTimeoutIndex + 1], 10);
  if (isNaN(customWatchdogTimeout)) {
    console.error('Invalid --watchdog-timeout value. Using default.');
    customWatchdogTimeout = undefined;
  }
}

const options: HarnessOptions = {
  dryRun: args.includes('--dry-run'),
  verbose: !args.includes('--quiet'),
  maxTurns: customMaxTurns,
  watchdogTimeout: customWatchdogTimeout,
  disableWatchdog: args.includes('--disable-watchdog'),
};

// Run the harness
runI18nHarness(options).catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
