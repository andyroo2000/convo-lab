import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { LocaleProvider } from './contexts/LocaleContext';
import { AudioPlayerProvider } from './contexts/AudioPlayerContext';
import Layout from './components/common/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import './i18n';

// Lazy load all page components for code splitting
const LandingPage = lazy(() => import('./pages/LandingPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const VerifyEmailPage = lazy(() => import('./pages/VerifyEmailPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const ClaimInvitePage = lazy(() => import('./pages/ClaimInvitePage'));
const PricingPage = lazy(() => import('./pages/PricingPage'));
const CreatePage = lazy(() => import('./pages/CreatePage'));
const DialogueCreatorPage = lazy(() => import('./pages/DialogueCreatorPage'));
const CourseCreatorPage = lazy(() => import('./pages/CourseCreatorPage'));
const PlaybackPage = lazy(() => import('./pages/PlaybackPage'));
const PracticePage = lazy(() => import('./pages/PracticePage'));
const LibraryPage = lazy(() => import('./pages/LibraryPage'));
const CoursePage = lazy(() => import('./pages/CoursePage'));
const NarrowListeningLibraryPage = lazy(() => import('./pages/NarrowListeningLibraryPage'));
const NarrowListeningCreatorPage = lazy(() => import('./pages/NarrowListeningCreatorPage'));
const NarrowListeningPlaybackPage = lazy(() => import('./pages/NarrowListeningPlaybackPage'));
const PISetupPage = lazy(() => import('./pages/PISetupPage'));
const PISessionPage = lazy(() => import('./pages/PISessionPage'));
const ChunkPackSetupPage = lazy(() => import('./pages/ChunkPackSetupPage'));
const ChunkPackExamplesPage = lazy(() => import('./pages/ChunkPackExamplesPage'));
const ChunkPackStoryPage = lazy(() => import('./pages/ChunkPackStoryPage'));
const ChunkPackExercisesPage = lazy(() => import('./pages/ChunkPackExercisesPage'));
const ReviewPage = lazy(() => import('./pages/ReviewPage'));
const DeckEditorPage = lazy(() => import('./pages/DeckEditorPage'));
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

const App = () => (
  <ErrorBoundary>
    <BrowserRouter>
      <AuthProvider>
        <LocaleProvider>
          <AudioPlayerProvider>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                {/* Public Routes */}
                <Route path="/" element={<LandingPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/pricing" element={<PricingPage />} />
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
                  <Route path="create/audio-course" element={<CourseCreatorPage />} />
                  <Route path="create/narrow-listening" element={<NarrowListeningCreatorPage />} />
                  <Route path="create/processing-instruction" element={<PISetupPage />} />
                  <Route path="create/lexical-chunk-pack" element={<ChunkPackSetupPage />} />

                  {/* Playback & Practice */}
                  <Route path="playback/:episodeId" element={<PlaybackPage />} />
                  <Route path="practice/:episodeId" element={<PracticePage />} />
                  <Route path="courses/:courseId" element={<CoursePage />} />
                  <Route path="narrow-listening" element={<NarrowListeningLibraryPage />} />
                  <Route path="narrow-listening/:id" element={<NarrowListeningPlaybackPage />} />
                  <Route path="pi/session" element={<PISessionPage />} />
                  <Route path="chunk-packs/:packId/examples" element={<ChunkPackExamplesPage />} />
                  <Route path="chunk-packs/:packId/story" element={<ChunkPackStoryPage />} />
                  <Route path="review" element={<ReviewPage />} />
                  <Route path="review/:deckId" element={<ReviewPage />} />
                  <Route path="decks/:deckId/edit" element={<DeckEditorPage />} />
                  <Route
                    path="chunk-packs/:packId/exercises"
                    element={<ChunkPackExercisesPage />}
                  />
                </Route>

                {/* 404 Catch-all Route */}
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </Suspense>
          </AudioPlayerProvider>
        </LocaleProvider>
      </AuthProvider>
    </BrowserRouter>
  </ErrorBoundary>
);

export default App;
