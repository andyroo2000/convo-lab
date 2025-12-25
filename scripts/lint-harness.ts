#!/usr/bin/env ts-node
/**
 * Lint Fixing Harness for ConvoLab
 *
 * Autonomously fixes ESLint errors and warnings:
 * - Testing Library violations (~240 instances)
 * - TypeScript issues (unused vars, imports)
 * - Accessibility issues (jsx-a11y)
 * - Code quality (consistent-return, nested ternaries)
 * - Import/dependency warnings
 *
 * Usage:
 *   npm run harness:lint                         # Full lint fix (5000 turns)
 *   npm run harness:lint -- --dry-run            # Analysis only, no fixes
 *   npm run harness:lint -- --max-turns 2000     # Custom max turns
 *   npm run harness:lint -- --tests-only         # Only fix testing-library issues
 *   npm run harness:lint -- --a11y-only          # Only fix accessibility issues
 *   npm run harness:lint -- --priority critical  # Only fix critical errors
 */

import { query } from '@anthropic-ai/claude-agent-sdk';
import { runResilientHarness } from './utils/resilient-harness-wrapper.js';
import { enhanceSystemPrompt } from './utils/timeout-system-prompt.js';
import { formatDuration } from './utils/format-duration.js';

interface LintHarnessOptions {
  dryRun?: boolean;
  maxTurns?: number;
  verbose?: boolean;
  testsOnly?: boolean; // Only fix testing-library issues
  a11yOnly?: boolean; // Only fix jsx-a11y issues
  typeScriptOnly?: boolean; // Only fix TS unused vars/imports
  priority?: 'critical' | 'high' | 'medium' | 'all'; // Default: 'all'
  refactorTests?: boolean; // Default: true (refactor vs disable)
  watchdogTimeout?: number; // Progress watchdog timeout in ms
  disableWatchdog?: boolean; // Disable watchdog entirely
}

const DEFAULT_MAX_TURNS = 50000;

async function runLintHarness(options: LintHarnessOptions = {}) {
  const {
    dryRun = false,
    maxTurns = DEFAULT_MAX_TURNS,
    verbose = true,
    testsOnly = false,
    a11yOnly = false,
    typeScriptOnly = false,
    priority = 'all',
    refactorTests = true,
    watchdogTimeout,
    disableWatchdog = false,
  } = options;

  console.log('🔧 ConvoLab Lint Fixing Harness');
  console.log('═══════════════════════════════════════════\n');

  if (dryRun) {
    console.log('🔍 Running in DRY RUN mode (analysis only)\n');
  }

  console.log(`⚙️  Max turns: ${maxTurns}`);
  if (testsOnly) {
    console.log('🎯 Mode: Testing Library fixes only');
  } else if (a11yOnly) {
    console.log('🎯 Mode: Accessibility fixes only');
  } else if (typeScriptOnly) {
    console.log('🎯 Mode: TypeScript fixes only');
  } else {
    console.log(`🎯 Mode: Comprehensive lint fixes (priority: ${priority})`);
  }
  console.log(`🧪 Test refactoring: ${refactorTests ? 'Enabled' : 'Disabled (use eslint-disable)'}`);
  if (!disableWatchdog) {
    console.log(`⏱️  Watchdog timeout: ${watchdogTimeout || 240000}ms`);
  }
  console.log();

  console.log('Starting lint fixes...\n');

  const getFocusedMode = () => {
    if (testsOnly) {
      return `
### FOCUSED MODE: Testing Library Only

Fix only testing-library violations:
- testing-library/no-node-access
- testing-library/no-container
- testing-library/render-result-naming-convention

${
  refactorTests
    ? `
Strategy: REFACTOR
- Replace container.querySelector() with screen.getByRole()
- Use within() or getByText() instead of DOM access
- Rename render result variables properly
`
    : `
Strategy: ESLINT-DISABLE
- Add eslint-disable comments for testing-library rules
- Document why each disable is necessary
- Focus on speed over refactoring
`
}

Skip all other lint errors.
`;
    }

    if (a11yOnly) {
      return `
### FOCUSED MODE: Accessibility Only

Fix only jsx-a11y violations:
- click-events-have-key-events
- no-static-element-interactions
- label-has-associated-control
- button-has-type
- aria-role

Strategy:
- Add keyboard handlers to click events OR convert to buttons
- Add htmlFor/id to label/input pairs
- Add type="button" to buttons
- Validate ARIA roles

Skip all other lint errors.
`;
    }

    if (typeScriptOnly) {
      return `
### FOCUSED MODE: TypeScript Only

Fix only TypeScript violations:
- @typescript-eslint/no-unused-vars
- Unused imports
- Missing return types (obvious cases only)

Strategy:
- Prefix unused vars with underscore (_)
- Remove unused imports
- Skip @typescript-eslint/no-explicit-any (manual review needed)

Skip all other lint errors.
`;
    }

    return '';
  };

  const getPriorityGuidance = () => {
    if (priority === 'critical') {
      return `
### PRIORITY: CRITICAL ONLY

Fix ONLY errors that break CI/build:
- Unused variables
- Missing button types
- Parse errors
- Missing imports

Skip warnings and non-critical errors.
`;
    }

    if (priority === 'high') {
      return `
### PRIORITY: HIGH

Fix critical errors PLUS:
- Testing Library violations
- Accessibility issues
- Type safety issues

Skip code quality warnings.
`;
    }

    if (priority === 'medium') {
      return `
### PRIORITY: MEDIUM

Fix high-priority errors PLUS:
- Code quality issues (consistent-return, nested ternaries)
- Import organization

Skip low-priority warnings.
`;
    }

    return `
### PRIORITY: ALL

Fix all lint errors and warnings systematically.
Target: Reduce from ~783 to <100 problems.
`;
  };

  const prompt = `
You are running an autonomous lint-fixing harness for ConvoLab.

## Your Mission

Fix ESLint errors and warnings across the client codebase.
Current status: ~783 problems (622 errors, 161 warnings)
Goal: Reduce to <100 problems through systematic fixes.

${getFocusedMode()}
${getPriorityGuidance()}

## Complete Lint Fix Workflow

### PHASE 1: Analysis & Categorization (Required - 10-30 turns)

1. Run: \`npm run lint 2>&1 | head -n 500\` (with timeout: 60000)
2. Parse all errors by category:
   - Testing Library violations (~240)
   - TypeScript issues (~100)
   - Accessibility issues (~80)
   - Code quality issues (~100)
   - Other issues (~50)
3. Build priority list:
   - Critical: Breaks build/CI
   - High: Testing, accessibility, type safety
   - Medium: Code quality, style
   - Low: Warnings that don't affect functionality
4. Report breakdown:
   - Total errors by category
   - Files affected
   - Auto-fix vs manual review breakdown
   - Estimated turn count per phase

### PHASE 2: Safe Auto-Fixes (50-150 turns)

#### 2A: TypeScript Cleanup (20-40 turns)
${
  typeScriptOnly || !testsOnly && !a11yOnly
    ? `
- Fix @typescript-eslint/no-unused-vars by prefixing with _
- Remove unused imports
- Add missing return types (only obvious cases)
- SKIP: @typescript-eslint/no-explicit-any (requires type analysis)

Example:
\`\`\`typescript
// Before:
const result = someFunc();
// After:
const _result = someFunc();
\`\`\`

After every 20 fixes:
- Run: npm run lint 2>&1 | grep "@typescript-eslint"
- Verify error count decreased
`
    : 'SKIP: Not in scope for focused mode'
}

#### 2B: React/JSX Basic Fixes (30-50 turns)
${
  !testsOnly && !a11yOnly && !typeScriptOnly
    ? `
- Add type="button" to all <button> elements
- Fix react-refresh/only-export-components by naming anonymous components
- Handle no-console (use eslint-disable for intentional logging)

Example:
\`\`\`tsx
// Before:
<button onClick={handleClick}>
// After:
<button type="button" onClick={handleClick}>
\`\`\`

After every 20 fixes:
- Run: npm run lint 2>&1 | grep "react/"
- Verify error count decreased
`
    : 'SKIP: Not in scope for focused mode'
}

#### 2C: Import/Dependency Fixes (5-10 turns)
${
  !testsOnly && !a11yOnly && !typeScriptOnly
    ? `
- Fix import/no-extraneous-dependencies in test files
- Add eslint-disable comments for test-only imports

Example:
\`\`\`typescript
/* eslint-disable import/no-extraneous-dependencies */
import { render } from '@testing-library/react';
\`\`\`
`
    : 'SKIP: Not in scope for focused mode'
}

### PHASE 3: Testing Library Refactors (100-200 turns)

${
  testsOnly || (!a11yOnly && !typeScriptOnly)
    ? `
Most impactful category: ~240 violations

${
  refactorTests
    ? `
#### Strategy: REFACTOR (Preferred)

3A: Fix render-result-naming-convention (30-50 turns)
- Rename \`htmlContent\` to \`view\` or destructure
- Mechanical rename, safe

Example:
\`\`\`tsx
// Before:
const htmlContent = render(<Component />);
// After:
const { container } = render(<Component />);
// OR:
const view = render(<Component />);
\`\`\`

3B: Refactor High-Value Tests (70-150 turns)
- Replace container.querySelector() with screen queries
- Fix no-node-access using within() or proper queries
- Prioritize: component tests > hook tests > utility tests

Example:
\`\`\`tsx
// Before:
const { container } = render(<Component />);
const main = container.querySelector('main');

// After:
render(<Component />);
const main = screen.getByRole('main');
\`\`\`

For complex cases:
\`\`\`tsx
// Before:
const element = container.querySelector('.custom-class');

// After:
const element = screen.getByTestId('custom-element');
// or add a proper role/aria-label
\`\`\`

After each file:
- Run: npm test -- <filename>
- Verify all tests pass
- Run: npm run lint <filename>
- Verify errors reduced
`
    : `
#### Strategy: ESLINT-DISABLE (Fast)

Add targeted eslint-disable comments:
\`\`\`tsx
/* eslint-disable testing-library/no-container, testing-library/no-node-access */
const { container } = render(<Component />);
const element = container.querySelector('main');
\`\`\`

Document WHY:
\`\`\`tsx
// Testing raw DOM structure for ruby/rt elements - no semantic alternative
/* eslint-disable testing-library/no-container */
\`\`\`
`
}

Skip files that:
- Timeout 2+ times
- Have >50 violations (flag for manual review)
- Are overly complex (e.g., Layout.test.tsx DOM testing)
`
    : 'SKIP: Not in scope for focused mode'
}

### PHASE 4: Accessibility Improvements (80-150 turns)

${
  a11yOnly || (!testsOnly && !typeScriptOnly)
    ? `
#### 4A: Keyboard Accessibility (40-70 turns)

Fix click-events-have-key-events and no-static-element-interactions:

Option 1 (Preferred): Convert to button
\`\`\`tsx
// Before:
<div onClick={handleClick}>Click me</div>

// After:
<button type="button" onClick={handleClick}>Click me</button>
\`\`\`

Option 2: Add keyboard handler
\`\`\`tsx
<div
  onClick={handleClick}
  onKeyDown={(e) => e.key === 'Enter' && handleClick()}
  role="button"
  tabIndex={0}
>
  Click me
</div>
\`\`\`

#### 4B: Form Accessibility (20-40 turns)

Fix label-has-associated-control:
\`\`\`tsx
// Before:
<label>Name</label>
<input />

// After:
<label htmlFor="name">Name</label>
<input id="name" />
\`\`\`

#### 4C: ARIA Improvements (20-40 turns)

- Validate all role attributes are valid
- Add aria-label where needed
- Fix aria-expanded, aria-checked usage

Priority:
1. Fix modal dialogs first (critical UX)
2. Fix form controls second (accessibility compliance)
3. Fix click handlers third (progressive enhancement)
`
    : 'SKIP: Not in scope for focused mode'
}

### PHASE 5: Code Quality Improvements (50-100 turns)

${
  !testsOnly && !a11yOnly && !typeScriptOnly && priority !== 'critical'
    ? `
#### 5A: Logic Consistency (30-60 turns)

Fix consistent-return:
\`\`\`tsx
// Before:
const getColor = (type) => {
  if (type === 'error') return 'red';
  // implicit undefined
};

// After:
const getColor = (type) => {
  if (type === 'error') return 'red';
  return 'gray'; // explicit default
};
\`\`\`

#### 5B: Simplify Nested Ternaries (10-20 turns)

\`\`\`tsx
// Before:
const color = type === 'error' ? 'red' : type === 'warning' ? 'yellow' : 'green';

// After:
const getColor = (type) => {
  if (type === 'error') return 'red';
  if (type === 'warning') return 'yellow';
  return 'green';
};
\`\`\`

#### 5C: Loop Optimizations (10-20 turns)

\`\`\`tsx
// Before:
for (const item of items) { ... }

// After:
items.forEach(item => { ... });
\`\`\`
`
    : 'SKIP: Not in scope for focused mode or priority level'
}

### PHASE 6: TypeScript 'any' Audit (SKIP - Manual Review)

Do NOT auto-fix @typescript-eslint/no-explicit-any:
- 99 instances require semantic understanding
- Risk of introducing incorrect types
- Instead: Add TODO comments

\`\`\`typescript
// TODO: Type this properly - looks like Stripe subscription object
const subscription: any = await stripe.subscriptions.retrieve(id);
\`\`\`

Create follow-up issue for TypeScript migration.

### PHASE 7: Final Verification & Commit (10-20 turns)

1. Full lint check:
   \`npm run lint 2>&1 | tail -n 100\` (timeout: 60000)
   Expected: <100 remaining issues

2. Full test suite:
   \`npm run test:run\` (timeout: 120000)
   Expected: All tests pass

3. Build verification:
   \`npm run build:check\` (timeout: 120000)
   Expected: Clean build

4. Update CHANGELOG.md:
\`\`\`markdown
### Improved
- Fixed 680+ ESLint errors and warnings across codebase
- Improved Testing Library compliance (${refactorTests ? 'refactored' : 'documented'} 200+ test violations)
- Enhanced accessibility (80+ jsx-a11y fixes for keyboard navigation, ARIA, forms)
- Cleaned up TypeScript unused variables and imports
- Improved code consistency (return statements, ternary operators)
\`\`\`

5. Single /commit:
\`\`\`
chore(lint): fix 680+ ESLint errors across client codebase

- Testing Library: ${refactorTests ? 'Refactored' : 'Documented'} 200+ violations to use proper queries
- Accessibility: Fixed 80+ jsx-a11y issues (keyboard nav, ARIA, forms)
- TypeScript: Cleaned up unused vars and imports
- React/JSX: Added button types, fixed component exports
- Code quality: Fixed consistent-return, nested ternaries, loops

Remaining issues: ~100 (87% reduction from 783)
- 99 TypeScript 'any' warnings (requires manual type analysis)
- Complex testing-library cases (flagged for future refactor)
\`\`\`

## Fix Strategy Guidelines

### AUTO-FIX (Mechanical, Safe)
✅ Add type="button" to buttons
✅ Prefix unused vars with _
✅ Rename render results (htmlContent → view)
✅ Add htmlFor to labels
✅ Remove unused imports

### REFACTOR (Safe, Contextual)
🔧 Replace container.querySelector with screen queries
🔧 Add keyboard handlers to click events
🔧 Fix consistent-return with explicit returns
🔧 Simplify nested ternaries

### MANUAL REVIEW (Skip or Document)
⚠️ TypeScript any (add TODO comments)
⚠️ Intentional dangerouslySetInnerHTML (add eslint-disable with comment)
⚠️ Complex testing-library cases (add eslint-disable)
⚠️ Performance-critical for...of loops

### SKIP (Low Priority)
❌ react-hooks/exhaustive-deps (requires effect analysis)
❌ Edge case TypeScript shadow issues

## Important Guidelines

${
  dryRun
    ? `
- DO NOT make any changes
- Only analyze and categorize
- Report fix strategies for each category
- Estimate turn count per phase
- Provide breakdown of auto-fix vs manual review
`
    : `
- **CRITICAL: Complete ALL phases in this single session - do NOT stop early**
- **Do NOT create "Recommendations for Next Session" - just continue to the next phase**
- **After completing one phase, IMMEDIATELY move to the next phase**
- **Only stop when you hit the turn limit (${maxTurns}) or complete ALL phases**
- Fix errors in priority order
- Verify with npm run lint after every 20-30 fixes
- Run npm run test:run after each phase
- Skip files that timeout (>2 times) or are overly complex
- Track progress: fixed count, remaining count, new errors (target: 0)
- Add descriptive eslint-disable comments when needed
- Document skipped items for manual review
- Use /commit once at the end with comprehensive summary
`
}

## Timeout Handling

- Use timeout: 60000 for npm run lint
- Use timeout: 120000 for npm run test:run
- Use timeout: 120000 for npm run build:check
- If file times out 2+ times: skip and document
- Keep moving forward, don't get stuck

## Progress Tracking

Every 50 turns, report:
- Current phase
- Errors fixed this phase
- Total errors remaining
- Tests status (passing/failing)
- Files skipped (with reason)
- Estimated completion percentage

## Incremental Verification

After every 20-30 fixes:
1. Run relevant lint command
2. Verify error count decreased
3. Ensure no NEW errors introduced
4. If new errors: revert and skip file

After each phase:
1. Run full test suite
2. Verify all tests pass
3. If tests fail: investigate, fix, or revert
4. Document any skipped items
5. **IMMEDIATELY continue to the next phase - do NOT stop**

## Session Completion Rules

You are in AUTONOMOUS MODE. This means:
- ✅ Continue through all phases automatically
- ✅ Move from Phase 1 → 2 → 3 → 4 → 5 → 7 without stopping
- ✅ Only create ONE commit at the very end (Phase 7)
- ❌ Do NOT stop after completing a phase
- ❌ Do NOT ask "should I continue?"
- ❌ Do NOT create "Recommendations for Next Session"
- ❌ Do NOT provide suggestions for follow-up work
- ❌ Do NOT stop until all phases complete OR you hit turn limit

If you find yourself thinking "let me stop here and suggest next steps", STOP THAT THOUGHT and continue to the next phase instead.

Begin Phase 1: Analysis & Categorization
  `.trim();

  await runResilientHarness(
    {
      harnessName: 'lint',
      watchdogTimeoutMs: watchdogTimeout,
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
            systemPrompt: enhanceSystemPrompt(`You are an ESLint expert fixing code quality issues in ConvoLab.
Follow the multi-phase workflow systematically.
${dryRun ? 'This is a dry run - REPORT ONLY, make NO changes.' : 'Fix lint errors and use /commit when done.'}`),
          },
        })) {
          messageCount++;

          // Record progress for watchdog
          context.recordProgress();

          // Show progress
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

          // Log messages
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

          if (message.type === 'result') {
            if (verbose) {
              console.log(`\n✓ Result: ${message.subtype}`);
            }
            if (message.subtype === 'success') {
              lastMessage = 'Harness completed successfully';
            }
          }
        }

        const endTime = Date.now();
        const durationMs = endTime - startTime;

        console.log('\n\n═══════════════════════════════════════════');
        console.log('✅ Lint Fixing Complete');
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
        console.error('\n❌ Lint harness failed with error:');
        console.error(error);
        process.exit(1);
      }
    }
  );
}

// Parse command line arguments
const args = process.argv.slice(2);

let customMaxTurns = DEFAULT_MAX_TURNS;
const maxTurnsIndex = args.findIndex((arg) => arg === '--max-turns');
if (maxTurnsIndex !== -1 && args[maxTurnsIndex + 1]) {
  customMaxTurns = parseInt(args[maxTurnsIndex + 1], 10);
  if (isNaN(customMaxTurns)) {
    console.error('Invalid --max-turns value. Using default:', DEFAULT_MAX_TURNS);
    customMaxTurns = DEFAULT_MAX_TURNS;
  }
}

let customWatchdogTimeout: number | undefined;
const watchdogTimeoutIndex = args.findIndex((arg) => arg === '--watchdog-timeout');
if (watchdogTimeoutIndex !== -1 && args[watchdogTimeoutIndex + 1]) {
  customWatchdogTimeout = parseInt(args[watchdogTimeoutIndex + 1], 10);
  if (isNaN(customWatchdogTimeout)) {
    console.error('Invalid --watchdog-timeout value. Using default.');
    customWatchdogTimeout = undefined;
  }
}

const priorityIndex = args.findIndex((arg) => arg === '--priority');
let priority: 'critical' | 'high' | 'medium' | 'all' = 'all';
if (priorityIndex !== -1 && args[priorityIndex + 1]) {
  const value = args[priorityIndex + 1] as typeof priority;
  if (['critical', 'high', 'medium', 'all'].includes(value)) {
    priority = value;
  } else {
    console.error('Invalid --priority value. Using default: all');
  }
}

const options: LintHarnessOptions = {
  dryRun: args.includes('--dry-run'),
  verbose: !args.includes('--quiet'),
  testsOnly: args.includes('--tests-only'),
  a11yOnly: args.includes('--a11y-only'),
  typeScriptOnly: args.includes('--typescript-only'),
  priority,
  refactorTests: !args.includes('--no-refactor-tests'),
  maxTurns: customMaxTurns,
  watchdogTimeout: customWatchdogTimeout,
  disableWatchdog: args.includes('--disable-watchdog'),
};

// Run the harness
runLintHarness(options).catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
