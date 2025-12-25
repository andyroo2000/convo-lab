#!/usr/bin/env ts-node
/**
 * Mobile Optimization Harness for ConvoLab
 *
 * Autonomously audits and optimizes mobile experience:
 * - Mobile responsiveness (viewport, breakpoints)
 * - Touch targets and gestures
 * - PWA features (manifest, service worker)
 * - Mobile performance
 * - Mobile-specific UX
 * - Offline functionality
 * - App-like experience
 *
 * Usage:
 *   npm run harness:mobile                             # Full mobile audit (200 turns)
 *   npm run harness:mobile -- --dry-run                # Report only, no changes
 *   npm run harness:mobile -- --max-turns 300          # Custom max turns
 *   npm run harness:mobile -- --responsive-only        # Only check responsiveness
 */

import { query } from '@anthropic-ai/claude-agent-sdk';

interface MobileHarnessOptions {
  dryRun?: boolean;
  maxTurns?: number;
  verbose?: boolean;
  responsiveOnly?: boolean; // Only focus on responsive design
}

const DEFAULT_MAX_TURNS = 50000;

async function runMobileHarness(options: MobileHarnessOptions = {}) {
  const {
    dryRun = false,
    maxTurns = DEFAULT_MAX_TURNS,
    verbose = true,
    responsiveOnly = false,
  } = options;

  console.log('📱 ConvoLab Mobile Optimization Harness');
  console.log('═══════════════════════════════════════════\n');

  if (dryRun) {
    console.log('🔍 Running in DRY RUN mode (analysis only)\n');
  }

  console.log(`⚙️  Max turns: ${maxTurns}`);
  console.log(
    `🎯 Mode: ${responsiveOnly ? 'Responsive design only' : 'Full mobile optimization'}\n`
  );

  console.log('Starting mobile audit...\n');

  const prompt = `
You are running an autonomous mobile optimization harness for ConvoLab.

## Your Mission

${
  responsiveOnly
    ? `
### Responsive Design Only

1. Review viewport meta tag
2. Check CSS breakpoints and media queries
3. Test layouts at mobile sizes (320px, 375px, 414px)
4. Verify no horizontal scroll
5. Check touch target sizes
6. Fix responsive issues
7. Commit with /commit
`
    : `
## Complete Mobile Optimization Workflow

### PHASE 1: Viewport & Meta Tags
1. Check viewport meta tag:
   - Verify <meta name="viewport"> exists
   - Check for proper settings (width=device-width, initial-scale=1)
   - Ensure no user-scalable=no (accessibility issue)
2. Review other mobile meta tags:
   - theme-color for browser chrome
   - apple-mobile-web-app-capable
   - apple-mobile-web-app-status-bar-style
3. Check favicon and app icons:
   - Apple touch icons (180x180, 152x152, 120x120)
   - Android icons (192x192, 512x512)
   - Favicon (16x16, 32x32)
4. Fix missing meta tags and icons

### PHASE 2: Responsive Design
1. Review CSS breakpoints:
   - Check Tailwind breakpoints (sm, md, lg, xl, 2xl)
   - Verify mobile-first approach
   - Check for custom media queries
2. Test layouts at mobile sizes:
   - 320px (iPhone SE)
   - 375px (iPhone standard)
   - 414px (iPhone Plus)
   - 768px (iPad portrait)
3. Check responsive patterns:
   - Navigation collapses to hamburger menu
   - Tables become scrollable or stacked
   - Multi-column layouts stack on mobile
   - Images scale appropriately
4. Verify no horizontal scroll:
   - No fixed-width elements
   - Images have max-width: 100%
   - Container widths are responsive
5. Fix responsive layout issues

### PHASE 3: Touch Targets & Gestures
1. Review touch target sizes:
   - Minimum 44x44px (Apple guideline)
   - Minimum 48x48px (Android guideline)
   - Check buttons, links, form inputs
2. Check touch target spacing:
   - Adequate spacing between targets (8px minimum)
   - No overlapping clickable areas
   - Easy to tap without mistakes
3. Review mobile gestures:
   - Swipe gestures (if any) have alternatives
   - Pinch-to-zoom is allowed (accessibility)
   - No required multi-finger gestures
4. Check mobile interactions:
   - Hover states have mobile alternatives
   - Tooltips work on touch
   - Dropdowns work on mobile
   - Modals are mobile-friendly
5. Fix touch target issues

### PHASE 4: Mobile Navigation
1. Review navigation patterns:
   - Hamburger menu implementation
   - Bottom navigation (if applicable)
   - Breadcrumbs on mobile
2. Check mobile menu:
   - Opens smoothly
   - Covers full screen or slides from side
   - Close button is easy to tap
   - Links are well-spaced
   - Scrollable if needed
3. Review navigation accessibility:
   - Keyboard accessible
   - Screen reader friendly
   - Focus management
4. Fix mobile navigation issues

### PHASE 5: Forms on Mobile
1. Review form inputs:
   - Input types are appropriate (email, tel, number, etc.)
   - Input sizes are large enough (min 16px font)
   - Labels are visible
   - Placeholders don't replace labels
2. Check mobile keyboard:
   - Correct keyboard type appears (email, numeric, etc.)
   - Auto-capitalize is appropriate
   - Auto-correct is appropriate
3. Review form layout:
   - Single column layout
   - Adequate spacing between fields
   - Submit button is easy to tap
   - Error messages are visible
4. Check form validation:
   - Inline validation works on mobile
   - Error messages don't break layout
   - Success feedback is visible
5. Fix form mobile issues

### PHASE 6: PWA Features
1. Check PWA manifest:
   - manifest.json exists
   - Name and short_name set
   - Icons specified (192x192, 512x512)
   - theme_color and background_color set
   - display mode set (standalone, minimal-ui)
   - start_url specified
2. Review service worker:
   - Service worker registered
   - Caching strategy implemented
   - Offline fallback page
   - Update notification
3. Check install prompt:
   - Add to Home Screen works
   - Install banner appears (if desired)
   - Custom install UI (optional)
4. Test offline functionality:
   - App shell loads offline
   - Cached content works
   - Offline indicator shown
   - Queue actions for when online
5. Implement missing PWA features

### PHASE 7: Mobile Performance
1. Review page load performance:
   - First Contentful Paint < 1.8s
   - Largest Contentful Paint < 2.5s
   - Time to Interactive < 3.8s
2. Check mobile-specific optimizations:
   - Images are optimized (WebP, proper sizing)
   - Lazy loading for images
   - Code splitting for routes
   - Minimal JavaScript on initial load
3. Review network usage:
   - API responses are cached
   - Images use srcset for responsive images
   - Videos don't autoplay on mobile
   - Minimize data usage
4. Check battery usage:
   - No infinite loops or polling
   - Animations use CSS (not JS)
   - RequestAnimationFrame for animations
5. Fix mobile performance issues

### PHASE 8: Mobile-Specific UX
1. Review text readability:
   - Font sizes >= 16px for body text
   - Line height is comfortable (1.5-1.6)
   - Line length is appropriate
   - Contrast is sufficient
2. Check scrolling behavior:
   - Smooth scrolling
   - No scroll jank
   - Sticky elements work on mobile
   - Infinite scroll works smoothly (if used)
3. Review mobile patterns:
   - Pull-to-refresh (if applicable)
   - Swipe to delete (if applicable)
   - Bottom sheet modals
   - Toast notifications
4. Check orientation:
   - Works in portrait and landscape
   - Layout adapts to orientation change
   - No rotation lock unless necessary
5. Fix mobile UX issues

### PHASE 9: Testing & Validation
1. Test on real devices (if possible):
   - iPhone (iOS Safari)
   - Android (Chrome)
   - Check for device-specific issues
2. Use browser DevTools:
   - Chrome DevTools device mode
   - Test various screen sizes
   - Check touch emulation
3. Run Lighthouse mobile audit:
   - Performance score
   - Accessibility score
   - Best Practices score
   - PWA score
4. Document mobile testing results

### PHASE 10: Report & Implement
${
  dryRun
    ? `
- List current mobile state
- Identify mobile issues
- Categorize by priority (critical, important, nice-to-have)
- Provide implementation recommendations
- No changes made
`
    : `
- Fix critical mobile issues first
- Implement responsive design improvements
- Add PWA features if missing
- Optimize mobile performance
- Update CHANGELOG.md with mobile improvements
- Use /commit with detailed mobile optimization message
`
}
`
}

## Mobile Optimization Guidelines

### Responsive Breakpoints
- **xs**: < 640px (mobile)
- **sm**: >= 640px (large mobile)
- **md**: >= 768px (tablet)
- **lg**: >= 1024px (desktop)
- **xl**: >= 1280px (large desktop)
- **2xl**: >= 1536px (extra large)

### Mobile-First Approach
Write CSS for mobile first, then add media queries for larger screens:
\`\`\`css
/* Mobile first (default) */
.container {
  padding: 1rem;
}

/* Tablet and up */
@media (min-width: 768px) {
  .container {
    padding: 2rem;
  }
}
\`\`\`

### Touch Target Sizes
- Minimum: 44x44px (48x48px preferred)
- Spacing: 8px between targets
- Exceptions: inline text links can be smaller

### PWA Manifest Example
\`\`\`json
{
  "name": "ConvoLab",
  "short_name": "ConvoLab",
  "description": "Language learning platform",
  "start_url": "/",
  "display": "standalone",
  "theme_color": "#4F46E5",
  "background_color": "#FFFFFF",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
\`\`\`

### Mobile Performance Targets
- First Contentful Paint: < 1.8s
- Largest Contentful Paint: < 2.5s
- Time to Interactive: < 3.8s
- Total Blocking Time: < 200ms
- Cumulative Layout Shift: < 0.1

## Important Guidelines

${
  dryRun
    ? `
- DO NOT make any changes
- Only analyze mobile experience
- List mobile issues by priority
- Provide recommendations
- Document current state
`
    : `
- Fix responsive design issues first
- Ensure touch targets are adequate
- Add PWA features if missing
- Test on multiple screen sizes
- Document mobile optimizations
- Use /commit once at the end with all mobile improvements
`
}

- Mobile-first approach
- Test on real devices when possible
- Prioritize user experience
${!dryRun ? '- Only use /commit once at the end with all fixes' : ''}

## Session Completion Rules

You are in AUTONOMOUS MODE. This means:
- ✅ Complete ALL mobile optimization tasks automatically without stopping
- ✅ Move from Phase 1 → 2 → 3 → ... → 10 without asking
- ✅ Only create ONE commit at the very end
- ❌ Do NOT stop after completing a phase
- ❌ Do NOT ask "should I continue?"
- ❌ Do NOT create "Recommendations for Next Session"
- ❌ Do NOT provide suggestions for follow-up work
- ❌ Do NOT stop until all work complete OR you hit turn limit

If you find yourself thinking "let me stop here and suggest next steps", STOP THAT THOUGHT and continue working instead.

Begin your mobile audit now.
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
        systemPrompt: `You are a mobile optimization expert for ConvoLab.
Follow mobile-first principles. Prioritize user experience.
${dryRun ? 'This is a dry run - REPORT ONLY, make NO changes.' : 'Optimize for mobile and use /commit when done.'}`,
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
    console.log('✅ Mobile Optimization Complete');
    console.log('═══════════════════════════════════════════\n');
    console.log(`📊 Total messages: ${messageCount}`);
    console.log(`⏱️  Duration: ${durationMin} minutes (${durationHr} hours)`);
    console.log(
      `📝 Final status: ${lastMessage.substring(0, 100)}${lastMessage.length > 100 ? '...' : ''}`
    );

    if (dryRun) {
      console.log('\n💡 This was a dry run. To apply optimizations, run without --dry-run flag.');
    }
  } catch (error) {
    console.error('\n❌ Mobile optimization failed with error:');
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

const options: MobileHarnessOptions = {
  dryRun: args.includes('--dry-run'),
  verbose: !args.includes('--quiet'),
  responsiveOnly: args.includes('--responsive-only'),
  maxTurns: customMaxTurns,
};

// Run the harness
runMobileHarness(options).catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
