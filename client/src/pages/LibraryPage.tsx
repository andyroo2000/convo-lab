import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Play, Clock, Trash2 } from 'lucide-react';
import { Episode } from '../types';
import { useEpisodes } from '../hooks/useEpisodes';
import ConfirmModal from '../components/common/ConfirmModal';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function LibraryPage() {
  const { deleteEpisode } = useEpisodes();
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [episodeToDelete, setEpisodeToDelete] = useState<Episode | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    loadEpisodes();
  }, []);

  const loadEpisodes = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/api/episodes`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch episodes');
      }

      const data = await response.json();
      setEpisodes(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (episode: Episode, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setEpisodeToDelete(episode);
  };

  const handleConfirmDelete = async () => {
    if (!episodeToDelete) return;

    setIsDeleting(true);
    try {
      await deleteEpisode(episodeToDelete.id);
      // Refresh episodes list
      await loadEpisodes();
      setEpisodeToDelete(null);
    } catch (err) {
      console.error('Failed to delete episode:', err);
      // Error is already handled in the hook
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCancelDelete = () => {
    if (!isDeleting) {
      setEpisodeToDelete(null);
    }
  };

  if (loading) {
    return (
      <div>
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-navy">Your Episodes</h1>
          <Link to="/studio" className="btn-primary">
            <Plus className="w-5 h-5 inline-block mr-2" />
            Create New Episode
          </Link>
        </div>
        <div className="card text-center py-12">
          <div className="loading-spinner w-12 h-12 border-4 border-indigo border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-600">Loading episodes...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-navy">Your Episodes</h1>
          <Link to="/studio" className="btn-primary">
            <Plus className="w-5 h-5 inline-block mr-2" />
            Create New Episode
          </Link>
        </div>
        <div className="card text-center py-12">
          <p className="text-red-600 mb-4">Error: {error}</p>
          <button onClick={loadEpisodes} className="btn-outline">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-navy">Your Episodes</h1>
        <Link to="/studio" className="btn-primary">
          <Plus className="w-5 h-5 inline-block mr-2" />
          Create New Episode
        </Link>
      </div>

      {episodes.length === 0 ? (
        <div className="card">
          <p className="text-gray-500 text-center py-12">
            No episodes yet. Create your first dialogue to get started!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {episodes.map((episode) => (
            <Link
              key={episode.id}
              to={`/playback/${episode.id}`}
              className="card hover:shadow-lg transition-shadow cursor-pointer group relative"
            >
              {/* Delete Button - appears on hover */}
              <button
                onClick={(e) => handleDeleteClick(episode, e)}
                className="absolute top-3 right-3 p-2 bg-white rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50 hover:text-red-600 z-10"
                title="Delete episode"
              >
                <Trash2 className="w-4 h-4" />
              </button>

              <div className="space-y-3">
                {/* Title */}
                <h3 className="text-xl font-bold text-navy group-hover:text-indigo transition-colors">
                  {episode.title}
                </h3>

                {/* Language Info */}
                <div className="flex gap-2 text-sm">
                  <span className="px-2 py-1 bg-pale-sky text-navy rounded font-medium">
                    {episode.targetLanguage.toUpperCase()}
                  </span>
                  <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded">
                    {episode.status}
                  </span>
                </div>

                {/* Source Text Preview */}
                <p className="text-sm text-gray-600 line-clamp-2">
                  {episode.sourceText}
                </p>

                {/* Stats */}
                <div className="flex items-center gap-4 text-xs text-gray-500 pt-2 border-t">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(episode.createdAt).toLocaleDateString()}
                  </div>
                  {episode.dialogue && (
                    <div className="flex items-center gap-1">
                      <Play className="w-3 h-3" />
                      {episode.dialogue.sentences?.length || 0} lines
                    </div>
                  )}
                  {episode.audioUrl && (
                    <span className="px-2 py-1 bg-green-100 text-green-700 rounded font-medium">
                      Audio Ready
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={episodeToDelete !== null}
        title="Delete Episode"
        message={`Are you sure you want to delete "${episodeToDelete?.title}"? This action cannot be undone and will delete all associated dialogue, audio, and images.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
        isLoading={isDeleting}
      />
    </div>
  );
}
