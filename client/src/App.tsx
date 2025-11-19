import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { AudioPlayerProvider } from './contexts/AudioPlayerContext';
import Layout from './components/common/Layout';
import StudioPage from './pages/StudioPage';
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

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AudioPlayerProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<Layout />}>
            <Route index element={<Navigate to="/library" replace />} />
            <Route path="library" element={<LibraryPage />} />
            <Route path="studio" element={<StudioPage />} />
            <Route path="studio/:episodeId" element={<StudioPage />} />
            <Route path="playback/:episodeId" element={<PlaybackPage />} />
            <Route path="practice/:episodeId" element={<PracticePage />} />
            <Route path="courses/:courseId" element={<CoursePage />} />
            <Route path="narrow-listening" element={<NarrowListeningLibraryPage />} />
            <Route path="narrow-listening/create" element={<NarrowListeningCreatorPage />} />
            <Route path="narrow-listening/:id" element={<NarrowListeningPlaybackPage />} />
            <Route path="pi" element={<PISetupPage />} />
            <Route path="pi/session" element={<PISessionPage />} />
            <Route path="chunk-packs/setup" element={<ChunkPackSetupPage />} />
            <Route path="chunk-packs/:packId/examples" element={<ChunkPackExamplesPage />} />
            <Route path="chunk-packs/:packId/story" element={<ChunkPackStoryPage />} />
            <Route path="chunk-packs/:packId/exercises" element={<ChunkPackExercisesPage />} />
          </Route>
        </Routes>
        </AudioPlayerProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
