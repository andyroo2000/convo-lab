#!/usr/bin/env ts-node
/**
 * Performance Optimization Harness for ConvoLab
 *
 * Autonomously profiles and optimizes performance:
 * - Response time profiling
 * - Database query optimization (N+1, indexing)
 * - API endpoint performance
 * - Client bundle size and rendering
 * - Job queue optimization
 * - Memory and resource usage
 *
 * Usage:
 *   npm run harness:perf                           # Full performance audit (250 turns)
 *   npm run harness:perf -- --dry-run              # Report only, no optimizations
 *   npm run harness:perf -- --max-turns 500        # Custom max turns
 *   npm run harness:perf -- --api-only             # Only audit API performance
 *   npm run harness:perf -- --client-only          # Only audit client performance
 *   npm run harness:perf -- --db-only              # Only audit database queries
 */

import { query } from '@anthropic-ai/claude-agent-sdk';
import { runResilientHarness } from './utils/resilient-harness-wrapper.js';
import { enhanceSystemPrompt } from './utils/timeout-system-prompt.js';
import { formatDuration } from './utils/format-duration.js';

interface PerfHarnessOptions {
  dryRun?: boolean;
  maxTurns?: number;
  verbose?: boolean;
  apiOnly?: boolean; // Only audit API performance
  clientOnly?: boolean; // Only audit client performance
  dbOnly?: boolean; // Only audit database queries
  watchdogTimeout?: number; // Progress watchdog timeout in ms
  disableWatchdog?: boolean; // Disable watchdog entirely
}

const DEFAULT_MAX_TURNS = 50000;

async function runPerfHarness(options: PerfHarnessOptions = {}) {
  const {
    dryRun = false,
    maxTurns = DEFAULT_MAX_TURNS,
    verbose = true,
    apiOnly = false,
    clientOnly = false,
    dbOnly = false,
    watchdogTimeout,
    disableWatchdog = false,
  } = options;

  console.log('⚡ ConvoLab Performance Optimization Harness');
  console.log('═══════════════════════════════════════════\n');

  if (dryRun) {
    console.log('🔍 Running in DRY RUN mode (analysis only)\n');
  }

  console.log(`⚙️  Max turns: ${maxTurns}`);
  console.log(
    `🎯 Mode: ${apiOnly ? 'API only' : clientOnly ? 'Client only' : dbOnly ? 'Database only' : 'Full performance audit'}`
  );
  if (!disableWatchdog) {
    console.log(`⏱️  Watchdog timeout: ${watchdogTimeout || 240000}ms`);
  }
  console.log();

  if (maxTurns > 200) {
    console.log('⚠️  WARNING: Large run detected');
    console.log('   This may take significant time\n');
  }

  console.log('Starting performance profiling...\n');

  const prompt = `
You are running an autonomous performance optimization harness for ConvoLab.

## Your Mission

${
  apiOnly
    ? `
### API Performance Audit Only

1. Profile API endpoint response times
2. Identify slow endpoints
3. Review concurrent request handling
4. Check for redundant API calls
5. Verify caching strategies
6. Optimize and test
7. Commit with /commit
`
    : clientOnly
      ? `
### Client Performance Audit Only

1. Analyze bundle size
2. Check for code splitting opportunities
3. Review React rendering performance
4. Identify lazy loading opportunities
5. Check image optimization
6. Optimize and test
7. Commit with /commit
`
      : dbOnly
        ? `
### Database Performance Audit Only

1. Find N+1 query problems
2. Review Prisma query patterns
3. Check for missing indexes
4. Identify slow queries
5. Optimize eager/lazy loading
6. Test and commit with /commit
`
        : `
## Complete Performance Optimization Workflow

### PHASE 1: Response Time Profiling
1. Identify slow API endpoints:
   - Dialogue generation (/api/dialogues/generate)
   - Audio course generation
   - TTS processing endpoints
   - Database-heavy operations
2. Profile key operations:
   - GPT API latency
   - TTS generation time
   - Audio file processing
   - Job queue processing
3. Measure baseline performance metrics
4. Identify bottlenecks
5. Prioritize optimizations by impact

### PHASE 2: Database Query Optimization
1. Find N+1 query problems:
   - Review Prisma query logs
   - Check for sequential queries in loops
   - Identify missing eager loading
2. Review Prisma query patterns:
   - server/src/services/**/*.ts
   - Check for inefficient includes
   - Verify proper use of select
3. Check for missing indexes:
   - Review frequent WHERE clauses
   - Check foreign key indexes
   - Verify unique constraints
4. Optimize query patterns:
   - Batch queries where possible
   - Use proper eager loading
   - Reduce query result size
   - Add indexes where needed
5. Test query performance improvements

### PHASE 3: API Performance
1. Check endpoint response times:
   - Measure P50, P95, P99 latency
   - Identify slow endpoints
   - Profile execution time
2. Review pagination implementation:
   - Check for efficient cursor-based pagination
   - Verify proper page size limits
   - Avoid offset-based pagination on large tables
3. Verify caching strategies:
   - Redis cache usage
   - Cache hit rates
   - Cache invalidation logic
   - Verify caching on expensive operations
4. Check for redundant API calls:
   - Review client-side API usage
   - Identify duplicate requests
   - Verify proper request deduplication
5. Review concurrent request handling:
   - Check connection pooling
   - Review rate limiting impact
   - Verify proper async handling

### PHASE 4: Client Performance
1. Bundle size analysis:
   - Run build and check bundle sizes
   - Identify large dependencies
   - Check for duplicate dependencies
   - Review vendor bundles
2. Code splitting opportunities:
   - Check for route-based splitting
   - Identify large components for lazy loading
   - Verify proper dynamic imports
3. Lazy loading components:
   - Review React.lazy usage
   - Check for component-level code splitting
   - Verify loading states
4. React rendering optimization:
   - Find unnecessary re-renders
   - Check for missing React.memo
   - Review useMemo/useCallback usage
   - Identify expensive computations
   - Check for proper dependency arrays
5. Image optimization:
   - Check image sizes and formats
   - Verify lazy loading of images
   - Review compression settings
6. Remove unused dependencies:
   - Check package.json for unused packages
   - Verify tree-shaking is effective
   - Remove dead code

### PHASE 5: Job Queue Optimization
1. Review BullMQ job processing:
   - server/src/jobs/queues/
   - Check job processing times
   - Review job priorities
2. Check for job queue bottlenecks:
   - Monitor queue lengths
   - Check for stuck jobs
   - Review job failure rates
3. Optimize concurrency settings:
   - Review worker concurrency limits
   - Check for optimal parallelization
   - Verify resource limits
4. Review retry strategies:
   - Check retry counts
   - Review backoff strategies
   - Verify error handling
5. Check for stuck/failed jobs:
   - Review job cleanup
   - Check for memory leaks in jobs
   - Verify proper job completion

### PHASE 6: Memory & Resource Usage
1. Profile memory leaks:
   - Check for unclosed connections
   - Review event listener cleanup
   - Verify proper resource disposal
2. Review file handling:
   - Check for stream vs buffer usage
   - Verify proper file cleanup
   - Review temporary file management
3. Check for resource cleanup:
   - Database connections
   - Redis connections
   - File handles
   - Event listeners
4. Review connection pooling:
   - Database connection pool size
   - Redis connection pool
   - Verify pool limits and timeouts

### PHASE 7: Report & Optimize
${
  dryRun
    ? `
- List all performance issues found
- Categorize by impact (high, medium, low)
- Provide optimization recommendations
- Benchmark current performance
- No changes made
`
    : `
- Fix high-impact performance issues first
- Benchmark improvements
- Test after each optimization
- Document optimizations in CHANGELOG.md
- Use /commit with detailed performance update message
`
}
`
}

## Performance Analysis Tools

### Profiling Techniques
- API endpoint timing (measure with Date.now() before/after)
- Prisma query logging (enable in development)
- Bundle analyzer (webpack-bundle-analyzer)
- React DevTools Profiler
- Chrome DevTools Performance tab
- Lighthouse for client metrics

### Performance Patterns to Check

#### API Optimization
- Response time < 200ms for simple endpoints
- Response time < 1s for complex operations
- Proper pagination (cursor-based, not offset)
- Redis caching on expensive operations
- Database query batching
- Connection pooling configured

#### Client Optimization
- Bundle size < 500KB (gzipped)
- Initial page load < 3s
- Time to Interactive < 5s
- Lazy load routes and heavy components
- React.memo for expensive components
- useMemo for expensive computations
- useCallback for stable function references

#### Database Optimization
- No N+1 queries
- Proper indexes on foreign keys
- Eager loading for known relations
- Selective queries (use select)
- Batch operations where possible

## Important Guidelines

${
  dryRun
    ? `
- DO NOT make any changes
- Only analyze and report
- Benchmark current performance
- Categorize issues by impact
- Provide optimization recommendations
`
    : `
- Benchmark before and after each change
- Test thoroughly after optimizations
- Document performance improvements
- Avoid premature optimization
- Focus on high-impact issues first
- Use /commit once at the end with performance update
`
}

- Measure, don't guess
- Optimize the bottlenecks, not everything
- Document all findings clearly
${!dryRun ? '- Only use /commit once at the end with all optimizations' : ''}

## Session Completion Rules

You are in AUTONOMOUS MODE. This means:
- ✅ Complete ALL performance optimization tasks automatically without stopping
- ✅ Move from Phase 1 → 2 → 3 → ... → 7 without asking
- ✅ Only create ONE commit at the very end
- ❌ Do NOT stop after completing a phase
- ❌ Do NOT ask "should I continue?"
- ❌ Do NOT create "Recommendations for Next Session"
- ❌ Do NOT provide suggestions for follow-up work
- ❌ Do NOT stop until all work complete OR you hit turn limit

If you find yourself thinking "let me stop here and suggest next steps", STOP THAT THOUGHT and continue working instead.

Begin your performance audit now.
  `.trim();

  await runResilientHarness(
    {
      harnessName: 'performance',
      watchdogTimeoutMs: watchdogTimeout || 240000, // 4 min default for perf tasks
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
            systemPrompt:
              enhanceSystemPrompt(`You are a performance optimization expert for ConvoLab.
Measure before optimizing. Focus on high-impact improvements.
${dryRun ? 'This is a dry run - REPORT ONLY, make NO changes.' : 'Optimize and use /commit when done.'}`),
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
        console.log('✅ Performance Optimization Complete');
        console.log('═══════════════════════════════════════════\n');
        console.log(`📊 Total messages: ${messageCount}`);
        console.log(`⏱️  Duration: ${formatDuration(durationMs)}`);
        console.log(
          `📝 Final status: ${lastMessage.substring(0, 100)}${lastMessage.length > 100 ? '...' : ''}`
        );

        if (dryRun) {
          console.log(
            '\n💡 This was a dry run. To apply optimizations, run without --dry-run flag.'
          );
        }
      } catch (error) {
        console.error('\n❌ Performance optimization failed with error:');
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

const options: PerfHarnessOptions = {
  dryRun: args.includes('--dry-run'),
  verbose: !args.includes('--quiet'),
  apiOnly: args.includes('--api-only'),
  clientOnly: args.includes('--client-only'),
  dbOnly: args.includes('--db-only'),
  maxTurns: customMaxTurns,
  watchdogTimeout: customWatchdogTimeout,
  disableWatchdog: args.includes('--disable-watchdog'),
};

// Run the harness
runPerfHarness(options).catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
