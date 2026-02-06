#!/usr/bin/env ts-node
/**
 * Type Safety Harness for ConvoLab
 *
 * Autonomously removes `any` types from 86 files in parallel.
 * Each file gets its own Claude session that reads the file,
 * replaces `any` with proper types, and verifies with tsc.
 *
 * Usage:
 *   npm run harness:type-safety                          # Fix all files (5 concurrent, Sonnet)
 *   npm run harness:type-safety -- --dry-run             # Analysis only, no fixes
 *   npm run harness:type-safety -- --concurrency 10      # 10 parallel sessions
 *   npm run harness:type-safety -- --model claude-opus-4-20250514  # Use Opus
 *   npm run harness:type-safety -- --max-turns 50        # Custom max turns per file
 *   npm run harness:type-safety -- --file server/src/services/stripeService.ts  # Single file
 *   npm run harness:type-safety -- --category tests      # Only test files
 *   npm run harness:type-safety -- --category source     # Only source files
 *   npm run harness:type-safety -- --category scripts    # Only script files
 */

import { query } from '@anthropic-ai/claude-agent-sdk';
import { formatDuration } from './utils/format-duration.js';

// ─── Types ──────────────────────────────────────────────────────────────────

interface FileTask {
  file: string;
  cardId: string;
  anyCount: number;
  category: 'source' | 'test' | 'script';
}

interface TaskResult {
  file: string;
  cardId: string;
  status: 'success' | 'failure' | 'skipped';
  durationMs: number;
  error?: string;
  turns?: number;
}

interface HarnessOptions {
  dryRun: boolean;
  concurrency: number;
  model: string;
  retryModel: string;
  noRetry: boolean;
  retryMaxTurns: number;
  maxTurns: number;
  verbose: boolean;
  fileFilter?: string;
  categoryFilter?: 'source' | 'test' | 'script';
}

// ─── File Registry ──────────────────────────────────────────────────────────
// All 86 files with `any` types, their beads card IDs, and occurrence counts.

const FILE_TASKS: FileTask[] = [
  // Client source files
  { file: 'client/src/pages/PlaybackPage.tsx', cardId: 'convo-lab-638', anyCount: 2, category: 'source' },
  { file: 'client/src/pages/AdminPage.tsx', cardId: 'convo-lab-4zh', anyCount: 6, category: 'source' },
  { file: 'client/src/main.tsx', cardId: 'convo-lab-2zu', anyCount: 1, category: 'source' },
  { file: 'client/src/test/vitest-env.d.ts', cardId: 'convo-lab-2lw', anyCount: 2, category: 'source' },
  { file: 'client/src/test/setup.ts', cardId: 'convo-lab-vb7', anyCount: 1, category: 'source' },

  // Server source files
  { file: 'server/src/services/avatarService.ts', cardId: 'convo-lab-iza', anyCount: 2, category: 'source' },
  { file: 'server/src/services/sampleContent.ts', cardId: 'convo-lab-7lk', anyCount: 5, category: 'source' },
  { file: 'server/src/services/dialogueGenerator.ts', cardId: 'convo-lab-082', anyCount: 5, category: 'source' },
  { file: 'server/src/services/conversationalLessonScriptGenerator.ts', cardId: 'convo-lab-242', anyCount: 1, category: 'source' },
  { file: 'server/src/services/workerTrigger.ts', cardId: 'convo-lab-6zp', anyCount: 1, category: 'source' },
  { file: 'server/src/services/courseItemExtractor.ts', cardId: 'convo-lab-2lr', anyCount: 10, category: 'source' },
  { file: 'server/src/services/conversationalCourseScriptGenerator.ts', cardId: 'convo-lab-55t', anyCount: 1, category: 'source' },
  { file: 'server/src/services/stripeService.ts', cardId: 'convo-lab-3im', anyCount: 6, category: 'source' },
  { file: 'server/src/services/ttsProviders/PollyTTSProvider.ts', cardId: 'convo-lab-slh', anyCount: 1, category: 'source' },
  { file: 'server/src/config/passport.ts', cardId: 'convo-lab-vls', anyCount: 1, category: 'source' },
  { file: 'server/src/middleware/impersonation.ts', cardId: 'convo-lab-wnw', anyCount: 1, category: 'source' },
  { file: 'server/src/middleware/errorHandler.ts', cardId: 'convo-lab-ju2', anyCount: 2, category: 'source' },
  { file: 'server/src/routes/admin.ts', cardId: 'convo-lab-1oe', anyCount: 2, category: 'source' },
  { file: 'server/src/routes/billing.ts', cardId: 'convo-lab-4mx', anyCount: 1, category: 'source' },
  { file: 'server/src/routes/courses.ts', cardId: 'convo-lab-8vh', anyCount: 1, category: 'source' },

  // Client test files
  { file: 'client/src/pages/__tests__/VerifyEmailPage.test.tsx', cardId: 'convo-lab-4s2', anyCount: 14, category: 'test' },
  { file: 'client/src/pages/__tests__/AdminPage.test.tsx', cardId: 'convo-lab-gir', anyCount: 13, category: 'test' },
  { file: 'client/src/pages/__tests__/ResetPasswordPage.test.tsx', cardId: 'convo-lab-u2s', anyCount: 15, category: 'test' },
  { file: 'client/src/pages/__tests__/ForgotPasswordPage.test.tsx', cardId: 'convo-lab-76t', anyCount: 11, category: 'test' },
  { file: 'client/src/__tests__/hooks/useEpisodes.test.ts', cardId: 'convo-lab-fmw', anyCount: 1, category: 'test' },
  { file: 'client/src/components/__tests__/ErrorBoundary.test.tsx', cardId: 'convo-lab-m0c', anyCount: 3, category: 'test' },

  // Server test files
  { file: 'server/src/__tests__/unit/i18n/emailTemplates.test.ts', cardId: 'convo-lab-q1r', anyCount: 16, category: 'test' },
  { file: 'server/src/__tests__/unit/routes/admin.security.test.ts', cardId: 'convo-lab-fo4', anyCount: 1, category: 'test' },
  { file: 'server/src/__tests__/unit/routes/admin.simple.test.ts', cardId: 'convo-lab-qh5', anyCount: 4, category: 'test' },
  { file: 'server/src/__tests__/unit/routes/admin.test.ts', cardId: 'convo-lab-wek', anyCount: 2, category: 'test' },
  { file: 'server/src/__tests__/unit/routes/admin-subscription.test.ts', cardId: 'convo-lab-0yq', anyCount: 3, category: 'test' },
  { file: 'server/src/__tests__/unit/routes/episodes.integration.test.ts', cardId: 'convo-lab-3wl', anyCount: 6, category: 'test' },
  { file: 'server/src/__tests__/unit/routes/episodes.test.ts', cardId: 'convo-lab-1l6', anyCount: 1, category: 'test' },
  { file: 'server/src/__tests__/unit/routes/dialogue.test.ts', cardId: 'convo-lab-2dq', anyCount: 3, category: 'test' },
  { file: 'server/src/__tests__/unit/routes/billing.test.ts', cardId: 'convo-lab-6mk', anyCount: 1, category: 'test' },
  { file: 'server/src/__tests__/unit/routes/courses.test.ts', cardId: 'convo-lab-hd5', anyCount: 1, category: 'test' },
  { file: 'server/src/__tests__/unit/routes/audio.test.ts', cardId: 'convo-lab-b2a', anyCount: 10, category: 'test' },
  { file: 'server/src/__tests__/unit/routes/images.test.ts', cardId: 'convo-lab-5op', anyCount: 9, category: 'test' },
  { file: 'server/src/__tests__/unit/routes/verification.test.ts', cardId: 'convo-lab-18q', anyCount: 1, category: 'test' },
  { file: 'server/src/__tests__/unit/services/stripeService.test.ts', cardId: 'convo-lab-s7z', anyCount: 9, category: 'test' },
  { file: 'server/src/__tests__/unit/services/audioExtractorService.test.ts', cardId: 'convo-lab-8yu', anyCount: 3, category: 'test' },
  { file: 'server/src/__tests__/unit/services/lessonScriptGenerator.test.ts', cardId: 'convo-lab-c1e', anyCount: 19, category: 'test' },
  { file: 'server/src/__tests__/unit/services/coursePlanner.test.ts', cardId: 'convo-lab-ai6', anyCount: 1, category: 'test' },
  { file: 'server/src/__tests__/unit/services/ttsClient.test.ts', cardId: 'convo-lab-3tp', anyCount: 1, category: 'test' },
  { file: 'server/src/__tests__/unit/services/emailService.test.ts', cardId: 'convo-lab-zru', anyCount: 11, category: 'test' },
  { file: 'server/src/__tests__/unit/services/emailService.token-security.test.ts', cardId: 'convo-lab-9t4', anyCount: 1, category: 'test' },
  { file: 'server/src/__tests__/unit/services/audioGenerator.test.ts', cardId: 'convo-lab-vxp', anyCount: 5, category: 'test' },
  { file: 'server/src/__tests__/unit/services/workerTrigger.test.ts', cardId: 'convo-lab-0ga', anyCount: 2, category: 'test' },
  { file: 'server/src/__tests__/unit/services/courseItemExtractor.test.ts', cardId: 'convo-lab-00l', anyCount: 18, category: 'test' },
  { file: 'server/src/__tests__/unit/services/ttsProviders/PollyTTSProvider.test.ts', cardId: 'convo-lab-5ky', anyCount: 1, category: 'test' },
  { file: 'server/src/__tests__/unit/services/batchedTTSClient.test.ts', cardId: 'convo-lab-qat', anyCount: 16, category: 'test' },
  { file: 'server/src/__tests__/unit/middleware/auth.test.ts', cardId: 'convo-lab-dro', anyCount: 1, category: 'test' },
  { file: 'server/src/__tests__/unit/middleware/impersonation.test.ts', cardId: 'convo-lab-n3h', anyCount: 10, category: 'test' },
  { file: 'server/src/__tests__/unit/config/redis.test.ts', cardId: 'convo-lab-qck', anyCount: 1, category: 'test' },
  { file: 'server/src/__tests__/integration/webhooks/stripe-webhooks.test.ts', cardId: 'convo-lab-qat', anyCount: 16, category: 'test' },
  { file: 'server/src/__tests__/fixtures/timingData.ts', cardId: 'convo-lab-pp4', anyCount: 1, category: 'test' },
  { file: 'server/src/__tests__/mocks/ffmpeg.ts', cardId: 'convo-lab-q0h', anyCount: 1, category: 'test' },

  // Scripts
  { file: 'check-recent-episode.ts', cardId: 'convo-lab-05i', anyCount: 1, category: 'script' },
  { file: 'scripts/lint-harness.ts', cardId: 'convo-lab-79m', anyCount: 1, category: 'script' },
  { file: 'server/scripts/generate-english-avatars.ts', cardId: 'convo-lab-3t2', anyCount: 2, category: 'script' },
  { file: 'server/scripts/retry-final-three.ts', cardId: 'convo-lab-mrb', anyCount: 1, category: 'script' },
  { file: 'server/scripts/complete-sample-courses.ts', cardId: 'convo-lab-4y7', anyCount: 5, category: 'script' },
  { file: 'server/scripts/generate-english-avatars-vertex.ts', cardId: 'convo-lab-28f', anyCount: 2, category: 'script' },
  { file: 'server/scripts/generate-english-avatars-local.ts', cardId: 'convo-lab-rz5', anyCount: 1, category: 'script' },
  { file: 'server/scripts/queue-remaining-sample-courses.ts', cardId: 'convo-lab-jpa', anyCount: 1, category: 'script' },
  { file: 'server/scripts/queue-specific-courses.ts', cardId: 'convo-lab-7od', anyCount: 1, category: 'script' },
  { file: 'server/scripts/retry-failed-courses.ts', cardId: 'convo-lab-9lm', anyCount: 1, category: 'script' },
  { file: 'server/scripts/migrate-lesson-scripts-to-neural2.ts', cardId: 'convo-lab-a6a', anyCount: 2, category: 'script' },
  { file: 'server/scripts/fix-furigana-errors.ts', cardId: 'convo-lab-9og', anyCount: 1, category: 'script' },
  { file: 'server/scripts/retry-remaining.ts', cardId: 'convo-lab-xsd', anyCount: 1, category: 'script' },
  { file: 'server/scripts/generate-final-english-avatars.ts', cardId: 'convo-lab-br6', anyCount: 2, category: 'script' },
  { file: 'server/scripts/copy-sample-content-to-user.ts', cardId: 'convo-lab-9ep', anyCount: 5, category: 'script' },
  { file: 'server/scripts/generate-english-avatars-simple.ts', cardId: 'convo-lab-cxv', anyCount: 1, category: 'script' },
  { file: 'server/scripts/register-english-avatars.ts', cardId: 'convo-lab-lt5', anyCount: 1, category: 'script' },
  { file: 'server/scripts/check-lesson-voices.ts', cardId: 'convo-lab-nur', anyCount: 1, category: 'script' },
  { file: 'server/scripts/generate-speaker-avatars.ts', cardId: 'convo-lab-93d', anyCount: 1, category: 'script' },
  { file: 'server/scripts/cleanup-duplicate-jobs.ts', cardId: 'convo-lab-5ip', anyCount: 1, category: 'script' },
  { file: 'server/scripts/check-and-fix-corrupt-courses.ts', cardId: 'convo-lab-0sl', anyCount: 1, category: 'script' },
  { file: 'server/scripts/recreate-dialog-longer.ts', cardId: 'convo-lab-7fm', anyCount: 1, category: 'script' },
  { file: 'server/scripts/backfill-sentence-metadata.ts', cardId: 'convo-lab-obg', anyCount: 3, category: 'script' },
  { file: 'server/scripts/generate-remaining-english-avatars.ts', cardId: 'convo-lab-gxv', anyCount: 2, category: 'script' },
  { file: 'server/scripts/show-latest-lesson.ts', cardId: 'convo-lab-bgf', anyCount: 1, category: 'script' },
  { file: 'server/scripts/generate-english-avatars-ai.ts', cardId: 'convo-lab-6zw', anyCount: 2, category: 'script' },
  { file: 'server/scripts/check-failed-course-speakers.ts', cardId: 'convo-lab-clz', anyCount: 1, category: 'script' },
  { file: 'server/scripts/create-and-generate-dialog-for-yuriy.ts', cardId: 'convo-lab-oq1', anyCount: 1, category: 'script' },
  { file: 'server/scripts/backfill-dialogue-furigana.ts', cardId: 'convo-lab-gum', anyCount: 1, category: 'script' },
  { file: 'server/scripts/crop-avatars.ts', cardId: 'convo-lab-rkw', anyCount: 1, category: 'script' },
];

// ─── Concurrency Pool ───────────────────────────────────────────────────────

async function runPool<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number,
  onProgress?: (completed: number, total: number) => void
): Promise<T[]> {
  const results: T[] = [];
  let completed = 0;
  let index = 0;

  async function runNext(): Promise<void> {
    while (index < tasks.length) {
      const currentIndex = index++;
      const result = await tasks[currentIndex]();
      results[currentIndex] = result;
      completed++;
      onProgress?.(completed, tasks.length);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, () => runNext());
  await Promise.all(workers);
  return results;
}

// ─── Prompt Builder ─────────────────────────────────────────────────────────

function buildPrompt(task: FileTask, dryRun: boolean): string {
  const isTest = task.category === 'test';
  const testGuidance = isTest
    ? `
## Test File Guidance

This is a test file. Common patterns for replacing \`any\` in tests:
- Mock objects: Use the actual type being mocked, or \`Partial<RealType>\`
- Express req/res mocks: Use \`Partial<Request>\` and \`Partial<Response>\` from express
- Error catches: Use \`unknown\` then narrow with \`instanceof\`
- Jest mock functions: Use \`jest.Mock\` or \`jest.MockedFunction<typeof fn>\`
- Partial mock data: Use \`Partial<T>\` or create a test fixture type
- If the mock is cast with \`as any\`, replace with \`as unknown as RealType\`
- For callback args typed as \`any\`, trace the callback signature from the source

After fixing types, run the test file to verify tests still pass:
\`npx vitest run ${task.file} --reporter=verbose 2>&1 | tail -n 30\`
`
    : '';

  return `
You are fixing TypeScript type safety issues in a single file.

## Step 0: Claim the Beads Card (REQUIRED FIRST STEP)

Before doing anything else, check and claim your beads card:

1. Run: \`mcp__beads__show\` with issue_id "${task.cardId}"
2. If the status is NOT "open", STOP IMMEDIATELY — another session is handling this file. Output "SKIPPED: card ${task.cardId} is not open" and exit.
3. If the status IS "open", claim it: \`mcp__beads__update\` with issue_id "${task.cardId}", status "in_progress"
4. Only then proceed to the actual work below.

## Target File
\`${task.file}\` — currently has ${task.anyCount} \`any\` type usage(s).

## Your Mission
${
  dryRun
    ? 'Analyze the file and report what each `any` should be replaced with. Do NOT make changes.'
    : `Replace ALL \`any\` types in this file with proper, specific types.`
}

## Rules

1. **Read the file first** to understand the full context
2. **Trace types**: Look at function signatures, return types, and imported types to determine the correct replacement
3. **Read related files** if needed to understand types (e.g., shared type definitions, the source being tested)
4. **Common replacements**:
   - \`catch (error: any)\` → \`catch (error: unknown)\` then use type guards
   - \`as any\` → \`as unknown as SpecificType\` or just the correct cast
   - \`: any\` on function params → the actual parameter type
   - \`Record<string, any>\` → \`Record<string, unknown>\` or a specific value type
   - \`Promise<any>\` → \`Promise<SpecificType>\`
   - \`any[]\` → \`SpecificType[]\`
5. **Never use \`// @ts-ignore\` or \`// eslint-disable\`** as a replacement
6. **Preserve existing behavior** — only change types, not logic
${testGuidance}

## Verification

After making changes:
1. Run: \`npx tsc --noEmit 2>&1 | head -n 50\` (timeout: 60000)
2. If there are type errors in YOUR file, fix them
3. If there are type errors in OTHER files caused by your changes, reconsider your approach
4. Verify zero \`any\` remains: \`grep -cE ': any\\b|as any\\b|\\bany\\[|\\bany>|<any\\b|, any\\b|\\bany \\|' ${task.file}\`
5. The grep should return 0

## Step Final: Close the Beads Card

${
  dryRun
    ? 'Report your analysis: list each `any` usage, its line number, and what it should be replaced with. Then set the card back to open: `mcp__beads__update` with issue_id "' + task.cardId + '", status "open".'
    : `After verification passes (tsc clean + grep returns 0):
- Close the card: \`mcp__beads__close\` with issue_id "${task.cardId}", reason "All any types replaced with proper types"

If you CANNOT fix all \`any\` types (tsc fails, etc.):
- Revert the card: \`mcp__beads__update\` with issue_id "${task.cardId}", status "open", notes "Failed: <brief reason>"
`
}

## Important
- Do NOT modify other files unless absolutely necessary for type compatibility
- If a proper type truly cannot be determined, use \`unknown\` instead of \`any\`
- Keep changes minimal — only touch what's needed to remove \`any\`
- Do NOT add comments, docstrings, or refactor surrounding code
`.trim();
}

// ─── Session Runner ─────────────────────────────────────────────────────────

async function runFileSession(
  task: FileTask,
  options: HarnessOptions
): Promise<TaskResult> {
  const startTime = Date.now();
  const prompt = buildPrompt(task, options.dryRun);

  try {
    let messageCount = 0;
    let lastMessage = '';

    for await (const message of query({
      prompt,
      options: {
        cwd: '/Users/andrewlandry/source/convo-lab',
        permissionMode: options.dryRun ? 'default' : 'acceptEdits',
        maxTurns: options.maxTurns,
        model: options.model,
        allowedTools: options.dryRun
          ? ['Read', 'Glob', 'Grep', 'Bash', 'mcp__beads__show', 'mcp__beads__update']
          : ['Read', 'Edit', 'Write', 'Glob', 'Grep', 'Bash', 'mcp__beads__show', 'mcp__beads__update', 'mcp__beads__close'],
        systemPrompt: `You are a TypeScript type safety expert. Your only job is to remove \`any\` types from a single file and replace them with proper types. Be precise and minimal in your changes. You MUST check and claim the beads card before starting work, and close or revert it when done.`,
        persistSession: false,
      },
    })) {
      messageCount++;

      if (message.type === 'assistant' && message.message?.content) {
        for (const block of message.message.content) {
          if ('text' in block && block.text) {
            lastMessage = block.text;
            if (options.verbose) {
              const preview = block.text.substring(0, 200);
              console.log(`  [${task.file}] ${preview}${block.text.length > 200 ? '...' : ''}`);
            }
          }
        }

        // Detect skip: the session found the card was already claimed
        if (lastMessage.includes('SKIPPED:')) {
          return {
            file: task.file,
            cardId: task.cardId,
            status: 'skipped',
            durationMs: Date.now() - startTime,
            turns: messageCount,
            error: lastMessage.substring(0, 200),
          };
        }
      }

      if (message.type === 'result') {
        if (message.subtype === 'success') {
          return {
            file: task.file,
            cardId: task.cardId,
            status: 'success',
            durationMs: Date.now() - startTime,
            turns: messageCount,
          };
        } else {
          return {
            file: task.file,
            cardId: task.cardId,
            status: 'failure',
            durationMs: Date.now() - startTime,
            turns: messageCount,
            error: `Session ended with: ${message.subtype} — ${lastMessage.substring(0, 200)}`,
          };
        }
      }
    }

    // If we exhaust the iterator without a result message
    return {
      file: task.file,
      cardId: task.cardId,
      status: 'success',
      durationMs: Date.now() - startTime,
      turns: messageCount,
    };
  } catch (error) {
    return {
      file: task.file,
      cardId: task.cardId,
      status: 'failure',
      durationMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ─── Pass Runner ────────────────────────────────────────────────────────────

interface PassResult {
  successes: TaskResult[];
  failures: TaskResult[];
  skipped: TaskResult[];
  durationMs: number;
}

async function runPass(
  passName: string,
  tasks: FileTask[],
  options: HarnessOptions,
  modelOverride?: string
): Promise<PassResult> {
  const passOptions = modelOverride
    ? { ...options, model: modelOverride, maxTurns: options.retryMaxTurns }
    : options;

  const totalAny = tasks.reduce((sum, t) => sum + t.anyCount, 0);

  console.log(`\n${'═'.repeat(50)}`);
  console.log(`🔄 ${passName}`);
  console.log(`${'═'.repeat(50)}\n`);
  console.log(`  📋 Files: ${tasks.length}`);
  console.log(`  🔢 \`any\` occurrences: ${totalAny}`);
  console.log(`  🤖 Model: ${passOptions.model}`);
  console.log(`  🔄 Max turns per file: ${passOptions.maxTurns}`);
  console.log(`  ⚡ Concurrency: ${passOptions.concurrency}`);
  console.log();

  const passStart = Date.now();

  const taskFns = tasks.map(
    (task) => () => runFileSession(task, passOptions)
  );

  const results = await runPool(taskFns, passOptions.concurrency, (completed, total) => {
    const pct = ((completed / total) * 100).toFixed(0);
    const elapsed = formatDuration(Date.now() - passStart);
    console.log(`\n  📊 [${passName}] ${completed}/${total} (${pct}%) — ${elapsed} elapsed`);
  });

  const successes = results.filter((r) => r.status === 'success');
  const failures = results.filter((r) => r.status === 'failure');
  const skipped = results.filter((r) => r.status === 'skipped');
  const durationMs = Date.now() - passStart;

  console.log(`\n  ─── ${passName} Results ───`);
  console.log(`  ✅ Succeeded: ${successes.length}`);
  console.log(`  ❌ Failed:    ${failures.length}`);
  console.log(`  ⏭️  Skipped:   ${skipped.length}`);
  console.log(`  ⏱️  Duration:  ${formatDuration(durationMs)}`);

  if (successes.length > 0) {
    console.log(`\n  ─── Succeeded ───`);
    for (const r of successes) {
      console.log(`    ✅ ${r.file} (${r.turns} turns, ${formatDuration(r.durationMs)})`);
    }
  }

  if (failures.length > 0) {
    console.log(`\n  ─── Failed ───`);
    for (const r of failures) {
      console.log(`    ❌ ${r.file}`);
      if (r.error) {
        console.log(`       ${r.error.substring(0, 150)}`);
      }
    }
  }

  return { successes, failures, skipped, durationMs };
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);

  // Parse CLI args
  const getArg = (name: string): string | undefined => {
    const idx = args.findIndex((a) => a === `--${name}`);
    return idx !== -1 && args[idx + 1] ? args[idx + 1] : undefined;
  };

  const options: HarnessOptions = {
    dryRun: args.includes('--dry-run'),
    concurrency: parseInt(getArg('concurrency') || '5', 10),
    model: getArg('model') || 'claude-sonnet-4-5-20250929',
    retryModel: getArg('retry-model') || 'claude-opus-4-20250514',
    noRetry: args.includes('--no-retry'),
    maxTurns: parseInt(getArg('max-turns') || '30', 10),
    retryMaxTurns: parseInt(getArg('retry-max-turns') || '50', 10),
    verbose: !args.includes('--quiet'),
    fileFilter: getArg('file'),
    categoryFilter: getArg('category') as HarnessOptions['categoryFilter'],
  };

  // Filter tasks
  let tasks = [...FILE_TASKS];
  if (options.fileFilter) {
    tasks = tasks.filter((t) => t.file.includes(options.fileFilter!));
  }
  if (options.categoryFilter) {
    tasks = tasks.filter((t) => t.category === options.categoryFilter);
  }

  // Sort by anyCount ascending (quick wins first)
  tasks.sort((a, b) => a.anyCount - b.anyCount);

  // Header
  console.log('🔒 ConvoLab Type Safety Harness');
  console.log('═══════════════════════════════════════════\n');
  if (options.dryRun) {
    console.log('🔍 Running in DRY RUN mode (analysis only)\n');
  }
  console.log(`📋 Total files: ${tasks.length}`);
  console.log(`🔢 Total \`any\` occurrences: ${tasks.reduce((s, t) => s + t.anyCount, 0)}`);
  console.log(`⚡ Concurrency: ${options.concurrency}`);
  console.log(`🤖 Pass 1 model: ${options.model} (${options.maxTurns} turns/file)`);
  if (!options.noRetry) {
    console.log(`🧠 Pass 2 model: ${options.retryModel} (${options.retryMaxTurns} turns/file) — auto-retry for failures`);
  } else {
    console.log(`🚫 Auto-retry: disabled (--no-retry)`);
  }
  if (options.fileFilter) console.log(`🎯 File filter: ${options.fileFilter}`);
  if (options.categoryFilter) console.log(`🎯 Category filter: ${options.categoryFilter}`);

  const startTime = Date.now();

  // ─── Pass 1: Sonnet ─────────────────────────────────────────────────────

  const pass1 = await runPass(
    `Pass 1 — ${options.model.split('-').slice(1, 3).join(' ')}`,
    tasks,
    options
  );

  // ─── Pass 2: Opus retry for failures ────────────────────────────────────

  let pass2: PassResult | null = null;

  if (pass1.failures.length > 0 && !options.noRetry && options.model !== options.retryModel) {
    // Build the retry task list from failed files
    // The beads cards were reverted to "open" by the failed sessions, so they're claimable
    const retryTasks = pass1.failures.map((f) => {
      const original = FILE_TASKS.find((t) => t.file === f.file);
      return original!;
    });

    console.log(`\n\n💡 ${pass1.failures.length} file(s) failed with ${options.model}.`);
    console.log(`   Escalating to ${options.retryModel} for a second attempt...\n`);

    pass2 = await runPass(
      `Pass 2 — ${options.retryModel.split('-').slice(1, 3).join(' ')} (retry)`,
      retryTasks,
      options,
      options.retryModel
    );
  }

  // ─── Final Summary ──────────────────────────────────────────────────────

  const allSuccesses = [...pass1.successes, ...(pass2?.successes || [])];
  const allSkipped = [...pass1.skipped, ...(pass2?.skipped || [])];
  const finalFailures = pass2 ? pass2.failures : pass1.failures;
  const totalDuration = Date.now() - startTime;

  console.log('\n\n' + '═'.repeat(50));
  console.log('📊 Final Summary');
  console.log('═'.repeat(50) + '\n');
  console.log(`✅ Succeeded: ${allSuccesses.length} / ${tasks.length}`);
  if (pass2) {
    console.log(`   ├─ Pass 1 (${options.model}): ${pass1.successes.length}`);
    console.log(`   └─ Pass 2 (${options.retryModel}): ${pass2.successes.length}`);
  }
  console.log(`❌ Failed:    ${finalFailures.length}`);
  console.log(`⏭️  Skipped:   ${allSkipped.length}`);
  console.log(`⏱️  Duration:  ${formatDuration(totalDuration)}`);
  const successRate = tasks.length > 0 ? ((allSuccesses.length / tasks.length) * 100).toFixed(1) : '0';
  console.log(`📈 Success rate: ${successRate}%\n`);

  if (allSuccesses.length > 0) {
    console.log('─── Successful Files (cards closed in beads) ───');
    for (const r of allSuccesses) {
      console.log(`  ✅ ${r.file} [${r.cardId}] (${r.turns} turns, ${formatDuration(r.durationMs)})`);
    }
    console.log();
  }

  if (allSkipped.length > 0) {
    console.log('─── Skipped Files (already in progress or closed) ───');
    for (const r of allSkipped) {
      console.log(`  ⏭️  ${r.file} [${r.cardId}]`);
    }
    console.log();
  }

  if (finalFailures.length > 0) {
    console.log('─── Remaining Failures (cards reverted to open in beads) ───');
    for (const r of finalFailures) {
      console.log(`  ❌ ${r.file} [${r.cardId}]`);
      if (r.error) {
        console.log(`     ${r.error.substring(0, 200)}`);
      }
    }
    console.log();
    console.log(`💡 These files may need manual intervention.`);
    console.log(`   Re-run the harness to retry (cards are open).`);
  }

  // Exit with appropriate code
  if (finalFailures.length > 0 && allSuccesses.length === 0) {
    process.exit(1); // All failed
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
