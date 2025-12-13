# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Unreleased

### Added
- **[feat]** Weekly quota system for content generation - users limited to 20 content items per week (resets Monday 00:00 UTC) to prevent spam and manage resource usage
- **[feat]** GenerationLog database model - tracks all content generation events independently from content (persists even if content is deleted to prevent quota gaming)
- **[feat]** Rate limiting middleware with two-tier protection - weekly quota check (database-backed) and 30-second cooldown between requests (Redis-backed)
- **[feat]** Quota status API endpoint (GET /api/auth/me/quota) - returns remaining quota, reset time, and cooldown status
- **[feat]** QuotaBadge component - displays remaining generations with color-coded warnings (blue → orange → red as quota depletes)
- **[feat]** useQuota hook - fetches and manages user quota information with refetch functionality
- **[feat]** Admin quota exemption - admin users bypass all rate limits and have unlimited content generation
- **[feat]** Rate limit error responses - 429 errors include detailed quota/cooldown information and standard rate limit headers (X-RateLimit-*, Retry-After)
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
