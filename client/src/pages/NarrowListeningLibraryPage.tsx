import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Sparkles, Plus, Trash2, Clock, Loader } from 'lucide-react';

import { API_URL } from '../config';

interface NarrowListeningPack {
  id: string;
  title: string;
  topic: string;
  targetLanguage: string;
  jlptLevel: string | null;
  hskLevel: string | null;
  status: string;
  createdAt: string;
  versions: Array<{
    id: string;
    title: string;
    variationType: string;
  }>;
}

const NarrowListeningLibraryPage = () => {
  const navigate = useNavigate();
  const [packs, setPacks] = useState<NarrowListeningPack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadPacks = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/api/narrow-listening`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch packs');
      }

      const data = await response.json();
      setPacks(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPacks();
  }, []);

  const handleDelete = async (packId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!confirm('Are you sure you want to delete this pack? This cannot be undone.')) {
      return;
    }

    setDeletingId(packId);
    try {
      const response = await fetch(`${API_URL}/api/narrow-listening/${packId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to delete pack');
      }

      // Refresh packs list
      await loadPacks();
    } catch (err) {
      console.error('Failed to delete pack:', err);
      alert('Failed to delete pack. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ready':
        return (
          <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
            Ready
          </span>
        );
      case 'generating':
        return (
          <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full flex items-center gap-1">
            <Loader className="w-3 h-3 animate-spin" />
            Generating
          </span>
        );
      case 'error':
        return (
          <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full">
            Error
          </span>
        );
      default:
        return (
          <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-100 rounded-lg">
                <Sparkles className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Narrow Listening</h1>
                <p className="text-sm text-gray-600 mt-1">
                  Practice with story variations at your level
                </p>
              </div>
            </div>
            <button type="button"
              onClick={() => navigate('/app/narrow-listening/create')}
              className="btn-primary flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Create Pack
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader className="w-8 h-8 text-purple-600 animate-spin" />
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <p className="text-red-700">{error}</p>
            <button type="button" onClick={loadPacks} className="btn-outline mt-4">
              Try Again
            </button>
          </div>
        ) : packs.length === 0 ? (
          <div className="bg-white border rounded-lg p-12 text-center">
            <div className="p-4 bg-purple-100 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-purple-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No packs yet</h3>
            <p className="text-gray-600 mb-6">
              Create your first narrow listening pack to start practicing with story variations
            </p>
            <button type="button"
              onClick={() => navigate('/app/narrow-listening/create')}
              className="btn-primary inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Create Your First Pack
            </button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {packs.map((pack) => (
              <Link
                key={pack.id}
                to={`/app/narrow-listening/${pack.id}`}
                className="bg-white border rounded-lg p-6 hover:shadow-md transition-shadow relative group"
              >
                {/* Delete Button */}
                <button type="button"
                  onClick={(e) => handleDelete(pack.id, e)}
                  disabled={deletingId === pack.id}
                  className="absolute top-4 right-4 p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                  title="Delete pack"
                >
                  {deletingId === pack.id ? (
                    <Loader className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </button>

                {/* Status Badge */}
                <div className="mb-3">{getStatusBadge(pack.status)}</div>

                {/* Title */}
                <h3 className="font-semibold text-gray-900 mb-2 pr-8">{pack.title}</h3>

                {/* Meta */}
                <div className="flex items-center gap-4 text-xs text-gray-600 mb-3">
                  <span
                    className={`px-2 py-1 rounded font-medium ${
                      pack.targetLanguage === 'zh'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {pack.targetLanguage === 'zh' ? 'Chinese' : 'Japanese'}
                  </span>
                  <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded font-medium">
                    {pack.jlptLevel || pack.hskLevel}
                  </span>
                  <span>{pack.versions?.length || 0} variations</span>
                </div>

                {/* Topic Preview */}
                <p className="text-sm text-gray-600 line-clamp-2 mb-3">{pack.topic}</p>

                {/* Created Date */}
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <Clock className="w-3 h-3" />
                  {new Date(pack.createdAt).toLocaleDateString()}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default NarrowListeningLibraryPage;
