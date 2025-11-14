import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Layout from './components/common/Layout';
import StudioPage from './pages/StudioPage';
import PlaybackPage from './pages/PlaybackPage';
import PracticePage from './pages/PracticePage';
import LibraryPage from './pages/LibraryPage';
import LoginPage from './pages/LoginPage';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<Layout />}>
            <Route index element={<Navigate to="/library" replace />} />
            <Route path="library" element={<LibraryPage />} />
            <Route path="studio" element={<StudioPage />} />
            <Route path="studio/:episodeId" element={<StudioPage />} />
            <Route path="playback/:episodeId" element={<PlaybackPage />} />
            <Route path="practice/:episodeId" element={<PracticePage />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
