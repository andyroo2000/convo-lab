# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Unreleased

### Added

- **[feat]** Admin Script Lab — step-by-step course generation debugging workflow for admins; splits the monolithic pipeline into inspectable stages (prompt preview/edit, dialogue extraction, script generation, audio assembly) with the ability to re-run any step
- **[feat]** Editable script generation configuration in Admin Script Lab — exposes all timing parameters, AI prompts, and narration templates for tweaking pause durations, scenario generation, and teaching phrasing
- **[test]** Unit tests for phraseContext propagation through batching pipeline — verifies phraseContext is correctly preserved when grouping TTS units and handled properly with/without reading fields

### Changed

- **[refactor]** Improved phraseContext batch logic robustness — now handles edge cases where multi-unit batches may have mixed contexts; warns when only partial contexts present and consistently uses first unit's context
- **[docs]** Added JSDoc documentation for phraseContext field — explains usage, ElevenLabs-only behavior, and provides examples for pronunciation disambiguation
- **[docs]** Added inline comments clarifying provider-specific phraseContext behavior — notes that Google Cloud and AWS Polly don't use this field

### Fixed

- **[fix]** Extract vocabulary readings from parent exchange context for accurate TTS pronunciation — vocabulary words spoken in isolation now use readings extracted from the parent sentence's furigana to prevent ElevenLabs from using wrong readings or Chinese pronunciations
- **[fix]** ES module `__dirname` issue preventing vocab/grammar seeding in production — switched to `import.meta.url` with `fileURLToPath` for ES module compatibility
- **[fix]** Include vocabulary/grammar seed JSON files in Docker production image — files were missing from `dist/` because TypeScript doesn't copy non-TS files, causing JLPT vocabulary and grammar seeds to silently fail for all courses

- **[fix]** Force per-unit ElevenLabs synthesis for all Japanese (not just slowed) — kanji/mixed-script alignment data is unreliable, causing batched audio segments to bleed into adjacent turns; each Japanese turn now gets its own API call for clean segment boundaries
- **[fix]** Generate silence with ffmpeg instead of Google Cloud TTS — eliminates format mismatch (sample rate, encoding params) between silence segments and ElevenLabs speech that caused audio cutoffs and glitches at segment boundaries during concat
- **[fix]** Two-pass audio concatenation (PCM decode then MP3 encode) — prevents MP3 frame boundary artifacts that caused mid-syllable cutoffs when stitching per-unit audio segments together
- **[test]** Added `scripts/test-elevenlabs-segmentation.ts` — standalone script to generate and compare per-unit vs batched Japanese audio with API response caching

### Added

- **[feat]** Add Hiro as Japanese ElevenLabs voice option
- **[feat]** Default L2 speaker voices for Japanese courses (Otani + Hiro) — no longer randomly picks voices when none specified at course creation

### Changed

- **[chore]** Inject ELEVENLABS_API_KEY in deploy workflow — prevents key loss when `git reset --hard` overwrites `.env.production`
- **[fix]** Remove slow-speed L2 repetitions from conversational lessons — slow versions (0.75x) were getting cut off during audio stitching; replaced with normal-speed repetitions to maintain the same drill count without audio artifacts

### Fixed

- **[fix]** Chunk loading errors after deployments — added proper cache headers to prevent service worker from caching stale references to old chunk files; Express now sets `no-cache` on index.html/service worker/manifest, caches hashed assets immutably, and uses `NetworkFirst` strategy for JS/CSS chunks; added global error handler and ErrorBoundary logic to detect chunk loading failures and prompt hard reload
- **[fix]** Type-safety harness skips already-closed cards — checks beads DB status before spawning sessions so completed work isn't re-processed
- **[fix]** Type-safety harness post-session verification — harness now verifies files are actually clean (0 `any` types) after a session reports success, and directly closes beads cards via SQLite if the Claude session failed to; iterator exhaustion no longer optimistically returns success
- **[chore]** Closed 28 completed type-safety cards that had 0 `any` types remaining but were never closed by harness sessions

### Added

- **[chore]** Type safety harness (`scripts/type-safety-harness.ts`) — autonomous Claude Agent SDK harness that removes `any` types from 86 files in parallel; two-pass strategy (Sonnet first, Opus auto-retry for failures); beads integration for card coordination (claim/close/revert); supports `--concurrency`, `--category`, `--file`, `--no-retry`, `--dry-run` flags; created 86 beads chore cards under epic `convo-lab-7oj` tracking 314 `any` occurrences across the codebase

### Fixed

- **[fix]** Kanban board not showing latest beads updates — SQLite `readonly` mode can't read uncommitted WAL changes; switched to `query_only` pragma so live updates reflect immediately
- **[fix]** Fixed deploy health check failure caused by incorrect table name in japanese_only_cleanup migration — `"FeatureFlag"` should be `"feature_flags"` (Prisma `@@map`); also added `prisma migrate resolve --rolled-back` to Dockerfile CMD to recover from failed migration state in production

### Changed

- **[chore]** Track `tools/kanban/package-lock.json` for reproducible dependency installs

### Added

- **[feat]** Beads Kanban Board — standalone dev tool (`tools/kanban/`) that reads from `.beads/beads.db` (SQLite) and serves a live Kanban board at `localhost:3333`; 4-column layout (Open/In Progress/Blocked/Closed) with real-time SSE updates via chokidar file watching; click any card for a detail modal showing description, design, acceptance criteria, notes, parent/child relationships; run with `npm run kanban`

### Removed

- **[refactor]** Removed Narrow Listening feature entirely — deleted 17 standalone files (services, routes, jobs, pages, tests, i18n locales), cleaned up all references across server entry points, client routing, library/create/admin/settings pages, hooks, i18n configs, feature flags, usage tracking, utility scripts, and tests; Prisma schema models retained with DEPRECATED comments (no database migration); 58 test files, 1086 tests passing
- **[refactor]** Removed ChunkPack (Lexical Chunks) and Processing Instruction features entirely — deleted 34+ standalone files (services, routes, jobs, types, pages, tests, i18n locales), cleaned up all references across server entry points, client routing, library/create/admin/settings pages, hooks, i18n configs, feature flags, usage tracking, utility scripts, and tests; Prisma schema models and columns retained with DEPRECATED comments (no database migration); all 1175 server tests pass

### Fixed

- **[fix]** Google OAuth refresh token not being returned - added `accessType: 'offline'` and `prompt: 'consent'` parameters to OAuth configuration; without offline access mode, Google only returns access tokens and never sends refresh tokens, causing sync failures after the initial authentication expires

### Added

- **[feat]** OAuth token refresh infrastructure - implemented full token refresh support per Claude bot review: added `refreshGoogleToken()` and `getValidAccessToken()` services to refresh expired tokens, `/disconnect/google` endpoint for token revocation, googleapis dependency for OAuth2 client; includes unit tests for OAuth service

### Changed

- **[ux]** Google OAuth prompt changed from `consent` to `select_account` - users now see a simpler account picker instead of full consent screen on every login, while still getting refresh tokens on first auth
- **[fix]** OAuth token expiresAt calculation corrected - was incorrectly using ID token expiry (often null), now properly sets 1-hour expiry matching Google access token lifetime

### Fixed

- **[fix]** Google OAuth refresh token not being returned - added `accessType: 'offline'` and `prompt: 'consent'` parameters to OAuth configuration; without offline access mode, Google only returns access tokens and never sends refresh tokens, causing sync failures after the initial authentication expires

### Added

- **[feat]** Full UI impersonation support with useEffectiveUser hook - when admins impersonate users via the viewAs parameter, the entire UI now reflects the impersonated user's preferences including language preferences (study language, native language), form defaults (course generator, narrow listening), navigation language indicator, and user avatar/name/display info; created useEffectiveUser hook that fetches impersonated user data and provides effectiveUser for UI personalization while keeping useAuth() for authentication/authorization logic
- **[feat]** Admin impersonation preserved across content creation workflow - admins can now create content for users while impersonating them; viewAs query parameter is maintained through all navigation paths including: library empty states → create page → content type forms → API calls → success navigation; enables admins to generate dialogues, audio courses, narrow listening packs, processing instruction sessions, and lexical chunk packs on behalf of users without losing impersonation context
- **[chore]** Diagnostic scripts for debugging content generation - added 34 utility scripts for monitoring and managing content generation: check-\*-queue.ts (queue status monitoring), delete-course.ts (safe course deletion), trigger-episode-audio.ts (manual audio generation), find-yuriy-courses.ts, get-course-details.ts, list-all-users.ts, and various user/content inspection utilities

### Fixed

- **[fix]** Audio splitting performance with zero-duration segment handling - combined working full parallelization (6 seconds for 82 segments) with validation logic to gracefully handle zero-duration segments; when timing correction causes mark overlap, falls back to uncorrected times instead of failing; maintains parallel extraction performance while preventing crashes from invalid segment durations
- **[fix]** Audio splitting performance regression from validation logic - reverted segment duration validation that caused 13+ minute stalls in jobs 175 and 176; restored working full parallelization approach from job 174 that completed 81 segments in 29 seconds; the validation logic, while preventing zero-duration errors, inadvertently reintroduced sequential processing behavior
- **[fix]** Batched TTS audio clipping fixed with timing correction - resolved issue where speech was cut off at segment boundaries in batched audio courses; Google TTS mark timepoints don't precisely align with actual speech timing (consistently 0.5-1.5 seconds late due to processing latency), causing splits to cut into words; now applies -0.7 second timing correction to compensate for mark delay; eliminates clipping while maintaining batching optimization that reduces API calls by 99%; optimized from initial silence detection approach which was too slow

### Improved

- **[perf]** Audio course generation performance optimization - parallelized audio segment extraction using Promise.all() to process all ffmpeg operations concurrently instead of sequentially; eliminates 13+ minute stalls when splitting large batches (83 segments × 10s each = 830s); combined with timing correction offset to fix both clipping accuracy and performance
- **[fix]** Course page crash when accessing undefined script unit - added null check before accessing unit.type property to prevent "Cannot read properties of undefined (reading 'type')" error; handles edge case where timing data references script units that don't exist at the expected index
- **[fix]** Admin impersonation lost during course status polling - fixed bug where viewAs parameter was not passed to course status endpoint during generation polling; admins now stay in impersonation mode when viewing generating courses; resolves "something went wrong" error when admins try to monitor course generation while impersonating users
- **[fix]** Audio course duration accuracy and batching consistency - corrected estimatedSecondsPerExchange from 35s to 90s to accurately reflect actual course length (previous estimate caused 30-minute courses to generate as 79 minutes, 2.7x longer than requested); aligned course batching with dialogue batching by placing SSML marks BEFORE text instead of AFTER to prevent timing drift accumulation in long batches and ensure audio segments are split correctly at the START of each unit; resolves audio splitting issues where speech was being cut off at segment boundaries
- **[fix]** Impersonated user avatar and info now shown in UserMenu - fixed bug where admin's avatar was displayed instead of the impersonated user's when using view-as mode; UserMenu now correctly shows the impersonated user's avatar, name, and role; "Viewing as" overlay badge now persists across all pages (Library, Create, etc.) as long as viewAs parameter is present
- **[fix]** Admin impersonation lost when clicking navigation links - fixed critical bug where viewAs query parameter was not preserved in Layout navigation links (logo, Library, Create buttons); admins would lose impersonation context when clicking any nav link; all navigation now preserves viewAs parameter; added visual "Viewing as: [name]" indicator badge in header to clearly show active impersonation; fetches and displays impersonated user's name for admin clarity
- **[fix]** Google TTS language code mismatch causing audio generation failures - fixed issue where 2-letter language codes (e.g., "fr") didn't match Google TTS voice format requirements (e.g., "fr-FR"); now extract full language code directly from voice ID ("fr-FR-Neural2-A" → "fr-FR") to ensure API compatibility; resolves "Requested language code doesn't match voice's language code" errors that blocked audio generation for French and other non-English content
- **[fix]** Admin impersonation now works across all content pages - fixed bug where viewAs query parameter was not preserved when navigating from library to playback/course pages; all content pages now properly read and pass viewAsUserId to API calls

### Improved

- **[perf]** Audio course generation performance dramatically improved by properly optimizing TTS batching - fixed root cause where alternating narrator/speaker voices created excessive batches; now all units with same voice/speed/language are grouped together regardless of script position; reduced TTS API calls by 99% from 534 to 3-5 batches per 30-minute course; course generation time reduced from 21+ hours to 15-30 minutes; added admin utility scripts kill-active-course-jobs.ts and reset-course-status.ts for managing course generation
- **[chore]** Fixed 61 ESLint errors across client codebase - eliminated all 57 errors including unused eslint-disable directives (10), nested ternaries (7), testing-library violations (20), await-in-loop patterns (7), promise executor returns (4), continue statements (2), restricted syntax (2), consistent-return (1), and restricted-globals (1); remaining 91 warnings are all @typescript-eslint/no-explicit-any types flagged for future type improvement

### Added

- **[chore]** Utility script for fixing common furigana errors in Japanese dialogues - added fix-furigana-errors.ts script to correct misreadings like この前[ぜん]→この前[まえ], 何[なん]→何[なに] before particles, 私[わたくし]→私[わたし], and other common mistakes; supports filtering by user ID and provides detailed fix reporting

- **[chore]** Production data migration scripts - added three migration scripts to sync local sample content to production database: migrate-sample-courses.ts (migrates 29 sample audio courses), sync-avatar-urls.ts (syncs speaker avatar URLs for sample dialogues), and sync-arabic-avatars.ts (syncs Arabic speaker avatars by name matching); successfully migrated 5 new sample courses and 20 Arabic speaker avatars to production, avoiding the need to regenerate audio and images

### Fixed

- **[fix]** TTS batched audio cutting off speech at segment boundaries - fixed critical bug where SSML marks were placed BEFORE text instead of AFTER, causing speech to be truncated when splitting batched audio at mark timepoints; marks now correctly fire after speech completes, ensuring full audio capture without cutting off words mid-speech; updated splitting logic to extract segments from previous mark to current mark; resolves audio quality issues in batched course generation
- **[fix]** TTS batch size limit causing API failures - added byte limit checking to prevent batches from exceeding Google's 5000 byte SSML limit; batches now automatically split into 4800-byte chunks when needed while preserving voice properties and original indices for correct reassembly; prevents "input.ssml is longer than the limit" errors during course generation
- **[fix]** Client error display bug showing "[object Object]" instead of actual error messages - fixed CourseGenerator and other components to properly extract error messages from nested API response format ({ error: { message } }); users now see helpful messages like "Please verify your email..." instead of confusing error objects
- **[fix]** Production signup "failed to fetch" error with async email queue - resolved issue where users saw network errors despite successful account creation by making verification email sending asynchronous via BullMQ; implemented idempotent signup to handle retry scenarios gracefully (users can retry without "already exists" errors); added comprehensive [SIGNUP] logging for monitoring; added slow request tracking (>5s for signup, >2s for others); improved client error messaging for network failures; signup responses now complete in <2s with email queued in background with 3 automatic retries

### Added

- **[chore]** Admin tools for user email verification management - added 9 utility scripts for debugging and managing users: verify-user-email.ts (manually verify emails), resend-verification-email.ts (resend verification emails), get-verification-link.ts (get verification links), find-unverified-users.ts (find users needing verification), check-user-courses.ts (view user courses), trigger-course-generation.ts (manually trigger generation), check-course-user.ts (get course details), check-db-connection.ts (verify database), find-recent-courses.ts (find recent courses)
- **[fix]** TypeScript compilation errors and ESLint warnings - resolved type errors in courseQueue.ts (Prisma JsonValue casting), auth.ts (proper types for Prisma updates, Express user, JWT payload), and audioExtractorService.ts (removed unused interface, proper type casting); added appropriate eslint-disable comments for necessary console logging; fixed checkGenerationLimit call to include contentType parameter; updated test expectations for isSampleContent field; added test credentials to server/.env.example

### Changed

- **[style]** Restored font sizes to pre-flashcard styling - reverted Japanese text (2.5rem → 1.5rem, weight 600 → 500) and Chinese text (2.5rem → 2.25rem, weight 600 → 500) to original sizes that existed before flashcard feature; the flashcard feature had increased font sizes for card display but unintentionally affected text rendering throughout the entire application
- **[chore]** Code cleanup and environment documentation - removed development console.log statements from client components (AvatarCropperModal, ChunkPackExamplesPage, NarrowListeningCreatorPage, PISessionPage, PlaybackPage); added comprehensive .env.example for client with Stripe and API configuration; expanded server .env.example with all required variables (OAuth, email, AWS, Stripe, admin emails, worker config); updated README with detailed PWA usage instructions including iOS and Android installation steps, offline support details, and service worker caching configuration

### Removed

- **[refactor]** Complete removal of flashcard/SRS feature - removed all flashcard and spaced repetition system functionality including ReviewPage, DeckEditorPage, flashcard components, SRS routes and service, Deck/Card/Review database models, and flashcardsEnabled feature flag; this simplifies the application by ~4,700 lines of code and speeds up audio course generation by eliminating flashcard audio synthesis

### Added

- **[feat]** Progressive Web App (PWA) implementation with offline support - configured VitePWA plugin with service worker and web app manifest; generated PWA icons (192x192, 512x512, apple-touch-icon); created PWAInstallPrompt component with platform-specific install flows for iOS Safari and Android/Chrome; implemented Workbox runtime caching strategies for fonts, API calls (5-minute cache), and audio files (30-day cache); added PWA meta tags for standalone app mode with theme color and viewport-fit configuration
- **[feat]** Mobile touch target optimization for 44px accessibility standard - increased navigation buttons height from 36px to 44px on mobile devices; enlarged user menu button to 44px minimum with proper padding; adjusted library filter buttons vertical padding to achieve 44px height; resized audio player controls (play/pause and repeat buttons) from 40px to 44px for easier tapping
- **[feat]** Sample content onboarding with guided user experience - created SampleContentGuide component to welcome new users and highlight pre-generated content with sample badges; added CustomContentGuide component explaining how to create personalized dialogues and courses; implemented ProtectedByFeatureFlag wrapper component for feature-gated routes; added database migrations for seenSampleContentGuide and seenCustomContentGuide user tracking fields
- **[feat]** Flashcards feature flag for phased rollout - added flashcardsEnabled flag to FeatureFlags database table; updated feature flag hooks and contexts to support new flag; integrated feature flag checks in navigation and route protection
- **[test]** Comprehensive upgrade prompt test coverage for all content creation flows (24 tests total across DialogueGenerator, CourseGenerator, NarrowListeningCreatorPage, PISetupPage, and ChunkPackSetupPage)
- **[feat]** Upgrade prompts when quota limits reached - implemented modal prompts that automatically appear when users hit their generation quotas; integrated into dialogue and course generators; captures quota metadata (used, limit, resetsAt) from 429 error responses; free tier users see lifetime limit messaging with upgrade CTA; paid tier users see monthly reset info; includes e2e test infrastructure improvements (seed script, port fixes, dotenv config)
- **[test]** Updated quota-system e2e tests for tier-based quotas - modified e2e tests to reflect new tier-based quota system with lifetime per-content-type limits for free tier (2 dialogues) instead of weekly limits; updated test assertions to use flexible regex patterns instead of hardcoded values; skipped tests not applicable to free tier (80-89% usage range, quota reset dates); updated error message assertions from "Weekly quota exceeded" to "Quota exceeded"
- **[feat]** Tier-based quota system with lifetime and monthly limits - implemented differentiated quota system for free and paid tiers; free tier has lifetime per-content-type limits (2 dialogues + 1 audio course); paid tier has 30 generations per month combined across all content types; admin users have unlimited access; converted rateLimitGeneration to factory function accepting contentType parameter; updated all route handlers to use new factory pattern; added 39 comprehensive unit tests for quota system; updated integration tests for new quota behavior; updated error messages to be tier-agnostic
- **[feat]** Monthly date utilities for paid tier quota management - added getMonthStart and getNextMonthStart functions to support monthly quota cycle (30 generations per month, resetting on 1st of each month); functions handle month boundaries, year transitions, leap years, and all edge cases; added 26 comprehensive tests covering mid-month scenarios, year boundaries, leap years, and all 12 months validation
- **[feat]** MVP UX improvements for pricing and language selection - replaced "Native Language" with "Primary Language" throughout UI (onboarding and settings); removed country flags from language selection in favor of text-only names (e.g., "Japanese", "Spanish") for a more inclusive design; updated all pricing displays to reflect $10/month with 30 generations per month for paid tier and "2 dialogues + 1 audio course (lifetime)" for free tier; changed quota reset messaging from weekly to monthly cycles
- **[docs]** MVP content topics and pricing decisions - finalized 3 dialogue topics (Meeting Someone New, At a Café/Restaurant, Making Weekend Plans) and 1 audio course topic (Travel & Transportation) for pre-generated sample content; set paid tier pricing at $10/month with 30 items per month; defined free tier limits (2 dialogues + 1 audio course lifetime); decided to replace "native language" terminology with "Primary Language" and remove country flags in favor of language names only
- **[chore]** Beads issue tracking system for MVP planning - initialized Beads as a persistent, git-backed issue tracker for managing the MVP launch roadmap; setup includes global npm installation, git hooks for automatic JSONL sync, MCP server integration with Claude Code, AGENTS.md workflow documentation, and .gitattributes for smart merging; created initial MVP roadmap with 23 tasks organized into 7 epics (pre-generated sample content, onboarding UX improvements, user guidance pulse points, free vs paid tier definition, flashcard improvements, analytics tracking, and final polish)
- **[feat]** Full sentence furigana support for SRS flashcards - flashcards now display furigana for entire sentences instead of just the target vocabulary word, improving reading comprehension and context understanding; added furiganaService using kuroshiro library for automatic furigana generation; implemented smart sentence parsing logic to correctly extract and render vocabulary words with split furigana annotations (e.g., 予[よ]定[てい]); created backfill script for existing cards; added comprehensive FlashCard test coverage; changed English translation toggle default to off for better learning flow; fixed CurrentTextDisplay container height jumping issue
