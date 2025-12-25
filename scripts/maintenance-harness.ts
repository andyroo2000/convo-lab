#!/usr/bin/env ts-node
/**
 * Maintenance Harness for ConvoLab
 *
 * All-in-one daily maintenance tasks:
 * - Run all tests
 * - Type checking
 * - Build verification
 * - Dependency health
 * - Code quality (linting)
 * - Git health
 * - Documentation verification
 *
 * Usage:
 *   npm run harness:maintenance                    # Full maintenance (150 turns)
 *   npm run harness:maintenance -- --dry-run       # Report only, no fixes
 *   npm run harness:maintenance -- --quick         # Tests + types + build only
 *   npm run harness:maintenance -- --max-turns 300 # Custom max turns
 */

import { query } from '@anthropic-ai/claude-agent-sdk';
import { runResilientHarness } from './utils/resilient-harness-wrapper.js';
import { enhanceSystemPrompt } from './utils/timeout-system-prompt.js';

interface MaintenanceHarnessOptions {
  dryRun?: boolean;
  maxTurns?: number;
  verbose?: boolean;
  quick?: boolean; // Tests + types + build only (skip deps/docs)
  watchdogTimeout?: number; // Progress watchdog timeout in ms
  disableWatchdog?: boolean; // Disable watchdog entirely
}

const DEFAULT_MAX_TURNS = 50000;

async function runMaintenanceHarness(options: MaintenanceHarnessOptions = {}) {
  const {
    dryRun = false,
    maxTurns = DEFAULT_MAX_TURNS,
    verbose = true,
    quick = false,
    watchdogTimeout,
    disableWatchdog = false,
  } = options;

  console.log('🔧 ConvoLab Maintenance Harness');
  console.log('═══════════════════════════════════════════\n');

  if (dryRun) {
    console.log('🔍 Running in DRY RUN mode (analysis only)\n');
  }

  console.log(`⚙️  Max turns: ${maxTurns}`);
  console.log(`🎯 Mode: ${quick ? 'Quick (tests + types + build)' : 'Full maintenance'}`);
  if (!disableWatchdog) {
    console.log(`⏱️  Watchdog timeout: ${watchdogTimeout || 180000}ms`);
  }
  console.log();

  console.log('Starting maintenance tasks...\n');

  const prompt = `
You are running an autonomous maintenance harness for ConvoLab.

## Your Mission

${
  quick
    ? `
### Quick Maintenance Mode (Tests + Types + Build Only)

1. Run tests: npm run test:run
2. Fix trivial test failures
3. Report complex failures for manual review
4. Run type check: npm run type-check
5. Fix TypeScript errors
6. Run build: npm run build
7. Fix build errors
8. Report success summary
9. Commit with /commit if fixes were made

Note: Quick mode skips dependency health, code quality, git health, documentation, accessibility, monitoring, and mobile checks. Use full mode for comprehensive maintenance.
`
    : `
## Complete Daily Maintenance Workflow

### PHASE 1: Run All Tests
1. Run: npm run test:run
2. Parse output for failures
3. For each failure:
   - Read test file and source code
   - Determine if trivial (quick fix) or complex
   - Fix trivial failures immediately
   - Document complex failures for review
4. Re-run tests until all pass or only complex failures remain
5. Report test results

### PHASE 2: Type Checking
1. Run: npm run type-check
2. Parse TypeScript errors
3. For each error:
   - Read the affected file
   - Determine if fixable
   - Fix type errors
   - Document unfixable issues
4. Re-run type-check until clean
5. Report type check results

### PHASE 3: Build Verification
1. Run: npm run build
2. Parse build output
3. For each build error:
   - Read the affected file
   - Fix build errors
   - Document build warnings
4. Verify production build succeeds
5. Check build output sizes
6. Report build results

### PHASE 4: Dependency Health
1. Check for outdated dependencies:
   - Run: npm outdated
   - Identify packages needing updates
   - Check for security implications
2. Review dependency vulnerabilities:
   - Run: npm audit
   - Review vulnerability report
   - Check for available fixes
3. Suggest safe updates:
   - Patch and minor updates (safe)
   - Document major updates for review
   - Check for breaking changes
4. Report dependency health

### PHASE 5: Code Quality
1. Run linter:
   - Run: npm run lint
   - Parse lint errors and warnings
2. Fix auto-fixable issues:
   - Run: npm run lint -- --fix
   - Report what was auto-fixed
3. Review remaining lint errors:
   - Read files with lint errors
   - Fix simple issues
   - Document complex issues for review
4. Check for dead code:
   - Unused imports
   - Unused variables
   - Unreachable code
5. Report code quality results

### PHASE 6: Git Health
1. Check for uncommitted changes:
   - Run: git status
   - List uncommitted files
   - Check for untracked files
2. Review stale branches:
   - Run: git branch
   - Identify branches not recently updated
   - Suggest cleanup
3. Check for merge conflicts:
   - Review git status for conflicts
   - Document conflicts if any
4. Report git health

### PHASE 7: Documentation
1. Verify README accuracy:
   - Read README.md
   - Check for outdated information
   - Verify setup instructions
   - Check for broken links
2. Check CHANGELOG is up-to-date:
   - Read CHANGELOG.md
   - Compare with recent commits
   - Verify latest changes are documented
3. Review API documentation:
   - Check server/README.md if exists
   - Verify endpoint documentation
   - Check for missing docs
4. Flag outdated docs:
   - Identify stale documentation
   - Suggest updates
5. Report documentation health

### PHASE 8: Accessibility Quick Check
1. Quick WCAG review:
   - Spot check color contrast on key pages
   - Verify form labels exist
   - Check for alt text on images
   - Verify keyboard navigation basics
2. Common accessibility issues:
   - Missing ARIA labels on buttons
   - Poor heading hierarchy
   - Low contrast text
   - Non-semantic HTML (divs as buttons)
3. Report accessibility status:
   - List any critical accessibility issues found
   - Suggest running full accessibility harness if needed

### PHASE 9: Monitoring Quick Check
1. Quick logging review:
   - Verify errors are being logged
   - Check for console.log in production code
   - Verify sensitive data not logged
2. Error handling review:
   - Check error boundaries exist
   - Verify API errors are caught
   - Check for unhandled promise rejections
3. Health check verification:
   - Verify health endpoints exist
   - Check basic monitoring is in place
4. Report monitoring status:
   - List any critical monitoring gaps
   - Suggest running full monitoring harness if needed

### PHASE 10: Mobile Quick Check
1. Quick responsive check:
   - Verify viewport meta tag exists
   - Check for horizontal scroll issues
   - Verify touch targets are adequate (>= 44px)
2. Mobile UX review:
   - Check hamburger menu works
   - Verify forms work on mobile
   - Check text is readable (>= 16px)
3. PWA basics:
   - Check if manifest.json exists
   - Verify icons are defined
4. Report mobile status:
   - List any critical mobile issues found
   - Suggest running full mobile harness if needed

### PHASE 11: Summary & Commit
${
  dryRun
    ? `
- Summarize all findings
- List issues by category
- Provide recommendations
- No changes made
`
    : `
- Summarize all fixes made
- List remaining issues for manual review
- Update CHANGELOG.md with maintenance summary
- Use /commit with detailed maintenance message
`
}
`
}

## Maintenance Task Guidelines

### Test Fixing Strategy
- **Trivial**: Simple assertion updates, mock fixes, prop updates
- **Complex**: Architectural changes, major refactors, design issues
- Fix trivial, document complex
- Don't spend too much time on complex test failures

### Type Error Strategy
- Fix obvious type errors (missing types, wrong types)
- Add proper types where missing
- Document complex type issues
- Avoid using \`any\` unless necessary

### Build Error Strategy
- Fix import errors
- Fix missing dependencies
- Fix configuration issues
- Document complex build problems

### Dependency Update Strategy
- Auto-update patch versions (e.g., 1.0.0 → 1.0.1)
- Suggest minor version updates (e.g., 1.0.0 → 1.1.0)
- Document major version updates for review (e.g., 1.0.0 → 2.0.0)
- Check breaking changes before updating

### Linting Strategy
- Use auto-fix when available
- Fix simple style issues
- Document complex lint issues
- Don't change code logic to fix lint

## Important Guidelines

${
  dryRun
    ? `
- DO NOT make any changes
- Only analyze and report
- List all issues found
- Provide fix recommendations
`
    : `
- Fix quick wins first
- Document complex issues for later
- Test after significant changes
- Update CHANGELOG.md
- Use /commit once at the end
`
}

- Be thorough but efficient
- Prioritize high-impact issues
- Track progress clearly
${!dryRun ? '- Only use /commit once at the end with all fixes' : ''}

## Session Completion Rules

You are in AUTONOMOUS MODE. This means:
- ✅ Complete ALL maintenance tasks automatically without stopping
- ✅ Move from dependencies → code → docs → cleanup without asking
- ✅ Only create ONE commit at the very end
- ❌ Do NOT stop after completing a category
- ❌ Do NOT ask "should I continue?"
- ❌ Do NOT create "Recommendations for Next Session"
- ❌ Do NOT provide suggestions for follow-up work
- ❌ Do NOT stop until all tasks complete OR you hit turn limit

If you find yourself thinking "let me stop here and suggest next steps", STOP THAT THOUGHT and continue working instead.

Begin your maintenance tasks now.
  `.trim();

  await runResilientHarness(
    {
      harnessName: 'maintenance',
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
            systemPrompt: enhanceSystemPrompt(`You are a maintenance automation expert for ConvoLab.
Fix quick wins, document complex issues.
${dryRun ? 'This is a dry run - REPORT ONLY, make NO changes.' : 'Perform maintenance and use /commit when done.'}`),
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
        const durationMin = (durationMs / 60000).toFixed(1);
        const durationHr = (durationMs / 3600000).toFixed(2);

        console.log('\n\n═══════════════════════════════════════════');
        console.log('✅ Maintenance Complete');
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
        console.error('\n❌ Maintenance failed with error:');
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

const options: MaintenanceHarnessOptions = {
  dryRun: args.includes('--dry-run'),
  verbose: !args.includes('--quiet'),
  quick: args.includes('--quick'),
  maxTurns: customMaxTurns,
  watchdogTimeout: customWatchdogTimeout,
  disableWatchdog: args.includes('--disable-watchdog'),
};

// Run the harness
runMaintenanceHarness(options).catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
