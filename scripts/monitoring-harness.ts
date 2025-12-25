#!/usr/bin/env ts-node
/**
 * Monitoring & Observability Harness for ConvoLab
 *
 * Autonomously sets up and improves monitoring:
 * - Logging infrastructure (Winston, Pino, etc.)
 * - Error tracking (Sentry, custom)
 * - Performance monitoring (APM)
 * - Health checks and alerts
 * - Metrics collection
 * - Log aggregation
 * - Distributed tracing
 *
 * Usage:
 *   npm run harness:monitoring                         # Full monitoring setup (200 turns)
 *   npm run harness:monitoring -- --dry-run            # Report only, no changes
 *   npm run harness:monitoring -- --max-turns 300      # Custom max turns
 *   npm run harness:monitoring -- --logging-only       # Only review logging
 */

import { query } from '@anthropic-ai/claude-agent-sdk';

interface MonitoringHarnessOptions {
  dryRun?: boolean;
  maxTurns?: number;
  verbose?: boolean;
  loggingOnly?: boolean; // Only focus on logging infrastructure
}

const DEFAULT_MAX_TURNS = 50000;

async function runMonitoringHarness(options: MonitoringHarnessOptions = {}) {
  const {
    dryRun = false,
    maxTurns = DEFAULT_MAX_TURNS,
    verbose = true,
    loggingOnly = false,
  } = options;

  console.log('📊 ConvoLab Monitoring & Observability Harness');
  console.log('═══════════════════════════════════════════\n');

  if (dryRun) {
    console.log('🔍 Running in DRY RUN mode (analysis only)\n');
  }

  console.log(`⚙️  Max turns: ${maxTurns}`);
  console.log(
    `🎯 Mode: ${loggingOnly ? 'Logging infrastructure only' : 'Full monitoring setup'}\n`
  );

  console.log('Starting monitoring audit...\n');

  const prompt = `
You are running an autonomous monitoring and observability harness for ConvoLab.

## Your Mission

${
  loggingOnly
    ? `
### Logging Infrastructure Only

1. Review current logging setup
2. Check for proper log levels (debug, info, warn, error)
3. Verify structured logging (JSON format)
4. Ensure sensitive data is not logged
5. Add missing logging where needed
6. Set up log rotation if needed
7. Commit with /commit
`
    : `
## Complete Monitoring & Observability Workflow

### PHASE 1: Logging Infrastructure
1. Review current logging setup:
   - Check if logging library is in use (Winston, Pino, etc.)
   - Review log configuration
   - Check log output format (JSON vs plain text)
   - Verify log levels are used appropriately
2. Check logging coverage:
   - API endpoints log requests/responses
   - Errors are logged with context
   - Important business events are logged
   - Background jobs log progress
   - Database queries log errors
3. Review log quality:
   - Structured logging (JSON format preferred)
   - Include correlation IDs for request tracing
   - Include user context (user ID, email)
   - Include timing information
   - Include relevant metadata
4. Security considerations:
   - No passwords in logs
   - No API keys in logs
   - No PII unless necessary
   - Sanitize sensitive data
5. Set up logging improvements:
   - Add logging library if missing
   - Implement structured logging
   - Add request/response logging middleware
   - Add error logging middleware
   - Set up log rotation

### PHASE 2: Error Tracking
1. Review error handling:
   - Check how errors are caught
   - Review error response formats
   - Verify errors are logged
   - Check for proper HTTP status codes
2. Set up error tracking:
   - Consider Sentry integration (or similar)
   - Set up error boundaries in React
   - Implement global error handlers
   - Track unhandled promise rejections
3. Error context collection:
   - Include stack traces
   - Include user context
   - Include request context
   - Include environment info
   - Include breadcrumbs (recent actions)
4. Error grouping and deduplication:
   - Group similar errors
   - Set up error fingerprinting
   - Configure sample rates
5. Error alerts:
   - Set up alerts for critical errors
   - Configure notification channels
   - Set up error rate thresholds

### PHASE 3: Performance Monitoring
1. Review performance tracking:
   - API endpoint response times
   - Database query duration
   - External API call duration
   - Job processing time
   - Cache hit/miss rates
2. Set up APM (Application Performance Monitoring):
   - Consider APM tools (New Relic, Datadog, etc.)
   - Track slow endpoints
   - Monitor database performance
   - Track external dependencies
3. Client-side performance:
   - Track page load times
   - Monitor Core Web Vitals
   - Track JavaScript errors
   - Monitor bundle sizes
4. Set up performance alerts:
   - Alert on slow endpoints (> 1s)
   - Alert on high error rates (> 1%)
   - Alert on database slow queries

### PHASE 4: Health Checks
1. Implement health check endpoints:
   - /health - basic liveness check
   - /health/ready - readiness check
   - /health/live - detailed health status
2. Check dependencies:
   - Database connectivity
   - Redis connectivity
   - External API availability
   - File system access
3. Expose health metrics:
   - Uptime
   - Memory usage
   - CPU usage
   - Active connections
   - Queue lengths
4. Set up health monitoring:
   - Configure uptime monitoring
   - Set up dependency checks
   - Alert on health check failures

### PHASE 5: Metrics Collection
1. Review current metrics:
   - What's being tracked?
   - Where are metrics stored?
   - How are metrics visualized?
2. Set up key metrics:
   - Request count by endpoint
   - Request duration by endpoint
   - Error count by type
   - Active users
   - Database query count
   - Queue job counts
   - Cache hit rates
3. Business metrics:
   - Dialogues generated
   - Audio files created
   - User sign-ups
   - Subscription conversions
4. Infrastructure metrics:
   - Memory usage
   - CPU usage
   - Disk usage
   - Network I/O

### PHASE 6: Distributed Tracing
1. Review current tracing:
   - Are requests traced across services?
   - Are correlation IDs used?
2. Implement request tracing:
   - Generate correlation IDs
   - Pass IDs through request chain
   - Include in logs
   - Include in error reports
3. Set up distributed tracing (if needed):
   - Consider OpenTelemetry
   - Trace API → Database
   - Trace API → Queue → Worker
   - Trace API → External APIs

### PHASE 7: Alerting & Notifications
1. Review alert requirements:
   - What errors need immediate attention?
   - What performance degradation matters?
   - What uptime issues are critical?
2. Set up alerting channels:
   - Email alerts
   - Slack notifications
   - PagerDuty (for critical)
3. Configure alert rules:
   - Error rate > threshold
   - Response time > threshold
   - Health check failures
   - Dependency failures
   - Queue backup
4. Set up alert escalation:
   - Initial notification
   - Escalation after N minutes
   - Follow-up notifications

### PHASE 8: Documentation & Dashboard
1. Document monitoring setup:
   - What's being monitored
   - Where to find logs
   - How to access metrics
   - Alert escalation procedures
2. Create monitoring dashboard:
   - Real-time metrics
   - Error rates
   - Performance graphs
   - Health status
3. Create runbooks:
   - Common issues and fixes
   - Troubleshooting guides
   - Escalation procedures

### PHASE 9: Report & Implement
${
  dryRun
    ? `
- List current monitoring state
- Identify monitoring gaps
- Recommend monitoring tools
- Provide implementation plan
- No changes made
`
    : `
- Implement critical monitoring features
- Set up logging if missing
- Add error tracking
- Configure health checks
- Update CHANGELOG.md with monitoring improvements
- Use /commit with detailed monitoring update message
`
}
`
}

## Monitoring Best Practices

### Logging Levels
- **DEBUG**: Detailed diagnostic info (dev only)
- **INFO**: General informational messages
- **WARN**: Warning messages (potential issues)
- **ERROR**: Error messages (actual problems)
- **FATAL**: Critical errors (service down)

### What to Log
✅ Log:
- API requests/responses (sanitized)
- Errors with full context
- Important business events
- Authentication attempts
- Performance metrics
- Background job progress

❌ Don't Log:
- Passwords
- API keys
- Credit card numbers
- Personal health information
- Social security numbers

### Structured Logging Format
\`\`\`json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "level": "error",
  "correlationId": "req-123-456",
  "userId": "user-789",
  "service": "api",
  "message": "Failed to generate dialogue",
  "error": {
    "type": "ValidationError",
    "message": "Invalid language code",
    "stack": "..."
  },
  "context": {
    "endpoint": "/api/dialogues/generate",
    "method": "POST",
    "duration": 1234
  }
}
\`\`\`

### Key Metrics to Track
- Request rate (requests/min)
- Error rate (errors/min, %)
- Response time (P50, P95, P99)
- Database query time
- Queue length
- Active users
- Memory usage
- CPU usage

## Important Guidelines

${
  dryRun
    ? `
- DO NOT make any changes
- Only analyze current monitoring
- List monitoring gaps
- Recommend tools and approaches
- Provide implementation priorities
`
    : `
- Start with logging infrastructure
- Add error tracking next
- Implement health checks
- Set up basic metrics
- Document everything
- Use /commit once at the end with monitoring setup
`
}

- Prioritize actionable monitoring
- Avoid alert fatigue
- Document thoroughly
${!dryRun ? '- Only use /commit once at the end with all monitoring improvements' : ''}

## Session Completion Rules

You are in AUTONOMOUS MODE. This means:
- ✅ Complete ALL monitoring tasks automatically without stopping
- ✅ Move from Phase 1 → 2 → 3 → ... → 9 without asking
- ✅ Only create ONE commit at the very end
- ❌ Do NOT stop after completing a phase
- ❌ Do NOT ask "should I continue?"
- ❌ Do NOT create "Recommendations for Next Session"
- ❌ Do NOT provide suggestions for follow-up work
- ❌ Do NOT stop until all work complete OR you hit turn limit

If you find yourself thinking "let me stop here and suggest next steps", STOP THAT THOUGHT and continue working instead.

Begin your monitoring audit now.
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
        systemPrompt: `You are a monitoring and observability expert for ConvoLab.
Focus on actionable monitoring. Avoid alert fatigue.
${dryRun ? 'This is a dry run - REPORT ONLY, make NO changes.' : 'Set up monitoring and use /commit when done.'}`,
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
    console.log('✅ Monitoring Setup Complete');
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
    console.error('\n❌ Monitoring setup failed with error:');
    console.error(error);
    process.exit(1);
  }
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

const options: MonitoringHarnessOptions = {
  dryRun: args.includes('--dry-run'),
  verbose: !args.includes('--quiet'),
  loggingOnly: args.includes('--logging-only'),
  maxTurns: customMaxTurns,
};

// Run the harness
runMonitoringHarness(options).catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
