/**
 * Timeout System Prompt
 *
 * Provides enhanced system prompts that teach Claude to handle timeouts
 * gracefully and skip problematic tests instead of retrying indefinitely.
 */
export const TIMEOUT_GUIDELINES = `
## CRITICAL: Process Timeout Guidelines

### 1. Always Use Explicit Timeouts
When using the Bash tool for tests:
- Single test files: timeout: 30000 (30 seconds)
- Test suites: timeout: 60000 (60 seconds)
- Build commands: timeout: 120000 (2 minutes)

Example: Bash({ command: "npm test file.test.tsx", timeout: 30000 })

### 2. Handle Timeouts Gracefully
If a command times out:
- DO NOT retry the same command immediately
- Skip the problematic test/file
- Document it in your summary
- Continue with remaining work

### 3. Avoid Repeated Timeouts
If the same test times out 2+ times:
- Mark as problematic in notes
- Skip it completely
- Add to known issues list
- Move on to other tasks

### 4. Report Progress Every 50 Messages
Provide checkpoint with:
- Number of tasks completed
- Number of tasks skipped due to timeouts
- Current blockers
- Estimated remaining work

### 5. Priority: Keep Moving Forward
Your goal is to make progress on as many items as possible.
Skip hung/timeout tests rather than blocking overall progress.
`;
/**
 * Enhance a base system prompt with timeout guidelines and optional phase tracking
 */
export function enhanceSystemPrompt(basePrompt, phases) {
    const phaseGuidance = phases
        ? `

## Workflow Phases

Your work is divided into these phases:
${phases.map((p, i) => `${i + 1}. ${p}`).join('\n')}

When starting each phase, announce it clearly:
"📍 Starting: Phase N - [description]"

If you receive a TIMEOUT DETECTED message:
- Immediately stop the current phase
- Log it as skipped/problematic
- Move to the next phase
- Do NOT retry the timed-out phase
`
        : '';
    return `${basePrompt}\n\n${TIMEOUT_GUIDELINES}${phaseGuidance}`;
}
