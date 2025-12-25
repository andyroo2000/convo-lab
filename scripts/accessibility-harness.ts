#!/usr/bin/env ts-node
/**
 * Accessibility Audit Harness for ConvoLab
 *
 * Autonomously audits and fixes accessibility issues:
 * - WCAG 2.1 compliance (A, AA, AAA levels)
 * - Screen reader compatibility
 * - Keyboard navigation
 * - Color contrast
 * - ARIA attributes
 * - Semantic HTML
 * - Focus management
 * - Alt text for images
 *
 * Usage:
 *   npm run harness:accessibility                      # Full accessibility audit (200 turns)
 *   npm run harness:accessibility -- --dry-run         # Report only, no fixes
 *   npm run harness:accessibility -- --max-turns 300   # Custom max turns
 *   npm run harness:accessibility -- --wcag-aa         # Only WCAG AA compliance
 */

import { query } from '@anthropic-ai/claude-agent-sdk';
import { runResilientHarness } from './utils/resilient-harness-wrapper.js';
import { enhanceSystemPrompt } from './utils/timeout-system-prompt.js';
import { formatDuration } from './utils/format-duration.js';

interface AccessibilityHarnessOptions {
  dryRun?: boolean;
  maxTurns?: number;
  verbose?: boolean;
  wcagAA?: boolean; // Only focus on WCAG AA compliance
  watchdogTimeout?: number; // Progress watchdog timeout in ms
  disableWatchdog?: boolean; // Disable watchdog entirely
}

const DEFAULT_MAX_TURNS = 50000;

async function runAccessibilityHarness(options: AccessibilityHarnessOptions = {}) {
  const {
    dryRun = false,
    maxTurns = DEFAULT_MAX_TURNS,
    verbose = true,
    wcagAA = false,
    watchdogTimeout,
    disableWatchdog = false,
  } = options;

  console.log('♿ ConvoLab Accessibility Audit Harness');
  console.log('═══════════════════════════════════════════\n');

  if (dryRun) {
    console.log('🔍 Running in DRY RUN mode (analysis only)\n');
  }

  console.log(`⚙️  Max turns: ${maxTurns}`);
  console.log(`🎯 Mode: ${wcagAA ? 'WCAG AA compliance only' : 'Full accessibility audit'}`);
  if (!disableWatchdog) {
    console.log(`⏱️  Watchdog timeout: ${watchdogTimeout || 180000}ms`);
  }
  console.log();

  console.log('Starting accessibility audit...\n');

  const prompt = `
You are running an autonomous accessibility audit harness for ConvoLab.

## Your Mission

${
  wcagAA
    ? `
### WCAG AA Compliance Only

Focus exclusively on WCAG 2.1 Level AA compliance:
1. Review all components and pages
2. Check color contrast (4.5:1 for text, 3:1 for large text)
3. Verify keyboard navigation
4. Check ARIA attributes
5. Test with screen reader compatibility in mind
6. Fix issues and commit with /commit
`
    : `
## Complete Accessibility Audit Workflow

### PHASE 1: Semantic HTML Review
1. Review all components in client/src/components/
2. Check for proper semantic HTML:
   - Use <button> for buttons, not <div onClick>
   - Use <nav> for navigation
   - Use <main>, <header>, <footer> appropriately
   - Use <h1>-<h6> in proper hierarchy
   - Use <label> with form inputs
   - Use <ul>/<ol> for lists
3. Identify non-semantic markup:
   - Divs used as buttons
   - Spans used as headings
   - Missing semantic structure
4. Fix semantic HTML issues

### PHASE 2: Keyboard Navigation
1. Review interactive elements:
   - All buttons, links, form inputs
   - Modals and dialogs
   - Dropdown menus
   - Custom components
2. Check keyboard accessibility:
   - Tab order is logical
   - All interactive elements are focusable
   - Focus is visible (focus rings)
   - Enter/Space work on buttons
   - Escape closes modals
   - Arrow keys work in menus
3. Test for keyboard traps:
   - Ensure users can Tab out of all elements
   - Check modal focus management
4. Fix keyboard navigation issues

### PHASE 3: ARIA Attributes
1. Review ARIA usage:
   - aria-label for icon buttons
   - aria-labelledby for sections
   - aria-describedby for help text
   - aria-hidden for decorative elements
   - aria-live for dynamic content
   - role attributes (button, dialog, menu, etc.)
2. Check for ARIA anti-patterns:
   - Redundant ARIA (e.g., <button role="button">)
   - Missing ARIA labels on interactive elements
   - Incorrect role usage
3. Verify ARIA states:
   - aria-expanded for expandable elements
   - aria-checked for checkboxes
   - aria-selected for selections
   - aria-disabled for disabled states
4. Fix ARIA issues

### PHASE 4: Color Contrast
1. Review color combinations:
   - Text colors vs backgrounds
   - Button colors
   - Link colors
   - Focus indicators
2. Check WCAG contrast ratios:
   - 4.5:1 for normal text (AA)
   - 3:1 for large text (18pt+ or 14pt+ bold) (AA)
   - 7:1 for normal text (AAA)
   - 4.5:1 for large text (AAA)
3. Test in different color modes:
   - Light mode
   - Dark mode (if applicable)
4. Fix contrast issues:
   - Adjust colors to meet WCAG AA
   - Document colors that can't be fixed

### PHASE 5: Form Accessibility
1. Review all forms:
   - Login/register forms
   - Dialogue generation forms
   - Settings forms
   - Search forms
2. Check form accessibility:
   - All inputs have <label> elements
   - Labels are properly associated (htmlFor/id)
   - Error messages are announced
   - Required fields are marked (aria-required)
   - Field validation is accessible
   - Form submission feedback is accessible
3. Review form patterns:
   - Grouping with <fieldset>/<legend>
   - Error summary at top of form
   - Inline error messages
4. Fix form accessibility issues

### PHASE 6: Screen Reader Compatibility
1. Review dynamic content:
   - Loading states (use aria-live)
   - Success/error messages (use role="alert")
   - Content updates (use aria-live="polite")
   - Notifications
2. Check screen reader announcements:
   - Page titles are descriptive
   - Skip links for navigation
   - Landmark regions (nav, main, complementary)
   - Proper heading structure
3. Review alternative text:
   - All images have alt text
   - Decorative images have alt=""
   - Icons have aria-label
   - SVGs have <title> elements
4. Fix screen reader issues

### PHASE 7: Focus Management
1. Review focus behavior:
   - Modal opening (focus first element)
   - Modal closing (return focus)
   - Page navigation (reset focus appropriately)
   - Error handling (focus error message)
2. Check focus visibility:
   - Focus rings are visible
   - Focus rings meet 3:1 contrast
   - Custom focus styles are clear
3. Review focus order:
   - Tab order matches visual order
   - No tabindex > 0 (anti-pattern)
   - Appropriate use of tabindex="-1"
4. Fix focus management issues

### PHASE 8: Mobile Accessibility
1. Review touch targets:
   - Minimum 44x44px touch targets
   - Adequate spacing between targets
   - No tiny buttons or links
2. Check mobile navigation:
   - Hamburger menu is accessible
   - Mobile menus are keyboard accessible
   - Swipe gestures have alternatives
3. Review mobile-specific issues:
   - Text is readable without zoom
   - Content doesn't require horizontal scroll
   - Forms work on mobile keyboards
4. Fix mobile accessibility issues

### PHASE 9: Report & Fix
${
  dryRun
    ? `
- List all accessibility issues found
- Categorize by WCAG level (A, AA, AAA)
- Prioritize by user impact
- Provide fix recommendations
- No changes made
`
    : `
- Fix critical accessibility issues (WCAG A/AA)
- Document WCAG AAA issues for future work
- Update CHANGELOG.md with accessibility improvements
- Use /commit with detailed accessibility update message
`
}
`
}

## Accessibility Testing Guidelines

### WCAG 2.1 Levels
- **Level A**: Basic accessibility (must have)
- **Level AA**: Industry standard (target level)
- **Level AAA**: Enhanced accessibility (nice to have)

### Common Accessibility Issues to Check

#### Critical (WCAG A/AA)
- Missing alt text on images
- Insufficient color contrast
- Missing form labels
- Keyboard navigation broken
- Missing ARIA labels on interactive elements
- Non-semantic HTML (divs as buttons)
- Missing focus indicators
- Inaccessible modals/dialogs

#### Important (WCAG AAA)
- Enhanced color contrast (7:1)
- Enhanced error identification
- No time limits (or extendable)
- Animation controls
- Enhanced focus indicators

### Accessibility Patterns to Verify

#### Good Patterns
- Semantic HTML (<button>, <nav>, <main>)
- Proper heading hierarchy (h1 → h2 → h3)
- Labels associated with inputs
- aria-label on icon buttons
- Focus management in modals
- Skip links for navigation
- Landmark regions
- aria-live for dynamic content

#### Anti-Patterns to Avoid
- <div onClick> instead of <button>
- tabindex > 0
- Redundant ARIA
- Missing alt text
- Poor color contrast
- Keyboard traps
- Invisible focus indicators
- Role="button" on actual <button>

## Important Guidelines

${
  dryRun
    ? `
- DO NOT make any changes
- Only analyze and report
- Categorize issues by WCAG level
- Prioritize by user impact
- Provide fix recommendations
`
    : `
- **CRITICAL: Complete ALL accessibility fixes in this single session - do NOT stop early**
- **Do NOT create "Recommendations for Next Session" - just continue fixing**
- **After fixing one category, IMMEDIATELY move to the next category**
- **Only stop when you hit the turn limit (${maxTurns}) or complete ALL fixes**
- Fix WCAG A and AA issues first
- Test keyboard navigation after changes
- Verify color contrast with tools
- Document complex accessibility decisions
- Use /commit once at the end with accessibility update
`
}

- Follow WCAG 2.1 guidelines
- Prioritize user impact
- Test with keyboard navigation
${!dryRun ? '- Only use /commit once at the end with all fixes' : ''}

## Session Completion Rules

You are in AUTONOMOUS MODE. This means:
- ✅ Continue fixing all accessibility issues automatically
- ✅ Move from WCAG A → AA → AAA issues without stopping
- ✅ Only create ONE commit at the very end
- ❌ Do NOT stop after completing a category
- ❌ Do NOT ask "should I continue?"
- ❌ Do NOT create "Recommendations for Next Session"
- ❌ Do NOT provide suggestions for follow-up work
- ❌ Do NOT stop until all fixes complete OR you hit turn limit

If you find yourself thinking "let me stop here and suggest next steps", STOP THAT THOUGHT and continue fixing instead.

Begin your accessibility audit now.
  `.trim();

  await runResilientHarness(
    {
      harnessName: 'accessibility',
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
            systemPrompt: enhanceSystemPrompt(`You are an accessibility expert auditing ConvoLab.
Follow WCAG 2.1 guidelines. Prioritize WCAG A and AA compliance.
${dryRun ? 'This is a dry run - REPORT ONLY, make NO changes.' : 'Fix accessibility issues and use /commit when done.'}`),
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
        console.log('✅ Accessibility Audit Complete');
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
        console.error('\n❌ Accessibility audit failed with error:');
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

const options: AccessibilityHarnessOptions = {
  dryRun: args.includes('--dry-run'),
  verbose: !args.includes('--quiet'),
  wcagAA: args.includes('--wcag-aa'),
  maxTurns: customMaxTurns,
  watchdogTimeout: customWatchdogTimeout,
  disableWatchdog: args.includes('--disable-watchdog'),
};

// Run the harness
runAccessibilityHarness(options).catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
