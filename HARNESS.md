# Claude Code Harness Documentation

This document explains how to use Claude Code harnesses for autonomous tasks in ConvoLab.

## What is a Harness?

A **harness** is an autonomous Claude Code script that can run complex multi-step tasks without user intervention. Harnesses use the Claude Agent SDK with your Claude Max Plan subscription (via OAuth token) to perform tasks like:

- Automated testing and fixing
- Code quality checks
- Translation consistency verification
- Documentation updates
- Security audits

## Prerequisites

### 1. Claude Max Plan Subscription
You need an active Claude Max Plan subscription to run harnesses.

### 2. OAuth Token Setup
Generate and set your OAuth token (one-time setup):

```bash
# Generate token (opens browser for auth)
claude setup-token

# Copy the token and add to your shell config
echo 'export CLAUDE_CODE_OAUTH_TOKEN="your-token-here"' >> ~/.zshrc
source ~/.zshrc
```

The OAuth token is already configured in your `~/.zshrc` and will persist across sessions.

### 3. Agent SDK Installation
The Claude Agent SDK is already installed as a dev dependency:

```bash
# Already done - no action needed
npm install --save-dev @anthropic-ai/claude-agent-sdk
```

## Available Harnesses

### i18n Consistency Checker

Autonomously checks and fixes internationalization issues across all locale files.

**What it does:**
- ✅ Compares all 6 locales (ar, en, es, fr, ja, zh)
- ✅ Finds missing translation keys
- ✅ Validates JSON structure and formatting
- ✅ Checks for unused translations
- ✅ Verifies translation key usage in codebase
- ✅ Fixes issues and commits changes (when not in dry-run mode)

**Usage:**

```bash
# Dry run - report issues only, no changes
npm run harness:i18n:dry-run

# Full run - analyze and fix issues automatically
npm run harness:i18n
```

**Example output:**
```
🌍 ConvoLab i18n Consistency Checker Harness
═══════════════════════════════════════════

💬 Claude: Reading all English locale files as source of truth...
💬 Claude: Comparing with other locales...
💬 Claude: Found 12 missing keys in Spanish locale...
💬 Claude: Fixing issues...

✅ Harness Complete
📊 Total messages: 45
📝 Final status: Fixed 12 missing translations, formatted 3 files
```

**Configuration:**
- Max turns: 50 (configurable in script)
- Permission mode: `acceptEdits` (auto-approves file edits)
- Allowed tools: Read, Edit, Glob, Grep, Bash, Skill

## Usage Limits

Harnesses use your Claude Max Plan subscription limits:
- **Max Plan**: 225-900 messages per 5 hours (depending on tier)
- Each harness run counts against this limit
- Monitor your usage to avoid hitting rate limits

## Creating New Harnesses

To create a new harness for a different task:

1. **Create a new script** in `scripts/`:
   ```typescript
   // scripts/my-harness.ts
   import { query } from "@anthropic-ai/claude-agent-sdk";

   async function runMyHarness() {
     for await (const message of query({
       prompt: "Your task description here",
       options: {
         cwd: '/Users/andrewlandry/source/convo-lab',
         permissionMode: 'acceptEdits',
         maxTurns: 50,
         allowedTools: ['Read', 'Edit', 'Bash']
       }
     })) {
       console.log(message);
     }
   }

   runMyHarness();
   ```

2. **Add npm script** to `package.json`:
   ```json
   {
     "scripts": {
       "harness:my-task": "npx ts-node scripts/my-harness.ts"
     }
   }
   ```

3. **Run it**:
   ```bash
   npm run harness:my-task
   ```

## Harness Ideas for ConvoLab

Here are some useful harnesses you could create:

### Daily Maintenance Harness
```bash
npm run harness:maintenance
```
- Run all tests and fix failures
- Check for TypeScript errors
- Update CHANGELOG.md
- Commit changes

### PR Review Harness
```bash
npm run harness:review-pr 123
```
- Review PR for security issues
- Check test coverage
- Verify performance impact
- Comment on findings

### Security Audit Harness
```bash
npm run harness:security
```
- Scan for common vulnerabilities
- Check dependency security
- Review authentication flows
- Generate security report

### Performance Check Harness
```bash
npm run harness:performance
```
- Profile API response times
- Check database query efficiency
- Identify N+1 queries
- Suggest optimizations

## Scheduling Harnesses

### Option 1: Cron Jobs
Run harnesses on a schedule using cron:

```bash
# Edit crontab
crontab -e

# Add daily i18n check at 2 AM
0 2 * * * cd /Users/andrewlandry/source/convo-lab && npm run harness:i18n >> /tmp/i18n-harness.log 2>&1
```

### Option 2: GitHub Actions
Create `.github/workflows/harness.yml`:

```yaml
name: Daily i18n Check

on:
  schedule:
    - cron: '0 2 * * *'  # 2 AM daily
  workflow_dispatch:  # Manual trigger

jobs:
  i18n-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm install
      - run: npm run harness:i18n
        env:
          CLAUDE_CODE_OAUTH_TOKEN: ${{ secrets.CLAUDE_OAUTH_TOKEN }}
```

### Option 3: Pre-commit Hook
Run harnesses before commits:

```bash
# .husky/pre-commit
npm run harness:i18n:dry-run
```

## Troubleshooting

### "OAuth authentication is currently not supported"
**Solution**: Ensure `CLAUDE_CODE_OAUTH_TOKEN` is set:
```bash
echo $CLAUDE_CODE_OAUTH_TOKEN
```

### "Module '@anthropic-ai/claude-agent-sdk' not found"
**Solution**: Install the SDK:
```bash
npm install --save-dev @anthropic-ai/claude-agent-sdk
```

### Harness hits max turns limit
**Solution**: Increase `maxTurns` in the harness script:
```typescript
maxTurns: 100  // Increase as needed
```

### Rate limit exceeded
**Solution**:
- Wait for your rate limit to reset (check every 5 hours)
- Reduce harness frequency
- Use dry-run mode more often

## Best Practices

1. **Start with dry runs** - Always test with `--dry-run` first
2. **Monitor turn usage** - Watch the "Total messages" count
3. **Use specific prompts** - Clear, detailed instructions work best
4. **Limit tool access** - Only grant necessary tools
5. **Review changes** - Check commits made by harnesses
6. **Set appropriate maxTurns** - Balance thoroughness vs. cost
7. **Use acceptance mode carefully** - `acceptEdits` auto-approves changes

## Security Notes

- ⚠️ **Never share your OAuth token** - It provides full account access
- ⚠️ **Review harness changes** - Always verify commits
- ⚠️ **Use restrictive permissions** - Limit tools and file access
- ⚠️ **Rotate tokens periodically** - Regenerate tokens every few months
- ⚠️ **Don't commit tokens** - Keep them in environment variables only

## Resources

- [Claude Agent SDK Documentation](https://platform.claude.com/docs/en/agent-sdk/overview.md)
- [Claude Code Documentation](https://code.claude.com/docs)
- [ConvoLab Project Guidelines](./CLAUDE.md)

## Support

For questions or issues with harnesses:
1. Check this documentation
2. Review harness logs in terminal output
3. Test with `--dry-run` mode first
4. Report issues at https://github.com/anthropics/claude-code/issues
