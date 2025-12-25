#!/usr/bin/env ts-node
/**
 * Security Audit Harness for ConvoLab
 *
 * Autonomously audits and fixes security issues:
 * - Dependency vulnerabilities (npm audit)
 * - Authentication flow security
 * - Authorization checks
 * - Input validation
 * - SQL injection risks
 * - XSS vulnerabilities
 * - CSRF protection
 * - Secret management
 * - API security (rate limiting, auth)
 * - Environment variable leaks
 *
 * Usage:
 *   npm run harness:security                           # Full security audit (300 turns)
 *   npm run harness:security -- --dry-run              # Report only, no fixes
 *   npm run harness:security -- --max-turns 500        # Custom max turns
 *   npm run harness:security -- --deps-only            # Only check dependencies
 *   npm run harness:security -- --code-only            # Only audit code, skip deps
 */

import { query } from '@anthropic-ai/claude-agent-sdk';
import { runResilientHarness } from './utils/resilient-harness-wrapper.js';
import { enhanceSystemPrompt } from './utils/timeout-system-prompt.js';
import { formatDuration } from './utils/format-duration.js';

interface SecurityHarnessOptions {
  dryRun?: boolean;
  maxTurns?: number;
  verbose?: boolean;
  depsOnly?: boolean; // Only check dependencies
  codeOnly?: boolean; // Only audit code, skip dependency scan
  watchdogTimeout?: number; // Progress watchdog timeout in ms
  disableWatchdog?: boolean; // Disable watchdog entirely
}

const DEFAULT_MAX_TURNS = 50000;

async function runSecurityHarness(options: SecurityHarnessOptions = {}) {
  const {
    dryRun = false,
    maxTurns = DEFAULT_MAX_TURNS,
    verbose = true,
    depsOnly = false,
    codeOnly = false,
    watchdogTimeout,
    disableWatchdog = false,
  } = options;

  console.log('🔒 ConvoLab Security Audit Harness');
  console.log('═══════════════════════════════════════════\n');

  if (dryRun) {
    console.log('🔍 Running in DRY RUN mode (analysis only)\n');
  }

  console.log(`⚙️  Max turns: ${maxTurns}`);
  console.log(
    `🎯 Mode: ${depsOnly ? 'Dependencies only' : codeOnly ? 'Code audit only' : 'Full security audit'}`
  );
  if (!disableWatchdog) {
    console.log(`⏱️  Watchdog timeout: ${watchdogTimeout || 300000}ms`);
  }
  console.log();

  if (maxTurns > 200) {
    console.log('⚠️  WARNING: Large run detected');
    console.log('   This may take significant time\n');
  }

  console.log('Starting security audit...\n');

  const prompt = `
You are running an autonomous security audit harness for ConvoLab.

## Your Mission

${
  depsOnly
    ? `
### Dependencies Security Audit Only

1. Run: npm audit
2. Parse vulnerability report
3. For each vulnerability:
   - Assess severity and impact
   - Check for available fixes
   - Apply safe updates (npm audit fix)
   - Document breaking changes if manual upgrade needed
4. Run: npm outdated
5. Identify security-critical outdated packages
6. Update and test
7. Commit with /commit
`
    : codeOnly
      ? `
### Code Security Audit Only

Skip dependency scanning. Focus on code-level security issues.
`
      : `
## Complete Security Audit Workflow

### PHASE 1: Dependency Vulnerabilities
1. Run: npm audit
2. Parse output for vulnerabilities
3. Categorize by severity:
   - Critical (immediate fix required)
   - High (fix soon)
   - Moderate (review and plan)
   - Low (track for future)
4. For each vulnerability:
   - Read vulnerability details
   - Check if automated fix available: npm audit fix
   - If not, check for manual update path
   - Test after each fix
   - Document breaking changes
5. Run: npm outdated
6. Check for security-relevant outdated packages
7. Update critical security packages

### PHASE 2: Authentication & Authorization
1. Review authentication flows:
   - server/src/middleware/auth.ts
   - server/src/routes/auth.ts
   - Login/logout/register endpoints
2. Check for vulnerabilities:
   - Password hashing (bcrypt strength)
   - JWT token security (secret strength, expiry)
   - Session management
   - Password reset flow
   - Email verification flow
3. Review authorization checks:
   - Route protection middleware
   - User role checks
   - Resource ownership verification
   - Admin-only endpoints
4. Test for bypasses:
   - Missing auth checks
   - Insecure direct object references
   - Privilege escalation paths

### PHASE 3: Input Validation & Injection
1. Review all API endpoints in server/src/routes/
2. For each endpoint, check:
   - Input validation (Zod schemas)
   - SQL injection risks (Prisma usage)
   - NoSQL injection (Redis commands)
   - Command injection (shell execution)
   - Path traversal (file operations)
3. Check file upload handling:
   - File type validation
   - Size limits
   - Storage location security
4. Review query parameter handling
5. Check request body parsing

### PHASE 4: XSS & CSRF Protection
1. Review client-side rendering:
   - Dangerous HTML rendering
   - User content display
   - innerHTML usage
   - React dangerouslySetInnerHTML
2. Check CSRF protection:
   - State-changing endpoints
   - CSRF tokens or SameSite cookies
3. Review Content-Security-Policy headers
4. Check for reflected XSS in error messages

### PHASE 5: Secret Management
1. Scan codebase for hardcoded secrets:
   - API keys
   - Database passwords
   - JWT secrets
   - Third-party credentials
2. Verify .env.example has no real secrets
3. Check .gitignore covers all secret files
4. Review environment variable usage
5. Check for secrets in client-side code
6. Verify production secrets not in repo

### PHASE 6: API Security
1. Review rate limiting:
   - Authentication endpoints
   - Resource-intensive endpoints
   - File upload endpoints
2. Check API authentication:
   - JWT validation
   - Token refresh flow
   - API key validation (if applicable)
3. Review CORS configuration:
   - Allowed origins
   - Credentials handling
   - Preflight requests
4. Check response headers:
   - X-Content-Type-Options
   - X-Frame-Options
   - Strict-Transport-Security
   - X-XSS-Protection

### PHASE 7: Third-Party Dependencies
1. Review sensitive integrations:
   - Stripe payment handling
   - Google Cloud TTS
   - Redis connection security
   - Database connection security
2. Check for secure communication:
   - HTTPS enforcement
   - TLS version
   - Certificate validation
3. Review error handling:
   - No sensitive data in error messages
   - Proper error logging
   - Stack traces not exposed to users

### PHASE 8: Report & Fix
${
  dryRun
    ? `
- List all vulnerabilities found
- Categorize by severity
- Provide fix recommendations
- No changes made
`
    : `
- Fix all critical and high severity issues
- Document moderate/low issues for future work
- Update CHANGELOG.md with security fixes
- Use /commit with detailed security update message
`
}
`
}

## Security Scanning Tools

### NPM Audit Output Format
Look for:
- Vulnerability severity (critical, high, moderate, low)
- Affected package and versions
- Dependency path
- Recommended fix (npm audit fix or manual update)

### Code Patterns to Flag

#### Dangerous Patterns
- \`eval()\` usage
- \`new Function()\` with user input
- \`dangerouslySetInnerHTML\` without sanitization
- \`child_process.exec()\` with user input
- Hardcoded secrets (API keys, passwords)
- SQL string concatenation (should use Prisma)
- Missing authentication on routes
- Missing authorization checks
- Weak password requirements
- Missing rate limiting
- Insecure session configuration

#### Good Patterns to Verify
- Zod validation on all endpoints
- Prisma for database queries (prevents SQL injection)
- bcrypt for password hashing
- JWT with proper secrets and expiry
- CORS properly configured
- Input sanitization
- Rate limiting on auth endpoints
- Secure session cookies (httpOnly, secure, sameSite)

## Important Guidelines

${
  dryRun
    ? `
- DO NOT make any changes
- Only analyze and report
- Categorize issues by severity
- Provide fix recommendations
`
    : `
- Fix critical/high severity issues first
- Test after each fix
- Document all security changes in CHANGELOG.md
- Be thorough but avoid breaking changes
- If breaking change needed, document clearly
- Use /commit once at the end with security update
`
}

- Follow OWASP Top 10 guidelines
- Be security-first but practical
- Document all findings clearly
${!dryRun ? '- Only use /commit once at the end with all security fixes' : ''}

## Session Completion Rules

You are in AUTONOMOUS MODE. This means:
- ✅ Complete ALL security audit tasks automatically without stopping
- ✅ Move from Phase 1 → 2 → 3 → ... → 8 without asking
- ✅ Only create ONE commit at the very end
- ❌ Do NOT stop after completing a phase
- ❌ Do NOT ask "should I continue?"
- ❌ Do NOT create "Recommendations for Next Session"
- ❌ Do NOT provide suggestions for follow-up work
- ❌ Do NOT stop until all work complete OR you hit turn limit

If you find yourself thinking "let me stop here and suggest next steps", STOP THAT THOUGHT and continue working instead.

Begin your security audit now.
  `.trim();

  await runResilientHarness(
    {
      harnessName: 'security',
      watchdogTimeoutMs: watchdogTimeout || 300000, // 5 min default for security tasks
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
            systemPrompt: enhanceSystemPrompt(`You are a security expert auditing ConvoLab.
Follow OWASP Top 10 and security best practices.
${dryRun ? 'This is a dry run - REPORT ONLY, make NO changes.' : 'Fix vulnerabilities and use /commit when done.'}`),
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
        console.log('✅ Security Audit Complete');
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
        console.error('\n❌ Security audit failed with error:');
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

const options: SecurityHarnessOptions = {
  dryRun: args.includes('--dry-run'),
  verbose: !args.includes('--quiet'),
  depsOnly: args.includes('--deps-only'),
  codeOnly: args.includes('--code-only'),
  maxTurns: customMaxTurns,
  watchdogTimeout: customWatchdogTimeout,
  disableWatchdog: args.includes('--disable-watchdog'),
};

// Run the harness
runSecurityHarness(options).catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
