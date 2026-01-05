# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Unreleased

### Added

- **[feat]** Full sentence context for SRS flashcards with highlighted vocabulary - flashcard backs now display complete sentences from course dialogue with the target vocabulary word highlighted in blue, providing crucial context for authentic usage; added sentenceL2 and sentenceReadingL2 fields to Card schema; card creation extracts full sentences from script units using sourceUnitIndex mapping; FlashCard component renders sentences with vocabulary highlighted in indigo color; supports furigana/pinyin display for entire sentences when reading toggle is enabled; maintains backward compatibility (shows vocabulary word only if no sentence context available); flashcard audio now matches the complete sentence shown on card back for seamless audio-visual learning reinforcement

### Fixed

- **[fix]** Vocabulary extraction audio mapping from dialogue exchanges - improved audio course vocabulary extraction to map each vocabulary item to its source L2 script unit for proper audio extraction; now extracts vocabulary from dialogue exchanges (which contain the full vocabulary list from Gemini) instead of dialogue units; added logging for vocab-to-unit mapping success/failures and statistics about audio mappings

### Added

- **[feat]** Complete SRS (Spaced Repetition System) with FSRS algorithm - implemented comprehensive flashcard system with FSRS scheduling algorithm (ts-fsrs library), dual card types (Recognition L2→L1 and Audio audio→L2+L1), Anki-style 4-button rating (Again/Hard/Good/Easy), smart furigana/pinyin rendering with bracket notation, audio extraction from course dialogue units, deck editor with multi-select and bulk operations, and custom confirmation dialogs; added database models (Deck, Card, Review with FSRS state tracking), frontend pages (ReviewPage with 3D flip animation and auto-play audio, DeckEditorPage with search/edit/delete), backend services (srsService for scheduling, audioExtractorService for audio extraction), and API routes (/api/srs/\*); architecture redesigned to extract vocabulary FROM generated dialogue (not before) with sourceUnitIndex field linking CourseCoreItem to exact dialogue units for perfect text/audio/furigana alignment and direct audio extraction without fuzzy matching
- **[feat]** Comprehensive language data for Arabic, Spanish, and Chinese - added complete CEFR-aligned vocabulary and grammar data for Arabic (A1-C2), Spanish (A1-C2), and Chinese (HSK 1-6); Arabic includes Arabic script with transliterations and pronunciations; Chinese includes Hanzi with Pinyin and tone markings; Spanish includes comprehensive CEFR-leveled content; also added generator scripts (generate_spanish_data.py, smart_vocab_generator.cjs, add_pronunciations.cjs, French vocabulary generation utilities); expands ConvoLab from 2 languages to 5 languages with comprehensive learning materials across all proficiency levels
- **[feat]** Language seed harness and massive Japanese data expansion from GitHub sources - created autonomous language seed generation harness using Claude Agent SDK supporting Chinese (HSK 1-6), Spanish/French/Arabic (CEFR A1-C2); massively expanded Japanese vocabulary (N5: 30→718 words, N4: 50→666, N3: ~100→2,136, N2: ~150→1,905, N1: ~200→2,693) and grammar (N5: 30→173 patterns, N4: 30→159, N3: 30→167, N2: 30→234, N1: 30→300) by sourcing comprehensive GitHub datasets; added scripts/generate-language-seeds.ts harness, scripts/README-language-seeds.md documentation, progress tracking, npm run scripts, and initial Chinese HSK1 vocabulary/grammar files; follows successful pattern of using community-vetted GitHub datasets for comprehensive language resources

### Added

- **[feat]** Grammar pattern seeding for JLPT levels - created comprehensive grammar point files for all JLPT levels (N5-N1, 30 patterns each) with usage examples and translations; extended vocabularySeeding service with grammar functions (sampleGrammar, formatGrammarForPrompt); integrated grammar seeding into dialogue generation (samples 5 patterns, suggests using 2-3 naturally); improves level-appropriate grammar structure usage and pedagogical alignment with JLPT standards
- **[feat]** Improved narrow listening audio pacing and keyboard navigation - increased pause between sentences from 0.8s to 2s for better comprehension; added 3-second pause between sections (story variations) during auto-play; added left/right arrow keyboard navigation to jump between sentences (left arrow goes to beginning of current sentence, or previous sentence if already at beginning; right arrow goes to beginning of next sentence)
- **[build]** Added tsc-alias for TypeScript path alias resolution - installed tsc-alias to resolve path aliases (@languageflow/shared) in compiled output; added --ignore-scripts flag to npm install in Dockerfile to avoid postinstall issues; added npm rebuild in production stage for native dependencies; updated build command to run tsc-alias after TypeScript compilation
- **[feat]** Enhanced audio course generation with vocabulary filtering and multi-pass review - created vocabularySeeding service supporting JLPT (N5-N1), HSK (1-6), and CEFR (A1-C2) proficiency frameworks with level-appropriate word seeding; added 5 Japanese JLPT vocabulary files (~50 words each); created dialogueReviewer service for AI-powered quality review and editing; integrated multi-pass generation workflow (generate → review → edit if score < 7); vocabulary count reduced from ~197 to 40-60 words per 30-min course (75% reduction) through strict extraction criteria (1-2 KEY words per exchange) and stopword filtering (removes particles, copulas, ultra-common words)
- **[test]** Added mocks for vocabulary seeding and dialogue reviewer services - updated courseItemExtractor.test.ts with proper mocks for reviewDialogue, editDialogue, sampleVocabulary, formatWordsForPrompt, and getProficiencyFramework functions to support multi-pass generation testing
- **[test]** Expanded server test coverage to 71% branches (+1.21%) - added 40 comprehensive unit tests across 7 files including new emailTemplates.test.ts (35 tests for i18n email templates with XSS prevention) and admin.simple.test.ts (33 tests for admin routes); expanded errorHandler.test.ts (+9 tests for rate limit headers and metadata), ttsClient.test.ts (+11 tests for speech synthesis), geminiClient.test.ts (+5 tests for model parameters), roleAuth.test.ts (+2 tests for authentication), and courseQueue.test.ts (+1 test for audio progress); achieved 100% branch coverage on errorHandler.ts, roleAuth.ts, and geminiClient.ts; all 147 tests passing with comprehensive mocking of Prisma, Stripe, Gemini AI, and TTS providers
- **[chore]** Mobile optimization guide files for harnesses - created comprehensive guides in scripts/harness-guides/ for mobile development: pwa-checklist.md (complete PWA implementation guide with manifest, service worker, and offline support templates), responsive-patterns.md (Tailwind responsive design patterns and common fixes), and touch-target-fixes.md (touch target sizing guidelines and fix patterns); integrated guide references into mobile harness prompt

### Fixed

- **[fix]** ESLint errors in SRS components and course generation bug - fixed all ESLint compliance issues across SRS flashcard components (converted to arrow functions, added type="button" attributes, added keyboard handlers and ARIA labels, fixed nested ternaries, added useCallback hooks, fixed unescaped entities, added htmlFor attributes); fixed ReferenceError in course generation (allVocabItems → vocabularyItems); removed unused imports and added proper TypeScript types; disabled console linting in background job worker; updated all affected tests to match current implementation

### Changed

- **[feat]** Fixed speaker gender defaults - corrected speaker defaults in CourseCreator.tsx and CourseGenerator.tsx from both female to Speaker 1: male, Speaker 2: female for more natural voice variety

- **[chore]** Resilient harness wrapper with progress watchdog - added resilient-harness-wrapper.js with configurable progress watchdog (default 240-300s) to automatically detect and recover from stuck harnesses; integrated into i18n, mobile, monitoring, and test harnesses; added timeout-system-prompt.js to enhance prompts with timeout prevention instructions; added --watchdog-timeout and --disable-watchdog CLI flags; includes checkpoint logging every 50 messages and graceful shutdown with detailed logs; prevents harness timeouts and enables automatic recovery

- **[chore]** Improved maintenance harness phase ordering and efficiency - reordered maintenance phases to prevent pre-commit hook failures (moved linting from Phase 5 to Phase 3, before build); added auto-fix first strategy (npm run lint -- --fix before manual fixes) to handle most linting issues automatically; added linting to quick mode (Tests → Types → Lint → Build); added pre-commit hook awareness (tests only run for server file changes); improved efficiency guidance to prioritize auto-fix over manual fixes; new phase order (Tests → Types → Lint → Build → Deps → Other → Commit) ensures linting is clean before build, matching pre-commit hook requirements and preventing timeout issues
- **[chore]** Optimized pre-commit hook to only run tests for changed files - modified .husky/pre-commit to conditionally run server tests only when server files are staged; skips full test suite for client-only, documentation, or config changes; reduces commit time and prevents unnecessary test runs while maintaining code quality
- **[chore]** Daily maintenance pass - fixed critical TypeScript errors in client tests (ChineseText.test.tsx, ErrorBoundary.test.tsx, ImpersonationBanner.test.tsx - added missing beforeEach/afterEach imports, proper type annotations for mockUser pinyinDisplayMode); fixed type errors in components (CourseCreator.tsx - added missing TTS_VOICES import and voice parameter types, DialogueGenerator.tsx - added ProficiencyLevel type assertion, SegmentedPill.tsx - corrected default color values to match ColorScheme type, AvatarCropperModal.tsx - prefixed unused croppedArea parameter, UserMenu.tsx and CourseGenerator.tsx - commented out unused variables); added build script to shared package.json (tsc --noEmit) to fix workspace build; fixed linting issues (AdminPage.tsx - corrected eslint-disable directive); all 1335 tests passing, production build succeeds, no security vulnerabilities
- **[chore]** Daily maintenance pass - fixed TypeScript build errors in errorHandler.ts (proper type assertions for rate limit metadata), fixed client test type errors (added missing speakers field to CreateEpisodeRequest calls, fixed speaker objects missing id field), added vitest-env.d.ts for Testing Library matcher types, installed @types/uuid for server, added placeholder N2/N1 examples to piGenerator.ts JLPT level mapping; applied npm audit fix (resolved jws vulnerability); removed stale scripts/utils/format-duration.js file; all 1335 tests passing, production build succeeds

- **[chore]** Lint harness improvements with guide files and progress tracking - extracted all fix pattern examples from lint-harness.ts to separate markdown guide files (testing-library-fixes.md, accessibility-fixes.md, typescript-fixes.md, code-quality-fixes.md) in scripts/harness-guides/ directory; added JSON progress tracking artifact (/tmp/lint-todo.json) for real-time visibility into harness progress with file-by-file status tracking, category breakdowns, and fix/skip counts; improves maintainability and provides concrete enumeration of work remaining
- **[chore]** Allow context hook exports in react-refresh ESLint rule - configured `react-refresh/only-export-components` to explicitly allow `useAuth`, `useLocale`, and `useAudioPlayerContext` exports; these are intentional patterns for context files where the hook and provider are exported together; reduces ESLint warnings from 127 to 124
- **[chore]** Human-readable duration formatting for all harnesses - replaced technical duration format (e.g., "12.5 minutes (0.21 hours)") with natural language format (e.g., "12 minutes and 30 seconds" or "1 hour and 22 minutes") across all 9 harness scripts; added formatDuration utility function to scripts/utils/format-duration.ts for consistent formatting
- **[chore]** Make all harnesses fully autonomous - added explicit "Session Completion Rules" instructions to all 9 harness scripts (accessibility, i18n, lint, maintenance, mobile, monitoring, perf, security, test) to continue through ALL phases without stopping; prevents harnesses from providing "Recommendations for Next Session" and instead automatically continues through all phases; only stops when reaching turn limit or completing all work
- **[chore]** Increase harness max turns limit to 50000 - updated DEFAULT_MAX_TURNS across all autonomous harness scripts (accessibility, i18n, lint, maintenance, mobile, monitoring, perf, security, test) from varying limits (200-5000) to 50000 to allow more comprehensive automated fixes without hitting turn limits prematurely

### Added

- **[test]** Comprehensive integration tests for episodes route - added 27 new integration tests for episodes.ts route using supertest for full HTTP request/response testing; tests cover all endpoints (GET /, GET /:id, POST /, PATCH /:id, DELETE /:id), library mode vs full mode queries, pagination, error handling, demo user restrictions, and effective user ID resolution; improved coverage from 14.89% to 100%
- **[test]** Enhanced unit tests for storageClient module - expanded storageClient.test.ts with 16 additional test cases covering UploadOptions and UploadFileOptions interfaces, function signatures, GCS URL pattern validation, expected file path generation, and folder structures; validates type safety and API contracts for Google Cloud Storage integration
- **[chore]** Autonomous lint fixing harness with resilience utilities - added lint-harness.ts for autonomously fixing ESLint errors and warnings (Testing Library, TypeScript, accessibility, code quality); includes progress-watchdog.js for timeout detection, resilient-harness-wrapper.js for automatic recovery from failures, and timeout-system-prompt.js for enhanced error handling; supports targeted fixing (tests-only, a11y-only, typescript-only) and priority levels (critical/high/medium/all)
- **[test]** Minimum coverage thresholds enforced - added 80% coverage thresholds for lines, branches, functions, and statements across client and server workspaces; builds will fail if coverage drops below thresholds; ensures consistent code quality standards
- **[chore]** Automatic linting on pre-commit with lint-staged - added lint-staged configuration to run ESLint and Prettier on staged files before commits; updated pre-commit hook to run linting before tests; ensures code quality and consistent formatting across all commits
- **[chore]** Root TypeScript configuration and TTS provider types - added root-level tsconfig.json for workspace-wide TypeScript settings and type checking; created shared TTS provider types (TTSOptions, TTSProvider interface) for better type safety across Google and Polly TTS implementations
- **[chore]** Comprehensive ESLint configuration and formatting tools - added project-wide ESLint configuration with React, accessibility (jsx-a11y), and testing plugins (testing-library, vitest); created workspace-specific .eslintrc.json files for client, server, and shared; added Prettier configuration for consistent code formatting; added npm scripts for lint:fix, format, and format:check; applied automated fixes across 144+ files including arrow function conversions, self-closing JSX tags, import ordering, boolean prop simplification, and test utility hoisting; created 6 autonomous test harness scripts (accessibility, maintenance, mobile, monitoring, perf, security) for ongoing quality improvements
- **[test]** Autonomous test harness for comprehensive test improvement - added test-harness.ts script using Claude Agent SDK to autonomously improve test coverage by running tests, fixing failures, auditing coverage gaps, identifying missing test cases, writing new tests, and verifying everything passes; includes multiple run modes (full/fix-only/coverage-only/dry-run), configurable target coverage and max turns, progress tracking with periodic updates, and follows project testing patterns (Vitest, React Testing Library)
- **[i18n]** Complete translations for settings and UserMenu component - completed full translations for settings.json in Arabic, Spanish, French, and Chinese (replacing all [NEEDS_TRANSLATION] markers with proper natural translations); added i18n support to UserMenu component for Admin, Settings, and Logout menu items; created i18n-harness tool for automated translation consistency checking with npm scripts for easy validation

### Changed

- **[chore]** Set package type to ES module - added "type": "module" to root package.json to eliminate Node.js module type warnings when running harness scripts
- **[chore]** Additional ESLint fixes and code quality improvements - refined ESLint ignore patterns to exclude compiled TypeScript files and source maps; fixed project references in ESLint config; applied accessibility fixes across components (type="button" attributes, keyboard handlers, ARIA roles); improved test reliability by fixing hanging promises and timeout patterns; added ESLint disable comments for necessary rule violations; converted remaining function declarations to arrow functions; removed unused imports; replaced deprecated isNaN with Number.isNaN
- **[style]** Applied ESLint and Prettier formatting across entire codebase - automated formatting applied to 324 files across client, server, shared, scripts, and documentation; standardized indentation to 2 spaces, consistent spacing, import ordering, and code style conformance to project ESLint configuration

### Fixed

- **[i18n]** Translation consistency across all locales - fixed 309 missing translation keys and removed 21 obsolete keys across Arabic, Spanish, French, Japanese, and Chinese locales; added missing translations for modal dialogs, quota badges, demo mode, impersonation banners, error displays, library empty states, sidebar navigation, and settings color options; all translations now structurally consistent with English source files (keys marked with [NEEDS_TRANSLATION] prefix for future localization)

### Added

- **[feat]** Complete client and server i18n implementation - comprehensive internationalization for all user-facing text across both client and server; all UI components, pages, error messages, and server responses now use translation keys from centralized JSON locale files; created server.json with 89 translation keys covering auth errors, verification flows, rate limiting, validation, content management, and billing; updated all client components (ErrorDisplay, ImpersonationBanner, QuotaBadge, ConfirmModal, DemoRestrictionModal, LibraryPage, SettingsPage) and server routes (auth, billing, verification, audio, chunkPacks, courses, dialogue, episodes, images, narrowListening, pi) to use localized messages; establishes foundation for multi-language support throughout application

### Fixed

- **[test]** Stripe-related server test failures - fixed all 3 failing Stripe test files by correcting Stripe constructor mock using class syntax, adding missing requireAdmin export to roleAuth middleware mock, fixing error response assertions to check error.message, and fixing date serialization in subscription status test; all 1200 server tests now pass
- **[test]** DialogueGenerator i18n test failures - fixed all 16 failing tests by initializing i18n in test setup, creating custom render utility with I18nextProvider wrapper, fixing pluralization format in translation files, and removing outdated language selector tests; all 47 DialogueGenerator tests now pass

### Added

- **[feat]** Server-side i18n email templates - added i18next integration to server with email templates in 6 languages (English, Japanese, Chinese, Spanish, French, Arabic); refactored email service to use localized templates for all transactional emails including verification, password reset, welcome, subscription confirmations, and payment notifications
- **[feat]** Husky pre-commit hooks - automated test execution before commits to ensure code quality; includes 906 lines of new unit tests for Redis configuration, admin security, and worker trigger service
- **[i18n]** Pricing page translations - added complete pricing page content across all 6 supported languages with feature descriptions, CTAs, and tier comparisons
- **[feat]** i18n support with multilingual UI - implemented comprehensive internationalization infrastructure using i18next to support English, Japanese, Chinese, Spanish, French, and Arabic interfaces; all user-facing pages, components, and dialogs are now fully translatable with LocaleContext managing language preferences across the application
- **[i18n]** Complete translations for Spanish, French, Arabic, and Chinese - replaced English placeholder text with proper translations across all non-English locales for landing page, dialogue generator, audio courses, chunk packs, narrow listening, processing instruction, and 404 page content
- **[test]** Integration and security tests for quota and webhooks (1,559 lines) - comprehensive test coverage for quota system race conditions with concurrent request handling and Redis cooldown coordination, Stripe webhook handlers for subscription lifecycle and payment failures, email service token security with cryptographic token generation and one-time use verification, and date utilities for week boundary calculations and timezone handling
- **[feat]** 3-step onboarding with native language selection - redesigned onboarding flow to support multilingual users: (1) choose native language, (2) choose target language with automatic filtering, (3) select proficiency level; supports 6 languages (en, ja, zh, es, fr, ar) with smart conflict prevention
- **[feat]** English as a learnable target language - added English language support with 6 AI-generated speaker avatars (Vertex AI Imagen 3), 20 speaker names, and existing 8 Google Neural2 TTS voices with timestamp support
- **[feat]** Test user feature for safe production testing - allows admins to designate users as test users who can subscribe to a $0.01/month test tier, providing full pro features (30 generations/week) without large charges for testing subscription flows in production
- **[chore]** Avatar generation scripts for English speakers - utility scripts using Vertex AI Imagen 3 for generating photorealistic speaker avatars, serving as templates for future language additions
- **[chore]** Admin scripts for invite codes and subscription management (check-invites, create-invite, fix-landry-subscription, upgrade-to-pro)
- **[feat]** Comprehensive authentication system with email verification, Google OAuth integration, and password reset functionality
- **[feat]** Stripe subscription billing system with Pro tier, customer portal, and subscription management
- **[feat]** Admin dashboard subscription management with tier filters, status badges, and detailed subscription modals
- **[feat]** Admin endpoints for manual tier override and subscription cancellation
- **[feat]** Subscription columns in admin users table (Tier, Sub Status, Quota)
- **[feat]** Email verification flow with secure tokens and verification reminder in settings
- **[feat]** Google OAuth authentication via Passport.js with account linking
- **[feat]** Password reset flow with secure email tokens and expiration
- **[feat]** New pages: VerifyEmailPage, ForgotPasswordPage, ResetPasswordPage, ClaimInvitePage, PricingPage
- **[feat]** Billing management page in settings with upgrade and subscription portal access
- **[feat]** UpgradePrompt component for free tier feature limits
- **[feat]** Email service integration with Resend for transactional emails
- **[feat]** Subscription events audit logging for billing compliance
- **[feat]** Database models: EmailVerificationToken, PasswordResetToken, OAuthAccount, SubscriptionEvent
- **[feat]** User model fields: emailVerified, googleId, tier, Stripe subscription tracking

### Removed

- **[feat]** Hebrew language support - removed Hebrew from all type definitions, constants, TTS voices, and database with migration to clean up existing Hebrew references

### Fixed

- **[fix]** Stripe subscription metadata propagation - added subscription_data.metadata to checkout sessions to ensure userId is tracked for webhook handlers
- **[fix]** Auth endpoints missing tier field - updated all auth responses (login, signup, /me, update) to include tier for proper frontend display
- **[fix]** ClaimInvitePage redirect causing blank page - changed to full page reload instead of client-side navigation for auth context sync
- **[fix]** PricingPage environment variable access - switched from process.env to import.meta.env for client-side Stripe price ID
- **[fix]** Billing routes using incorrect auth property - changed from req.user.id to req.userId to match middleware implementation
- **[fix]** Settings page infinite loop - removed user dependency from billing tab useEffect to prevent refresh loops
- **[fix]** Production content generation errors - added missing GenerationLog database migration that was causing "table does not exist" errors when creating Arabic dialogues and other content

### Added

- **[test]** Comprehensive test coverage for authentication and billing features (4,809 lines of test code) - adds 13 new test files covering email verification, password reset, Stripe billing, subscription management, upgrade prompts, and e2e flows to ensure reliability of payment and user authentication workflows
  - Backend unit tests: verification routes (send/verify/resend), password reset routes (request/verify/reset), billing/Stripe routes (checkout/portal/webhooks), Stripe service (subscriptions/payments/webhooks), email service (all email types + token verification), admin subscription management endpoints
  - Frontend unit tests: VerifyEmailPage (verification flow, resend, states), PricingPage (tier display, checkout flow, errors), ForgotPasswordPage (form validation, success/error states), ResetPasswordPage (token validation, password requirements, security), UpgradePrompt (free/pro tiers, navigation)
  - E2E tests: email-verification.spec.ts (signup, verify, resend, edge cases), subscription-billing.spec.ts (pricing, checkout, admin features), password-reset.spec.ts (full flow from forgot to login, security measures)
- **[test]** Comprehensive page test coverage for 9 user-facing pages (145 tests) - improves test coverage from 57% to 100% of pages with tests for PISessionPage (42 tests), ChunkPackExercisesPage (35 tests), AdminPage (24 tests), CoursePage (25 tests), PISetupPage (7 tests), DialogueCreatorPage (4 tests), CourseCreatorPage (4 tests), NarrowListeningPlaybackPage (2 tests), and PracticePage (2 tests)
- **[test]** Comprehensive test coverage for quota system, admin impersonation, pagination, and error handling (237 unit tests + 5 E2E test suites)
  - Server middleware tests (71 tests): rate limiting with cooldown enforcement, usage tracker with Redis/Prisma integration, admin impersonation with audit logging
  - Server route tests (112 tests): pagination parameters for all content routes, library mode optimization, quota endpoint validation
  - Client component tests (54 tests): QuotaBadge with color-coded warnings, useQuota hook, ImpersonationBanner, ErrorBoundary with fallback UI, ErrorDisplay with context-aware icons
  - E2E test infrastructure: Playwright configuration, test utilities, and 5 comprehensive test suites (quota-system, admin-impersonation, library-pagination, error-handling, language-preferences) with 79 total test scenarios
  - All 237 unit tests passing; E2E tests ready to run with dev servers
- **[feat]** Arabic language support with CEFR proficiency levels (A1-C2) - complete implementation including 20 Gulf Arabic speaker names, 6 photorealistic avatars, AWS Polly neural voices (Hala, Zayd) with Speech Marks support, RTL text rendering, and full UI integration across onboarding/settings/content creation
- **[feat]** Weekly quota system for content generation - users limited to 20 content items per week (resets Monday 00:00 UTC) to prevent spam and manage resource usage
- **[feat]** GenerationLog database model - tracks all content generation events independently from content (persists even if content is deleted to prevent quota gaming)
- **[feat]** Rate limiting middleware with two-tier protection - weekly quota check (database-backed) and 30-second cooldown between requests (Redis-backed)
- **[feat]** Quota status API endpoint (GET /api/auth/me/quota) - returns remaining quota, reset time, and cooldown status
- **[feat]** QuotaBadge component - displays remaining generations with color-coded warnings (blue → orange → red as quota depletes)
- **[feat]** useQuota hook - fetches and manages user quota information with refetch functionality
- **[feat]** Admin quota exemption - admin users bypass all rate limits and have unlimited content generation
- **[feat]** Rate limit error responses - 429 errors include detailed quota/cooldown information and standard rate limit headers (X-RateLimit-\*, Retry-After)
- **[feat]** Infinite scroll pagination for library page - loads content incrementally (20 items per page) for better performance with large libraries
- **[feat]** Admin impersonation mode - click eye icon in admin users table to view any user's library in read-only mode for QA purposes
- **[feat]** AdminAuditLog database model - tracks all admin impersonation events with timestamp, IP address, and user agent for compliance
- **[feat]** Enhanced error recovery system with ErrorBoundary component to catch unexpected React errors gracefully
- **[feat]** Smart error display component with context-aware icons (network, auth, server errors) and retry functionality
- **[feat]** Loading skeleton UI for better perceived performance during initial library loads
- **[feat]** EmptySearchResults component for filtered library results with helpful suggestions
- **[feat]** ImpersonationBanner component showing prominent amber banner when admin is viewing as another user
- **[feat]** Language indicator badge in navigation bar showing current study language (JA/ES/ZH/FR)
- **[feat]** Spanish and French support for audio courses with CEFR proficiency levels
- **[feat]** CEFR level field to Course database model for Spanish/French proficiency tracking
- **[feat]** LANGUAGE_ABBREVIATIONS constant for consistent UI language display
- **[feat]** Server-side validation to prevent users from selecting same target and native language
- **[feat]** French language support with CEFR proficiency levels (A1-C2)
- **[feat]** 4 validated AWS Polly neural voices for French (Lea, Remi, Gabrielle, Liam)
- **[feat]** 20 diverse French speaker names representing modern France
- **[feat]** French language option in onboarding flow with CEFR level selector
- **[feat]** French support in settings page and narrow listening creator
- **[feat]** Voice validation script to test all French TTS voices
- **[feat]** Avatar generation script for French speakers (6 avatars)
- **[feat]** French avatars to admin page display and management interface (5 avatars deployed to production)
- **[resilience]** Zero-downtime deployment support with enhanced health checks and retry logic - health endpoint now verifies Redis and Database connectivity for Cloud Run startup probes, frontend job polling retries with exponential backoff (1s, 2s, 4s) to handle transient 5xx errors during revision rollouts
- **[deploy]** AWS Polly TTS support in production environment with proper credential configuration
- **[deploy]** Cloud Run deployment infrastructure for language processing microservices (furigana, pinyin)
- **[deploy]** Worker job deployment configuration with dedicated Cloud Run Job for background processing

### Changed

- **[refactor]** Library data fetching refactored to use React Query's useInfiniteQuery for pagination support
- **[refactor]** Global React Query configuration updated with smart retry logic - skips 4xx client errors, retries 5xx server errors up to 2 times with exponential backoff
- **[refactor]** All library content routes (episodes, courses, narrow listening, chunk packs) now support viewAs query parameter for admin impersonation
- **[refactor]** Centralized language selection - all content creation forms now use user's preferred study language from settings instead of per-form selectors
- **[refactor]** Removed language selector dropdowns from narrow listening, audio course, and dialogue creation forms
- **[refactor]** Removed narrator voice selector from audio course form - now auto-selects based on native language
- **[refactor]** Updated default narrator voices to use male voices across all languages (Shohei/JA, Wei/ZH, Sergio/ES, Remi/FR)
- **[refactor]** Settings page language dropdowns now filter out selected language from opposite dropdown to prevent invalid configurations
- **[refactor]** Removed disabled target language field from dialogue form for cleaner UI
- **[refactor]** Updated audio splitting logic to handle Polly vs Google TTS differently
- **[refactor]** French avatar generation script now uses GOOGLE_CLOUD_PROJECT environment variable instead of hardcoded project ID
- **[workers]** Separated background job processing from API service - workers now run in dedicated Cloud Run Job instead of embedded in API service for better scalability and resource isolation
- **[refactor]** Voice gender is now defined only in TTS_VOICES configuration (single source of truth) - removed duplicate hardcoded gender map from avatarService to prevent future mismatches

### Fixed

- **[fix]** Arabic missing from study language selector in settings page - users can now properly select Arabic as their target language for learning
- **[fix]** French avatar uploads blocked by validation regex and file size limit - added 'fr' language code to speaker avatar filename validation and increased upload limit from 5MB to 10MB
- **[fix]** Corrected French TTS voice names for AWS Polly compatibility (Léa → Lea)
- **[fix]** Replaced Mathieu voice (standard-only) with Remi (neural support)
- **[fix]** Added 20ms audio trim for Polly voices to prevent Speech Marks timing overlap
- **[dialogue]** Gemini occasionally generating dialogues where same speaker spoke multiple times consecutively - added strict speaker alternation requirement to prompt ensuring proper back-and-forth conversation flow
- **[dialogue]** Added retry logic with exponential backoff (3 attempts: 1s, 2s, 4s delays) for Gemini JSON parsing errors - handles transient API failures that occasionally return malformed JSON mid-response
- **[tts]** Incorrect gender mappings for Japanese TTS voices causing mismatched voice genders and avatars - corrected ja-JP-Wavenet-B (male), ja-JP-Wavenet-C (female), ja-JP-Neural2-B (male), and ja-JP-Neural2-D (female) per Google Cloud TTS documentation
- **[deploy]** Database connectivity failures in production by configuring Cloud Run to use Cloud SQL Proxy instead of direct IP connection - fixes "Dialogue Generation Failed" errors caused by Cloud Run's dynamic IPs
- **[scripts]** Metadata backfill script now detects and fixes incomplete metadata (empty pinyin/furigana strings), not just completely missing metadata - fixes Chinese dialogues with missing pinyin when language processing service was temporarily unavailable
- **[admin]** Speaker avatar uploads not appearing in production admin panel due to aggressive CDN caching - added cache-busting timestamp parameter to refresh requests after upload operations
- **[deploy]** Production deployment issues and database schema mismatches
  - Excluded test files from TypeScript production build
  - Added missing database migrations for `voiceProvider` fields on Speaker and StorySegment tables
  - Added missing `feature_flags` table migration
  - Fixed AWS Polly SDK type errors with proper VoiceId type casting
  - Improved furigana rendering to handle spaces in readings
  - Fixed 500 errors for dialogues and narrow listening content
  - Fixed audio generation failures due to missing AWS credentials

### Added

- **[test]** Expanded test coverage with 17 new test files and 280+ new tests
  - Client components: Logo, Pill, SegmentedPill, ViewToggleButtons
  - Client pages: ChunkPackSetupPage, ChunkPackExamplesPage, ChunkPackStoryPage, NarrowListeningCreatorPage, NarrowListeningLibraryPage, LandingPage, NotFoundPage
  - Server TTS providers: GoogleTTSProvider, GoogleTTSBetaProvider, PollyTTSProvider
  - Server routes: featureFlags, images
  - Server middleware: requestLogger
  - Total coverage: Server 874 tests, Client 711 tests (1,585 total)

### Fixed

- **[fix]** PlaybackPage speedKey initialization error causing test failures
  - Moved speedKey calculation before useEffect hooks that reference it
  - Fixed variable access in early return scenarios (loading/missing episode)
  - Added proper vi.hoisted() pattern for test mocks
  - Added window.scrollTo and Element.scrollIntoView mocks for jsdom compatibility

### Added

- **[test]** Comprehensive tests for job queues and audio generators (161 new tests)
  - Job queue tests: dialogueQueue, audioQueue, imageQueue, courseQueue, chunkPackQueue, narrowListeningQueue
  - Service tests: audioCourseAssembler, narrowListeningAudioGenerator, chunkPackAudioGenerator, imageGenerator, conversationalLessonScriptGenerator, conversationalCourseScriptGenerator
  - Client tests: useDemo hook
  - Reusable mock utilities for BullMQ and ffmpeg
  - Server test count now at 794 tests passing
- **[test]** Expanded test coverage with additional unit tests for routes and services
  - Server routes: audio, chunkPacks, courses, dialogue, episodes, narrowListening, pi
  - Server services: audioGenerator, avatarService, batchedTTSClient, chunkPackGenerator, courseItemExtractor, coursePlanner, courseScriptGenerator, dialogueGenerator, languageProcessor, lessonPlanner, lessonScriptGenerator, narrowListeningGenerator, piGenerator
  - Client hooks: useCourse, useEpisodes, useFeatureFlags, useLibraryData, useSpeakerAvatars
  - Client components: AudioPlayer, ChineseText, JapaneseText, UserMenu, DialogueGenerator, OnboardingModal
  - Client contexts: AudioPlayerContext
  - Client pages: LoginPage, PlaybackPage, SettingsPage
  - Added supertest devDependency for HTTP assertion testing
- **[test]** Comprehensive test coverage for server and client
  - Server: 75 tests covering middleware (auth, errorHandler, roleAuth, demoAuth), services (geminiClient, ttsClient, storageClient), and route validation (auth, admin)
  - Client: 74 tests covering AuthContext, useAudioPlayer hook, and UI components (Toast, ConfirmModal, SpeedSelector)
  - Added Vitest infrastructure to server with Prisma mocks
  - Added test:run and test:coverage scripts to root package.json for workspace-wide testing
  - Fixed existing page tests (LibraryPage, CreatePage) by adding missing useFeatureFlags mocks
- **[ci]** Claude Code GitHub integration for automated test running via @claude mentions

### Fixed

- **[fix]** CEFR proficiency levels now display in library view for Spanish content (commit: 36a160c)
  - Fixed library view not showing proficiency levels for Spanish narrow listening packs, courses, and chunk packs
  - Updated 6 locations to include cefrLevel in proficiency level checks
  - Added cefrLevel field to TypeScript interfaces for proper type safety

### Added

- **[feat]** CEFR proficiency level support for Spanish dialogues (commit: ccad672)
  - Added proper CEFR (A1-C2) level selection for Spanish language dialogues
  - Spanish dialogues now use appropriate European proficiency scale instead of HSK
  - Created migration script to update existing Spanish dialogues from HSK1 to A1
  - Proficiency level logic now correctly handles JLPT (Japanese), HSK (Chinese), and CEFR (Spanish)
- **[feat]** Admin feature visibility controls for content types (commit: 56e74b3)
  - New Settings tab in admin dashboard with toggle switches for each content type
  - Control visibility of Dialogues, Audio Courses, Narrow Listening, Processing Instruction, and Lexical Chunk Packs
  - FeatureFlag database model with all flags defaulting to enabled
  - Backend API endpoints for admins to manage flags and users to fetch them
  - useFeatureFlags hook for frontend feature flag management
  - CreatePage conditionally shows/hides cards based on feature flags
  - LibraryPage conditionally shows/hides filter buttons based on feature flags
  - Admins always see all content types regardless of settings
  - Non-admins only see enabled content types
- **[feat]** Amazon Polly TTS integration for maximum voice variety (commit: 9dd3898)
  - Added 21 Polly neural voices across 6 languages (Japanese, Chinese, Spanish, French, Arabic, Hebrew)
  - Total voice pool increased from 21 to 50 voices (29 Google + 21 Polly)
  - Provider detection based on voice ID format (hyphens = Google, single word = Polly)
  - Provider-aware SSML generation (Google uses speakingRate, Polly uses <prosody rate>)
  - Polly Speech Marks API for precise timing data (2 API calls per batch)
  - Database schema updated with voiceProvider fields (Speaker, Course, StorySegment models)
  - Manual test script for verifying Polly voices (test-polly-voices.ts)
  - Cost impact: ~10% increase for 2.4x more voices
- **[feat]** Configurable worker polling frequency via environment variable (commit: fe06855)
  - WORKER_DRAIN_DELAY env var controls Redis polling interval
  - Helper script (scripts/set-worker-polling.sh) to easily adjust on Cloud Run
  - Comprehensive cost documentation (docs/WORKER_POLLING.md)
  - Switch between fast testing (5s, ~$15/mo) and idle mode (5min, ~$0/mo)
  - Default 30s polling reduces costs by ~83% vs previous 5s polling
- **[docs]** Proposal for separate worker service architecture (commit: 765ddc1)
  - Documented future optimization to reduce Redis costs by ~88%
  - Would split job processing into separate Cloud Run service
  - Includes implementation plan, cost-benefit analysis, and migration strategy
  - Reduces Redis polling from ~100K commands/day to under 5K
- **[feat]** Randomized speaker voices for narrow listening with gender alternation (commit: c5b0d37)
  - Each sentence now uses a different speaker for more natural variety
  - Gender-balanced alternation: F-M-F-M pattern with round-robin distribution
  - No consecutive repeats: adjacent sentences always have different speakers
  - Expanded Japanese voice pool: 5 voices (3 female + 2 male) from 2 voices
  - Efficient batched TTS: parallel calls grouped by voice (e.g., 5 calls for 36 segments)
  - Silence buffer caching across versions for better performance
  - Cost neutral: same total character count = same TTS cost

### Fixed

- **[fix]** Spanish dialogue avatar assignment and module import issues (commit: 7e77bad)
  - Fixed broken avatar assignment where both male and female Spanish speakers showed the same avatar
  - Updated 8 files to import from constants-new.js instead of outdated constants.js
  - Removed stale build artifacts (constants.js, constants.d.ts, etc.)
  - Avatar assignment now correctly identifies speaker gender from voice ID configuration
- **[fix]** Chunk pack generating badge position and visibility (commit: 8ca9d65)
  - Moved generating/error badges before language pill to match other card types
  - Added polling to chunk packs query to auto-update when generation completes
  - Badge now properly disappears when status changes to 'ready'
- **[fix]** Japanese Neural2-C voice gender (commit: c5b0d37)
  - Fixed ja-JP-Neural2-C incorrectly marked as female (now correctly male)
  - Added Wavenet voices (Mayu, Shiori) for more Japanese variety
- **[fix]** Dialogue playback page scroll position on mobile (commit: 069c9aa)
  - Applied dynamic header height calculation to dialogue playback page
  - Currently played sentence now scrolls to correct position on mobile
  - Matches narrow listening page fix for consistent behavior across playback pages
- **[fix]** Audio courses not appearing in library view after lesson model flattening (commit: 96a9dfe)
  - Updated course API routes to use coreItems instead of deleted lessons relationship
  - Fixed 500 errors when fetching courses from library endpoint
  - Removed single lesson endpoint since lessons no longer exist as separate entities
  - Added hskLevel field to library endpoint response for Chinese course support

### Added

- **[feat]** Language-specific colors for pills and sidebars (commit: 9fbf2d6)
  - Japanese uses periwinkle (JA), Chinese uses keylime (ZH)
  - Applied to both LanguageLevelPill and LanguageLevelSidebar components
  - Provides better visual distinction between languages
- **[feat]** Demo user mode for app exploration (commit: 778d3d9)
  - New 'demo' role allows users to browse admin content without creating anything
  - Demo users see all admin's dialogues, courses, narrow listening, and chunk packs
  - Friendly "Demo Mode" badge displayed in header
  - All create/generate forms blocked with DemoRestrictionModal
  - Delete buttons hidden in library view for demo users
  - Seed script to create demo user: `npx tsx scripts/seed-demo-user.ts`
  - Demo credentials: demo.user@test.com / convo-demo-2025

### Fixed

- **[fix]** Chinese speaker avatars not loading (commit: 778d3d9)
  - Added language code mapping from 'cmn' (TTS voice ID) to 'zh' (avatar filename)
  - Fixes avatar lookup for Chinese dialogues

### Added

- **[feat]** Chinese pinyin tone format conversion for speaker names (commit: 7194823)
  - Converts tone marks (zhāng) to tone numbers (zhang1) based on user preference
  - Speaker names now respect user's `pinyinDisplayMode` setting
  - Matches dialogue text pinyin format for consistency
- **[feat]** Chinese text CSS styling with pinyin below characters (commit: 7194823)
  - Uses `ruby-position: under` for Chinese (pinyin below)
  - Japanese furigana remains above (unchanged)
  - Character-level ruby rendering for proper alignment
- **[feat]** Gender diversity in dialogue voice selection (commit: 7194823)
  - `getDialogueSpeakerVoices()` ensures one male and one female speaker
  - Randomizes which speaker gets which gender

### Changed

- **[chore]** Pinyin service dependencies auto-installed in start.sh (commit: 7194823)
- **[refactor]** TTS services updated for Neural2 voices and batching (commit: 7194823)

### Fixed

- **[fix]** Voice assignment type mismatch in DialogueGenerator (commit: a014800)
  - `getDialogueSpeakerVoices()` now returns full voice objects with id, voiceId, gender, and description
  - Previously returned only string IDs causing undefined voiceId and fallback "Speaker M" names
  - Fixes TTS voice assignment for newly created dialogues

### Added

- **[perf]** React Query integration for LibraryPage with automatic caching and request deduplication
  - Created `useLibraryData` hook with parallel queries for episodes, courses, narrow listening, and chunk packs
  - 5-minute staleTime prevents redundant API calls on navigation
  - Delete mutations with automatic cache invalidation
- **[perf]** React Query integration for PlaybackPage avatar fetching
  - Created `useSpeakerAvatars` hook with 30-minute cache for avatar data
  - Replaces module-scoped cache that was lost on navigation
- **[perf]** Route-level code splitting with React.lazy()
  - All 18 page components now lazy-loaded for smaller initial bundle
  - Added PageLoader fallback component during chunk loading
- **[perf]** Server-side Cache-Control headers for avatar endpoint
  - 1-hour browser cache, 1-day CDN cache for speaker avatars
- **[perf]** React Query integration for CoursePage with automatic polling
  - Created `useCourse` hook with automatic status polling during generation
  - Uses React Query's refetchInterval for cleaner polling implementation
  - Course data cached and automatically refreshed when generation completes
- **[perf]** Vite build optimization with manual chunk splitting
  - Vendor libraries split into separate cached chunks (react, router, framer-motion, wavesurfer, etc.)
  - Improves long-term browser caching for unchanged dependencies
- **[perf]** Memoized expensive operations in LibraryPage
  - Filter and sort operations now wrapped in useMemo
  - Prevents recalculation on unrelated state changes
- **[perf]** Cache invalidation for content creation
  - Added `useInvalidateLibrary` hook for cache management
  - Library cache invalidated when creating: dialogues, courses, narrow listening packs, chunk packs
  - Ensures new content appears immediately in library view

### Changed

- Initial changelog setup with /commit slash command
- Comprehensive data-testid attributes across all components for Playwright E2E testing (commit: da7b820)
- /pr slash command for automated pull request creation with generated descriptions (commit: ee40f3b)
- Worktree management commands: /new-worktree, /list-worktrees, /switch-worktree, /delete-worktree, /merge-worktree (commit: 1fa2428)
- /prune-worktrees command for automatic bulk cleanup of merged worktrees (commit: c10c0e4)
- Comprehensive development workflow guide (DEVELOPMENT.md) covering git workflows, worktree management, and best practices (commit: 8a4296d)
- LanguageLevelPill component for consistent language/level display across all content types (commit: 88f812d)
- targetLanguage field to NarrowListeningPack and ChunkPack models with database migration (commit: 88f812d)
- ViewToggleButtons component for shared furigana/pinyin and English translation toggles (commit: f1efc91)
- **[feat]** Icon sidebar with content type labels to Library page for better visual hierarchy and user clarity (commit: 233e7b4)
  - 96px wide colored sidebars with large 8x8 icons and uppercase labels
  - Clear content type identification for new users
  - Editorial magazine-like aesthetic with bold color blocks
- **[feat]** CreatePage with bold editorial design to replace Studio page (commit: c3dd63a)
  - Full-width action buttons with 128px colored sidebars
  - Large 12x12 icons in white on saturated backgrounds
  - Simplified content with title + one-line description per activity type
  - Matches Library page aesthetic for consistent design language
- **[feat]** Dark logo variant for landing page visibility (commit: 1be2feb)
  - Added variant prop ('light' | 'dark') to Logo component
  - Dark variant uses dark-brown color for icons on light backgrounds
  - Maintains default white icons for rest of app
- **[feat]** Auto-save with inline feedback for all Language Preferences (commit: 9c504ec)
  - All fields now auto-save immediately on change with contextual "Saved!" messages
  - Inline feedback appears directly below modified field instead of corner toast
  - Study Language, Native Language, Pinyin Display Mode, and JLPT/HSK Level all auto-save
  - Removed Save/Cancel buttons from Language Preferences tab
- **[docs]** Comprehensive design system documentation (commit: 6b2196a)
  - Created DESIGN.md with complete design philosophy and principles
  - Documented color palette, typography, layout patterns, and component patterns
  - Included code examples and implementation guidelines
  - Design anti-patterns and future considerations
- **[feat]** Mobile navigation and improved course generation display (commit: fc675a9)
  - Added visible Library/Create navigation buttons for mobile devices
  - Compact mobile nav with smaller text and optimized spacing
  - "Generating..." pill positioned on left during course generation
  - Language/level pill aligned to right (consistent with other cards)
  - Hide "0 lessons" text when course is generating
- **[feat]** Mobile-optimized layouts for Library, Create, and Settings pages (commit: 687d911)
  - Responsive icon sidebars: 64px on mobile, 96px on desktop (Library); 80px on mobile, 128px on desktop (Create)
  - Smaller text and icons on mobile screens
  - Reduced padding throughout for better mobile space utilization
  - Settings tabs show icon-only on very small screens, full text on larger screens
  - Wrapping filter tabs and navigation for better mobile experience
- **[feat]** Mobile-optimized Landing page for better mobile user experience (commit: 8eb97b7)
  - Smaller logo and reduced header padding on mobile devices
  - Hide "Sign In" button on mobile (show only "Get Started")
  - Responsive hero text sizes (4xl on mobile, 6xl/7xl on desktop)
  - Reduced section padding throughout for mobile viewports
  - Smaller feature cards with compact icons and text on mobile
  - Responsive CTA section with adjusted spacing
  - Smaller footer text and padding on mobile

### Changed

- **[style]** Increased font sizes across Processing Instruction and Lexical Chunk Pack setup pages (commit: 58fb851)
  - Description headings increased from base to xl
  - Body text and section labels increased for better readability
  - Japanese grammar point names increased from sm to lg
  - Japanese sentences in PI session increased from 2xl to 3xl
  - Improved visual hierarchy and accessibility throughout
- **[style]** Implemented bold, editorial design system with saturated colors throughout the app (commit: 8b2a6e7)
  - Replaced all desaturated colors with bold, saturated alternatives for a more confident visual language
  - Removed all gradients in favor of solid color blocks
  - Navigation: Solid periwinkle background with white logo icons and streamlined user menu
  - Headers: Solid coral backgrounds on playback pages
  - Audio player: Bold yellow background
  - Speed selector: Color-coded buttons (strawberry/yellow/keylime)
  - Text: Dark brown (#4B1800) for warmth instead of navy/black
  - Progress bars: Solid strawberry on yellow backgrounds
  - Narrow Listening: Bold strawberry variation buttons with enhanced segment highlighting
  - Removed violet color from palette, using 5 core bold colors
  - Increased card background saturation for more color presence
- Restructured project directory from ~/source/experiments/ to ~/source/ (commit: 9cc2692)
- Renamed repository from languageflow-studio to convo-lab across all files and documentation (commit: 995eec4)
- Added workflow documentation to use /commit slash command (commit: 5a527c6)
- Updated color palette to warm, playful theme inspired by hurryupandhavefun.com (commit: 88f812d)
- Changed keylime color from light yellow-green to dark olive green (#748C00) (commit: 88f812d)
- Unified library and studio card colors: periwinkle (dialogues), coral (audio courses), strawberry (narrow listening), keylime (chunk packs) (commit: 88f812d)
- Replaced keylime color palette with yellow (#FFCC3F) across Landing, Library, and Studio pages (commit: f1efc91)
- SpeedSelector now uses gray for all variants instead of variant-specific colors (commit: f1efc91)
- Simplified voiceSelection utilities to basic course/dialogue voice getters (commit: f1efc91)
- Updated tone indicator on PlaybackPage from coral to strawberry (commit: f1efc91)
- **[refactor]** Renamed all Studio routes to Create throughout application (commit: c3dd63a)
  - Changed /app/studio to /app/create across all navigation and page references
  - Updated Layout navigation to use "Create" terminology
  - Replaced StudioPage.tsx with new CreatePage.tsx
- **[style]** Applied bold editorial design to all creator forms (commit: 50e81b7, da63e5e, d828609)
  - DialogueCreatorPage with periwinkle theme and 8px left border accents
  - CourseCreatorPage with coral theme (CourseGenerator component)
  - NarrowListeningCreatorPage with strawberry theme and redesigned layout
  - PISetupPage with keylime (olive green) theme and bold selection buttons
  - ChunkPackSetupPage with yellow theme and bold selections
  - Updated all form inputs with larger text (base), bolder labels, and brand color focus states
  - Increased heading sizes from 3xl to 5xl for consistency
  - Made generate buttons more prominent with larger padding (px-10 py-5) and bold text
  - Updated progress bars and info boxes to use brand colors instead of generic purple/blue
  - Removed "Back to Create" navigation buttons from all creator pages for cleaner UI
  - Selection buttons now use brand color backgrounds when active
  - Changed Processing Instruction from periwinkle to keylime to avoid conflict with Dialogues

### Fixed

- **[fix]** Critical mobile viewport fixes for playback and content pages (commit: 25ae7f0)
  - ChunkPackExamplesPage: Removed back button from first page, fixed sticky positioning and scroll calculations for mobile
  - PlaybackPage: Complete mobile redesign with vertical stacking, smaller avatars (48px vs 96px), and responsive text sizing
  - LibraryPage: Fixed filter button overflow with responsive sizing and whitespace-nowrap
- **[fix]** Library page content cards optimized for mobile viewport (commit: aa59759)
  - All four card types (Dialogue, Audio Course, Narrow Listening, Chunk Pack) now fully responsive
  - Smaller icons and sidebars on mobile (6x6 vs 8x8)
  - Reduced text sizes and padding for better mobile readability
  - Prevents text overflow on small screens
- **[fix]** Dialogue Creator generate section optimized for mobile viewport (commit: f697abd)
  - "Ready to Generate?" section now stacks vertically on mobile
  - Full-width button for easier interaction on small screens
  - Reduced text sizes and padding for better mobile readability
  - Desktop layout unchanged with horizontal arrangement
- **[fix]** Narrow Listening Creator button optimized for mobile viewport (commit: f2c93fe)
  - Larger, more visible icons (5x5 on mobile, 6x6 on desktop)
  - Responsive text sizing for better readability
  - Adjusted padding for improved mobile touch targets
  - Icons properly sized relative to button and text
- **[fix]** Processing Instruction setup page optimized for mobile viewport (commit: 94a1b0b)
  - JLPT level buttons in 2x2 grid on mobile (vs 1x4 on desktop)
  - Grammar point buttons single column on mobile for better readability
  - Reduced text sizes and padding throughout for mobile screens
  - Larger, more visible icons in Start button
  - Better touch targets and improved mobile usability
- **[fix]** Lexical Chunk Pack setup page optimized for mobile viewport (commit: 47cd42d)
  - JLPT level buttons in 2-column grid on mobile (vs 3-column on desktop)
  - Theme buttons single column on mobile for better readability
  - Reduced text sizes and padding throughout for mobile screens
  - Larger, more visible icons in Generate button
  - Better touch targets and improved mobile usability
- **[fix]** Admin page tables and buttons optimized for mobile viewport (commit: b6023ab)
  - All data tables now horizontally scrollable on mobile with overflow-x-auto
  - Responsive table cell padding (px-3 on mobile, px-6 on desktop)
  - Added whitespace-nowrap to prevent text wrapping in table cells
  - Tab navigation horizontally scrollable for mobile viewing
  - All button text made responsive (text-xs on mobile, text-sm on desktop)
  - Tables affected: Users, Invite Codes, User Avatars
  - Buttons affected: Speaker avatar Re-crop/Upload, User Avatar Upload
- **[fix]** Chunk Pack Story and Exercises pages optimized for mobile viewport (commit: 3a08a73)
  - ChunkPackStoryPage: Removed back button from empty state, responsive sticky positioning for audio player
  - ChunkPackStoryPage: Made header, dialogue segments, and all text sizes responsive
  - ChunkPackExercisesPage: Made completion screen responsive with vertical button stacking
  - ChunkPackExercisesPage: Responsive exercise cards, options, and explanation boxes
  - Reduced padding throughout for mobile (px-4 on mobile, px-6 on desktop)
  - Smaller text sizes and icons on mobile with sm: breakpoints
- **[style]** Increased horizontal padding on card type sidebars for mobile (commit: 6a14f17)
  - Increased padding from px-1 to px-2 on mobile for all card type sidebars
  - Applied to Dialogue, Audio Course, Narrow Listening, and Chunk Pack cards
  - Gives better breathing room for text on mobile while maintaining desktop layout
- **[fix]** Remove gradient and fix mobile pill visibility (commit: f5cb7af)
  - Changed LanguageLevelSidebar to use solid strawberry background (removed gradient)
  - Added className prop to LanguageLevelPill to support visibility classes
  - Reverted SegmentedPill to horizontal-only layout (desktop only)
  - Fixed issue where both old and new pills showed simultaneously on mobile
- **[feat]** Right sidebar for language/level on mobile cards (commit: b04d8b3)
  - Created LanguageLevelSidebar component with solid strawberry background
  - Displays as 48px flush right sidebar on mobile, matching left content type sidebar pattern
  - Shows language code stacked above level (e.g., "JA" above "N4")
  - Applied to all 4 card types: Episode, Audio Course, Narrow Listening, Chunk Pack
  - Desktop maintains horizontal pill design in content area
- **[fix]** Audio Course card mobile layout improvements (commit: 0bec24b)
  - Removed lesson count display from Audio Course cards
  - Badges now stack vertically on mobile (flex-col sm:flex-row) for better space utilization
  - Gives more horizontal room for title text on small screens
- **[fix]** Library page card overflow on mobile viewport (commit: 08696e5)
  - Fixed text overflow on all 4 content card types (Episode, Audio Course, Narrow Listening, Chunk Pack)
  - Pills and badges now anchored to right side of cards with ml-auto
  - Text properly truncates when approaching pill area using overflow-hidden
  - Reduced gap between content and badges for better mobile spacing
- **[fix]** Additional mobile viewport refinements (commits: 9001a3a through 4113cb1)
  - Removed back button from CoursePage
  - Centered Library page filter tabs on mobile to prevent overflow
  - Added "ConvoLab" text to logo visible only on desktop (hidden on mobile)
  - Increased icon size in Narrow Listening generate button for better visibility
  - Stacked dialogue creation selectors vertically on mobile (grid-cols-1 sm:grid-cols-2)
  - Stacked audio course selectors and dialogue voices vertically on mobile
  - Made audio course "Ready to Generate" section stack vertically with full-width button on mobile
  - Stacked narrow listening selectors (JLPT level, grammar focus) vertically on mobile
- SpeedSelector now shows white text when selected across all color variants (commit: 88f812d)
- Added data-testid to login submit button to prevent test ambiguity (commit: 418a367)
- **[fix]** Navigation shift when switching between Library and Create pages (commit: baa355c)
  - Added overflow-y: scroll to html element to force scrollbar always visible
  - Prevents layout shift caused by scrollbar appearing/disappearing on different page heights

## [2025-11-23]

### Changed

- Improved voice selection and audio speed playback (commit: 11a8567)
- Fixed audio generation bugs and voice gender mapping (commit: a281d92)
- Fixed quick-check-prod script for production (commit: c0cc37a)
- Fixed migration script imports for production environment (commit: d550be3)
- Fixed Dockerfile to include scripts directory (commit: 93f529f)
