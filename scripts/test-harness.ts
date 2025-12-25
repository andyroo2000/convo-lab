#!/usr/bin/env ts-node
/**
 * Test Harness for ConvoLab
 *
 * Autonomously:
 * - Runs tests and fixes failures
 * - Audits coverage gaps
 * - Identifies missing test cases
 * - Writes new tests
 * - Verifies everything passes
 *
 * Usage:
 *   npm run harness:test                           # Full test improvement (500 turns)
 *   npm run harness:test -- --dry-run              # Analysis only
 *   npm run harness:test -- --fix-only             # Fix failures only
 *   npm run harness:test -- --coverage-only        # Coverage audit only
 *   npm run harness:test -- --target-coverage 90   # Custom coverage target
 *   npm run harness:test -- --max-turns 1000       # Custom max turns
 */

import { query } from '@anthropic-ai/claude-agent-sdk';

interface TestHarnessOptions {
  dryRun?: boolean;
  maxTurns?: number;
  verbose?: boolean;
  fixOnly?: boolean; // Only fix existing failures, no new tests
  coverageOnly?: boolean; // Only audit and write tests, don't fix
  targetCoverage?: number; // Target coverage % (default: 80)
}

const DEFAULT_MAX_TURNS = 500;
const DEFAULT_TARGET_COVERAGE = 80;

async function runTestHarness(options: TestHarnessOptions = {}) {
  const {
    dryRun = false,
    maxTurns = DEFAULT_MAX_TURNS,
    verbose = true,
    fixOnly = false,
    coverageOnly = false,
    targetCoverage = DEFAULT_TARGET_COVERAGE,
  } = options;

  console.log('🧪 ConvoLab Test Harness');
  console.log('═══════════════════════════════════════════\n');

  if (dryRun) {
    console.log('🔍 Running in DRY RUN mode (analysis only)\n');
  }

  console.log(`⚙️  Max turns: ${maxTurns}`);
  console.log(`📊 Target coverage: ${targetCoverage}%`);
  console.log(
    `🎯 Mode: ${fixOnly ? 'Fix failures only' : coverageOnly ? 'Coverage audit only' : 'Full test improvement'}\n`
  );

  if (maxTurns > 200) {
    console.log('⚠️  WARNING: Large run detected');
    console.log('   This may take significant time');
    console.log('   Consider using --fix-only or --coverage-only for focused runs\n');
  }

  console.log('Starting analysis...\n');

  const prompt = `
You are running an autonomous test improvement harness for ConvoLab.

## Your Mission

${
  fixOnly
    ? `
### PHASE 1 ONLY: Fix Failing Tests

1. Run tests: npm run test:run
2. Identify all failures
3. For each failure:
   - Analyze the error
   - Read test and source files
   - Fix the issue
4. Re-run to verify
5. Commit with /commit
`
    : coverageOnly
      ? `
### PHASES 2-5: Coverage Audit & Test Writing

1. Run coverage: npm run test:coverage
2. Parse coverage reports
3. Identify gaps (files/functions with low coverage)
4. List missing test cases
5. Write new tests following existing patterns
6. Run to verify they pass
7. Commit with /commit
`
      : `
## Complete Test Improvement Workflow

### PHASE 1: Fix Failing Tests
1. Run: npm run test:run
2. Parse output for failures
3. For each failing test:
   - Read the test file
   - Read the source code
   - Analyze the failure
   - Determine fix (test or source)
   - Apply fix
4. Re-run tests until all pass

### PHASE 2: Coverage Audit
1. Run: npm run test:coverage
2. Parse coverage reports (v8 format)
3. Identify files with coverage < ${targetCoverage}%
4. Prioritize by importance:
   - Routes/API (critical)
   - Services (high)
   - Middleware (high)
   - Components (medium)
   - Utilities/Hooks (medium)

### PHASE 3: Identify Missing Test Cases
For each low-coverage file:
1. Read the source code
2. List all functions/classes/methods
3. Check existing tests
4. Identify untested:
   - Functions/methods
   - Error paths
   - Edge cases
   - Integration scenarios

### PHASE 4: Write New Tests
For each missing test case:
1. Determine test type (unit/integration/component/e2e)
2. Follow existing patterns from similar tests
3. Write comprehensive tests:
   - Success paths
   - Error handling
   - Edge cases
   - Mocks for dependencies
4. Place in appropriate __tests__/ directory

### PHASE 5: Verify New Tests
1. Run each new test to verify it works
2. Fix any issues
3. Run full suite: npm run test:run
4. Verify no regressions
5. Check coverage improved: npm run test:coverage

### PHASE 6: Commit
1. Update CHANGELOG.md with summary
2. Use /commit with detailed message
`
}

## Test Infrastructure Context

### File Locations
- **Client tests**: client/src/*/__tests__/*.test.tsx
- **Server tests**: server/src/__tests__/unit/**/*.test.ts
- **E2E tests**: e2e/*.spec.ts

### Test Patterns to Follow

#### Client Component Test
\`\`\`typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import ComponentName from '../ComponentName';

// Mock dependencies
vi.mock('../../hooks/useHook');

describe('ComponentName', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render correctly', () => {
    render(
      <BrowserRouter>
        <ComponentName />
      </BrowserRouter>
    );
    expect(screen.getByTestId('component-name')).toBeInTheDocument();
  });
});
\`\`\`

#### Server Unit Test
\`\`\`typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { functionName } from '../moduleName';

// Hoist mocks
vi.mock('external-dep');

describe('functionName', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle success case', async () => {
    const result = await functionName(validInput);
    expect(result).toEqual(expectedOutput);
  });

  it('should handle errors', async () => {
    await expect(functionName(invalidInput)).rejects.toThrow('Error message');
  });
});
\`\`\`

### Coverage Report Format
Server uses v8 coverage with reporters: text, html
Look for:
- Statements %
- Branches %
- Functions %
- Lines %

Files excluded from coverage:
- node_modules/
- dist/
- __tests__/
- scripts/
- prisma/

## Important Guidelines

${
  dryRun
    ? `
- DO NOT make any changes
- Only analyze and report
- List all issues found
- Provide recommendations
`
    : `
- Fix tests before writing new ones
- Follow existing test patterns exactly
- Use proper mocking (vi.mock, vi.hoisted)
- Write descriptive test names
- Test both success and error paths
- Verify all tests pass before committing
- Update CHANGELOG.md
- Use /commit once at the end
`
}

- Be thorough but efficient
- Track progress clearly
${!dryRun ? '- Only use /commit once at the end with all changes' : ''}

Begin your analysis now.
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
          ? ['Read', 'Glob', 'Grep', 'Bash']
          : ['Read', 'Edit', 'Write', 'Glob', 'Grep', 'Bash', 'Skill'],
        systemPrompt: `You are a test engineering expert maintaining ConvoLab.
Follow the project's testing patterns exactly.
${dryRun ? 'This is a dry run - REPORT ONLY, make NO changes.' : 'Fix issues and write tests. Use /commit when done.'}`,
      },
    })) {
      messageCount++;

      // Show progress
      const now = Date.now();
      if (messageCount % 10 === 0 || now - lastProgressUpdate > 30000) {
        const progress = ((messageCount / maxTurns) * 100).toFixed(1);
        console.log(`\n📊 Progress: ${messageCount}/${maxTurns} turns (${progress}%)`);
        lastProgressUpdate = now;
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
    console.log('✅ Harness Complete');
    console.log('═══════════════════════════════════════════\n');
    console.log(`📊 Total messages: ${messageCount}`);
    console.log(`⏱️  Duration: ${durationMin} minutes (${durationHr} hours)`);
    console.log(
      `📝 Final status: ${lastMessage.substring(0, 100)}${lastMessage.length > 100 ? '...' : ''}`
    );

    if (dryRun) {
      console.log('\n💡 This was a dry run. To apply changes, run without --dry-run flag.');
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

// Check for --target-coverage argument
let customTargetCoverage = DEFAULT_TARGET_COVERAGE;
const targetCoverageIndex = args.findIndex((arg) => arg === '--target-coverage');
if (targetCoverageIndex !== -1 && args[targetCoverageIndex + 1]) {
  customTargetCoverage = parseInt(args[targetCoverageIndex + 1], 10);
  if (isNaN(customTargetCoverage) || customTargetCoverage < 0 || customTargetCoverage > 100) {
    console.error('Invalid --target-coverage value. Using default:', DEFAULT_TARGET_COVERAGE);
    customTargetCoverage = DEFAULT_TARGET_COVERAGE;
  }
}

const options: TestHarnessOptions = {
  dryRun: args.includes('--dry-run'),
  verbose: !args.includes('--quiet'),
  fixOnly: args.includes('--fix-only'),
  coverageOnly: args.includes('--coverage-only'),
  maxTurns: customMaxTurns,
  targetCoverage: customTargetCoverage,
};

// Run the harness
runTestHarness(options).catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
