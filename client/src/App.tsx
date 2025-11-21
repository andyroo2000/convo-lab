import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { AudioPlayerProvider } from './contexts/AudioPlayerContext';
import Layout from './components/common/Layout';
import LandingPage from './pages/LandingPage';
import StudioPage from './pages/StudioPage';
import DialogueCreatorPage from './pages/DialogueCreatorPage';
import CourseCreatorPage from './pages/CourseCreatorPage';
import PlaybackPage from './pages/PlaybackPage';
import PracticePage from './pages/PracticePage';
import LibraryPage from './pages/LibraryPage';
import CoursePage from './pages/CoursePage';
import LoginPage from './pages/LoginPage';
import NarrowListeningLibraryPage from './pages/NarrowListeningLibraryPage';
import NarrowListeningCreatorPage from './pages/NarrowListeningCreatorPage';
import NarrowListeningPlaybackPage from './pages/NarrowListeningPlaybackPage';
import PISetupPage from './pages/PISetupPage';
import PISessionPage from './pages/PISessionPage';
import ChunkPackSetupPage from './pages/ChunkPackSetupPage';
import ChunkPackExamplesPage from './pages/ChunkPackExamplesPage';
import ChunkPackStoryPage from './pages/ChunkPackStoryPage';
import ChunkPackExercisesPage from './pages/ChunkPackExercisesPage';
import SettingsPage from './pages/SettingsPage';
import AdminPage from './pages/AdminPage';
import NotFoundPage from './pages/NotFoundPage';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AudioPlayerProvider>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />

            {/* App Routes (Protected) */}
            <Route path="/app" element={<Layout />}>
              <Route index element={<Navigate to="/app/library" replace />} />
              <Route path="library" element={<LibraryPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="settings/:tab" element={<SettingsPage />} />
              <Route path="admin" element={<AdminPage />} />
              <Route path="admin/:tab" element={<AdminPage />} />

              {/* Studio - Content Creation Hub */}
              <Route path="studio" element={<StudioPage />} />
              <Route path="studio/:episodeId" element={<StudioPage />} />
              <Route path="studio/create/dialogue" element={<DialogueCreatorPage />} />
              <Route path="studio/create/audio-course" element={<CourseCreatorPage />} />
              <Route path="studio/create/narrow-listening" element={<NarrowListeningCreatorPage />} />
              <Route path="studio/create/processing-instruction" element={<PISetupPage />} />
              <Route path="studio/create/lexical-chunk-pack" element={<ChunkPackSetupPage />} />

              {/* Playback & Practice */}
              <Route path="playback/:episodeId" element={<PlaybackPage />} />
              <Route path="practice/:episodeId" element={<PracticePage />} />
              <Route path="courses/:courseId" element={<CoursePage />} />
              <Route path="narrow-listening" element={<NarrowListeningLibraryPage />} />
              <Route path="narrow-listening/:id" element={<NarrowListeningPlaybackPage />} />
              <Route path="pi/session" element={<PISessionPage />} />
              <Route path="chunk-packs/:packId/examples" element={<ChunkPackExamplesPage />} />
              <Route path="chunk-packs/:packId/story" element={<ChunkPackStoryPage />} />
              <Route path="chunk-packs/:packId/exercises" element={<ChunkPackExercisesPage />} />
            </Route>

            {/* 404 Catch-all Route */}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </AudioPlayerProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
