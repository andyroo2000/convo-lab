# Mobile Optimization Checklist

Date: 2026-02-13
Viewport baseline: iPhone 13 (`390x844`) via Playwright

## Public routes

- [x] `/` (`LandingPage`) reviewed and mobile-optimized.
- [x] `/login` (`LoginPage`) reviewed and mobile-optimized.
- [x] `/pricing` (`PricingPage`) reviewed and mobile-optimized.
- [x] `/tools` (`ToolsDirectoryPage`) reviewed and mobile-optimized.
- [x] `/tools/japanese-date` (`JapaneseDateToolPage`) reviewed and mobile-optimized.
- [x] `/forgot-password` (`ForgotPasswordPage`) reviewed and mobile spacing optimized.
- [x] `/reset-password/:token` (`ResetPasswordPage`) reviewed and mobile spacing optimized.
- [x] `/verify-email` (`VerifyEmailPage`) reviewed and guest mobile state added.
- [x] `/verify-email/:token` (`VerifyEmailPage`) covered by same component + styles.
- [x] `/claim-invite` (`ClaimInvitePage`) reviewed and mobile spacing optimized.
- [x] `*` / 404 (`NotFoundPage`) reviewed and mobile-optimized.

## App routes (authenticated)

- [x] `/app/library` (`LibraryPage`) reviewed and mobile-optimized.
- [x] `/app/create` (`CreatePage`) reviewed and mobile-optimized.
- [x] `/app/create/dialogue` (`DialogueCreatorPage`) reviewed and mobile-optimized.
- [x] `/app/create/audio-course/:episodeId` (`CourseCreatorPage`) reviewed for mobile layout.
- [x] `/app/playback/:episodeId` (`PlaybackPage`) reviewed and mobile-optimized in this pass.
- [x] `/app/courses/:courseId` (`CoursePage`) reviewed and mobile-optimized.
- [x] `/app/practice/:episodeId` (`PracticePage`) reviewed (simple placeholder layout).
- [x] `/app/settings` (`SettingsPage`) reviewed and mobile-optimized.
- [x] `/app/settings/:tab` (`SettingsPage`) reviewed across tabs.
- [x] `/app/admin` (`AdminPage`) reviewed on mobile.
- [x] `/app/admin/:tab` (`AdminPage`) reviewed across tabs.
- [x] `/app/tools` (`ToolsDirectoryPage`) shares same mobile styling as public tools.
- [x] `/app/tools/japanese-date` (`JapaneseDateToolPage`) shares same mobile styling as public tools.

## Verification artifacts

- Primary audit screenshots: `/tmp/convo-mobile-audit/*.png`
- Route audit index: `/tmp/convo-mobile-audit/index.json`
- Extra tab-level audit index: `/tmp/convo-mobile-audit/index-extra.json`
- Admin redesign screenshots (desktop + mobile, all `/app/admin/*` tabs):
  `/tmp/convo-admin-redesign/*.png`
