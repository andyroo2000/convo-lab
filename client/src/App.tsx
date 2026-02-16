import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { LocaleProvider } from './contexts/LocaleContext';
import { AudioPlayerProvider } from './contexts/AudioPlayerContext';
import { AudioPreviewProvider } from './contexts/AudioPreviewContext';
import Layout from './components/common/Layout';
import ToolsPublicLayout from './components/common/ToolsPublicLayout';
import ErrorBoundary from './components/ErrorBoundary';
import PWAInstallPrompt from './components/common/PWAInstallPrompt';
import {
  initializeGoogleAnalytics,
  isGoogleAnalyticsEnabled,
  trackPageView,
} from './lib/googleAnalytics';
import useSeoMeta from './hooks/useSeoMeta';
import './i18n';

// Lazy load all page components for code splitting
const LandingPage = lazy(() => import('./pages/LandingPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const VerifyEmailPage = lazy(() => import('./pages/VerifyEmailPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const ClaimInvitePage = lazy(() => import('./pages/ClaimInvitePage'));
const PricingPage = lazy(() => import('./pages/PricingPage'));
const ToolsPage = lazy(() => import('./pages/ToolsPage'));
const JapaneseDateToolPage = lazy(() => import('./pages/JapaneseDateToolPage'));
const JapaneseTimePracticeToolPage = lazy(() => import('./pages/JapaneseTimePracticeToolPage'));
const JapaneseCounterPracticeToolPage = lazy(
  () => import('./pages/JapaneseCounterPracticeToolPage')
);
const CreatePage = lazy(() => import('./pages/CreatePage'));
const DialogueCreatorPage = lazy(() => import('./pages/DialogueCreatorPage'));
const CourseCreatorPage = lazy(() => import('./pages/CourseCreatorPage'));
const PlaybackPage = lazy(() => import('./pages/PlaybackPage'));
const PracticePage = lazy(() => import('./pages/PracticePage'));
const LibraryPage = lazy(() => import('./pages/LibraryPage'));
const CoursePage = lazy(() => import('./pages/CoursePage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

// Loading fallback component
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="text-center">
      <div className="loading-spinner w-12 h-12 border-4 border-indigo border-t-transparent rounded-full mx-auto mb-4" />
      <p className="text-gray-600">Loading...</p>
    </div>
  </div>
);

const SITE_URL = 'https://convo-lab.com';

interface RouteSeoConfig {
  title: string;
  description: string;
  canonicalPath: string;
}

const INDEXABLE_ROUTE_CONFIG: Record<string, RouteSeoConfig> = {
  '/': {
    title: 'ConvoLab | Japanese Date, Time & Counter Practice Tools',
    description:
      'Practice Japanese date, time, and counter reading with free furigana-friendly tools from ConvoLab.',
    canonicalPath: '/',
  },
  '/pricing': {
    title: 'Pricing | ConvoLab',
    description:
      'Compare ConvoLab plans for Japanese language practice, AI dialogue generation, and audio tools.',
    canonicalPath: '/pricing',
  },
  '/tools': {
    title: 'Japanese Learning Tools | ConvoLab',
    description:
      'Use free ConvoLab tools to practice Japanese dates, time, and counters with furigana-friendly quiz flows.',
    canonicalPath: '/tools',
  },
  '/tools/japanese-date': {
    title: 'Japanese Date Practice Tool (Furigana + Audio) | ConvoLab',
    description:
      'Practice reading Japanese dates with furigana and audio playback. Convert Gregorian dates into natural Japanese quickly.',
    canonicalPath: '/tools/japanese-date',
  },
  '/tools/japanese-time': {
    title: 'Japanese Time Practice Tool (Furigana + Audio) | ConvoLab',
    description:
      'Train Japanese time reading with furigana, audio playback, and interactive practice for AM/PM and 24-hour formats.',
    canonicalPath: '/tools/japanese-time',
  },
  '/tools/japanese-counters': {
    title: 'Japanese Counter Practice Tool (Furigana Quiz) | ConvoLab',
    description:
      'Practice Japanese counters with random object drills, ruby furigana answers, and retro textbook-style quiz cards.',
    canonicalPath: '/tools/japanese-counters',
  },
};

const normalizePathname = (pathname: string): string => {
  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.slice(0, -1);
  }
  return pathname;
};

const RouteSeoController = () => {
  const location = useLocation();
  const normalizedPath = normalizePathname(location.pathname);
  const indexableConfig = INDEXABLE_ROUTE_CONFIG[normalizedPath];

  let seoOptions: {
    title: string;
    description: string;
    robots: string;
    canonicalUrl?: string;
  };

  if (indexableConfig) {
    seoOptions = {
      title: indexableConfig.title,
      description: indexableConfig.description,
      canonicalUrl: `${SITE_URL}${indexableConfig.canonicalPath}`,
      robots: 'index,follow',
    };
  } else {
    const noIndexPathPrefixes = [
      '/app',
      '/login',
      '/claim-invite',
      '/verify-email',
      '/forgot-password',
      '/reset-password',
    ];
    const shouldNoIndex = noIndexPathPrefixes.some(
      (prefix) => normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`)
    );

    seoOptions = {
      title: shouldNoIndex ? 'ConvoLab' : 'Page Not Found | ConvoLab',
      description: shouldNoIndex
        ? 'ConvoLab language learning application.'
        : 'The page you requested could not be found on ConvoLab.',
      robots: 'noindex,nofollow',
    };
  }

  useSeoMeta(seoOptions);

  return null;
};

const GoogleAnalyticsTracker = () => {
  const location = useLocation();

  useEffect(() => {
    if (!isGoogleAnalyticsEnabled()) return;
    initializeGoogleAnalytics();
  }, []);

  useEffect(() => {
    if (!isGoogleAnalyticsEnabled()) return;
    const pagePath = `${location.pathname}${location.search}${location.hash}`;
    trackPageView(pagePath);
  }, [location.hash, location.pathname, location.search]);

  return null;
};

const App = () => (
  <ErrorBoundary>
    <BrowserRouter>
      <GoogleAnalyticsTracker />
      <RouteSeoController />
      <AuthProvider>
        <LocaleProvider>
          <AudioPlayerProvider>
            <AudioPreviewProvider>
              <PWAInstallPrompt />
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  {/* Public Routes */}
                  <Route path="/" element={<LandingPage />} />
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/pricing" element={<PricingPage />} />
                  <Route path="/tools" element={<ToolsPublicLayout />}>
                    <Route index element={<ToolsPage />} />
                    <Route path="japanese-date" element={<JapaneseDateToolPage />} />
                    <Route path="japanese-time" element={<JapaneseTimePracticeToolPage />} />
                    <Route path="japanese-counters" element={<JapaneseCounterPracticeToolPage />} />
                  </Route>
                  <Route path="/claim-invite" element={<ClaimInvitePage />} />
                  <Route path="/verify-email" element={<VerifyEmailPage />} />
                  <Route path="/verify-email/:token" element={<VerifyEmailPage />} />
                  <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                  <Route path="/reset-password/:token" element={<ResetPasswordPage />} />

                  {/* App Routes (Protected) */}
                  <Route path="/app" element={<Layout />}>
                    <Route index element={<Navigate to="/app/library" replace />} />
                    <Route path="library" element={<LibraryPage />} />
                    <Route path="settings" element={<SettingsPage />} />
                    <Route path="settings/:tab" element={<SettingsPage />} />
                    <Route path="admin" element={<AdminPage />} />
                    <Route path="admin/:tab" element={<AdminPage />} />

                    {/* Create - Content Creation Hub */}
                    <Route path="create" element={<CreatePage />} />
                    <Route path="create/dialogue" element={<DialogueCreatorPage />} />
                    <Route
                      path="create/audio-course"
                      element={<Navigate to="/app/create/dialogue" replace />}
                    />
                    <Route path="create/audio-course/:episodeId" element={<CourseCreatorPage />} />

                    {/* Playback & Practice */}
                    <Route path="playback/:episodeId" element={<PlaybackPage />} />
                    <Route path="practice/:episodeId" element={<PracticePage />} />
                    <Route path="courses/:courseId" element={<CoursePage />} />

                    {/* Tools */}
                    <Route path="tools" element={<ToolsPage />} />
                    <Route path="tools/japanese-date" element={<JapaneseDateToolPage />} />
                    <Route path="tools/japanese-time" element={<JapaneseTimePracticeToolPage />} />
                    <Route
                      path="tools/japanese-counters"
                      element={<JapaneseCounterPracticeToolPage />}
                    />
                  </Route>

                  {/* 404 Catch-all Route */}
                  <Route path="*" element={<NotFoundPage />} />
                </Routes>
              </Suspense>
            </AudioPreviewProvider>
          </AudioPlayerProvider>
        </LocaleProvider>
      </AuthProvider>
    </BrowserRouter>
  </ErrorBoundary>
);

export default App;
