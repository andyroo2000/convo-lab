import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Users, Ticket, BarChart3, Search, Trash2, Copy, Plus, Check, Image } from 'lucide-react';
import AvatarCropperModal from '../components/admin/AvatarCropperModal';
import Toast from '../components/common/Toast';
import { API_URL } from '../config';

type Tab = 'users' | 'invite-codes' | 'analytics' | 'avatars';

interface UserData {
  id: string;
  email: string;
  name: string;
  displayName?: string;
  avatarColor?: string;
  avatarUrl?: string;
  role: string;
  createdAt: string;
  _count: {
    episodes: number;
    courses: number;
    narrowListeningPacks: number;
    chunkPacks: number;
  };
}

interface InviteCode {
  id: string;
  code: string;
  usedBy: string | null;
  usedAt: string | null;
  createdAt: string;
  user?: {
    id: string;
    email: string;
    name: string;
  };
}

interface Stats {
  users: number;
  episodes: number;
  courses: number;
  narrowListeningPacks: number;
  chunkPacks: number;
  inviteCodes: {
    total: number;
    used: number;
    available: number;
  };
}

interface SpeakerAvatar {
  id: string;
  filename: string;
  croppedUrl: string;
  originalUrl: string;
  language: string;
  gender: string;
  tone: string;
  createdAt: string;
  updatedAt: string;
}

export default function AdminPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { tab } = useParams<{ tab?: string }>();
  const activeTab: Tab = (tab as Tab) || 'users';
  const [users, setUsers] = useState<UserData[]>([]);
  const [inviteCodes, setInviteCodes] = useState<InviteCode[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [speakerAvatars, setSpeakerAvatars] = useState<SpeakerAvatar[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Avatar cropper state
  const [cropperOpen, setCropperOpen] = useState(false);
  const [cropperImageUrl, setCropperImageUrl] = useState('');
  const [cropperTitle, setCropperTitle] = useState('');
  const [cropperSaveHandler, setCropperSaveHandler] = useState<((blob: Blob, cropArea: any) => Promise<void>) | null>(null);

  // Toast state
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('success');

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage(message);
    setToastType(type);
    setToastVisible(true);
  };

  // Helper function to format avatar filename to human-friendly title
  const formatAvatarTitle = (filename: string): string => {
    // Remove file extension
    const nameWithoutExt = filename.replace(/\.(jpg|jpeg|png|webp)$/i, '');

    // Split by dash: ja-female-casual -> ["ja", "female", "casual"]
    const parts = nameWithoutExt.split('-');

    // Map language codes
    const languageMap: { [key: string]: string } = {
      ja: 'Japanese',
      zh: 'Chinese',
    };

    // Capitalize first letter
    const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);

    const language = languageMap[parts[0]] || capitalize(parts[0]);
    const gender = capitalize(parts[1]);
    const tone = capitalize(parts[2]);

    return `${language} ${gender} - ${tone}`;
  };

  // Speaker avatar filenames for initial upload (when no avatars in DB)
  const DEFAULT_SPEAKER_AVATARS = [
    'ja-female-casual.jpg', 'ja-female-polite.jpg', 'ja-female-formal.jpg',
    'ja-male-casual.jpg', 'ja-male-polite.jpg', 'ja-male-formal.jpg',
    'zh-female-casual.jpg', 'zh-female-polite.jpg', 'zh-female-formal.jpg',
    'zh-male-casual.jpg', 'zh-male-polite.jpg', 'zh-male-formal.jpg',
  ];

  // Redirect if not admin
  useEffect(() => {
    if (user && user.role !== 'admin') {
      navigate('/app/library');
    }
  }, [user, navigate]);

  // Fetch data based on active tab
  useEffect(() => {
    if (activeTab === 'users') {
      fetchUsers();
    } else if (activeTab === 'invite-codes') {
      fetchInviteCodes();
    } else if (activeTab === 'analytics') {
      fetchStats();
    } else if (activeTab === 'avatars') {
      fetchUsers();
      fetchSpeakerAvatars();
    }
  }, [activeTab]);

  const fetchUsers = async () => {
    setIsLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_URL}/api/admin/users?search=${searchQuery}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch users');
      const data = await response.json();
      setUsers(data.users);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch users');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchInviteCodes = async () => {
    setIsLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_URL}/api/admin/invite-codes`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch invite codes');
      const data = await response.json();
      setInviteCodes(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch invite codes');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStats = async () => {
    setIsLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_URL}/api/admin/stats`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch stats');
      const data = await response.json();
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch stats');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSpeakerAvatars = async () => {
    try {
      const response = await fetch(`${API_URL}/api/admin/avatars/speakers`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch speaker avatars');
      const data = await response.json();
      setSpeakerAvatars(data);
    } catch (err) {
      console.error('Failed to fetch speaker avatars:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteUser = async (userId: string, userEmail: string) => {
    if (!confirm(`Are you sure you want to delete user ${userEmail}? This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/admin/users/${userId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to delete user');
      }
      fetchUsers();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete user');
    }
  };

  const handleCreateInviteCode = async () => {
    try {
      const response = await fetch(`${API_URL}/api/admin/invite-codes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({}),
      });
      if (!response.ok) throw new Error('Failed to create invite code');
      fetchInviteCodes();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create invite code');
    }
  };

  const handleDeleteInviteCode = async (codeId: string, code: string) => {
    if (!confirm(`Are you sure you want to delete invite code ${code}?`)) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/admin/invite-codes/${codeId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to delete invite code');
      }
      fetchInviteCodes();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete invite code');
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Avatar handler functions
  const handleRecropSpeaker = async (filename: string) => {
    try {
      // Fetch the original image URL from the API
      const response = await fetch(`${API_URL}/api/admin/avatars/speaker/${filename}/original`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch original avatar URL');
      const data = await response.json();

      setCropperImageUrl(data.originalUrl);
      setCropperTitle(`Re-crop ${filename}`);
      setCropperSaveHandler(() => async (blob: Blob, cropArea: any) => {
        await handleSaveSpeakerRecrop(filename, cropArea);
      });
      setCropperOpen(true);
    } catch (error) {
      console.error('Failed to open cropper:', error);
      showToast('Failed to load original image', 'error');
    }
  };

  const handleSaveSpeakerRecrop = async (filename: string, cropArea: any) => {
    try {
      const response = await fetch(`${API_URL}/api/admin/avatars/speaker/${filename}/recrop`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ cropArea }),
      });

      if (!response.ok) throw new Error('Failed to re-crop speaker avatar');

      showToast('Speaker avatar re-cropped successfully', 'success');
      setCropperOpen(false);

      // Refresh speaker avatars to show the updated avatar
      await fetchSpeakerAvatars();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to re-crop speaker avatar', 'error');
    }
  };

  const handleUploadNewSpeaker = async (filename: string) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const url = URL.createObjectURL(file);
        setCropperImageUrl(url);
        setCropperTitle(`Upload New ${filename}`);
        // Capture the file in the closure directly instead of relying on state
        setCropperSaveHandler(() => async (blob: Blob, cropArea: any) => {
          await handleSaveSpeakerCrop(filename, file, cropArea);
        });
        setCropperOpen(true);
      }
    };
    input.click();
  };

  const handleSaveSpeakerCrop = async (filename: string, originalFile: File, cropArea: any) => {
    try {
      const formData = new FormData();
      formData.append('image', originalFile, filename);
      formData.append('cropArea', JSON.stringify(cropArea));

      const response = await fetch(`${API_URL}/api/admin/avatars/speaker/${filename}/upload`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      if (!response.ok) throw new Error('Failed to upload speaker avatar');

      showToast('Speaker avatar updated successfully', 'success');
      setCropperOpen(false);

      // Refresh speaker avatars to show the updated avatar
      await fetchSpeakerAvatars();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to upload speaker avatar', 'error');
    }
  };

  if (!user || user.role !== 'admin') {
    return null;
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-navy mb-2">Admin Dashboard</h1>
        <p className="text-gray-600">Manage users, invite codes, and view analytics</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-4">
          <Link
            to="/app/admin/users"
            className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
              activeTab === 'users'
                ? 'border-indigo text-indigo font-semibold'
                : 'border-transparent text-gray-600 hover:text-navy'
            }`}
          >
            <Users className="w-4 h-4" />
            Users
          </Link>
          <Link
            to="/app/admin/invite-codes"
            className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
              activeTab === 'invite-codes'
                ? 'border-indigo text-indigo font-semibold'
                : 'border-transparent text-gray-600 hover:text-navy'
            }`}
          >
            <Ticket className="w-4 h-4" />
            Invite Codes
          </Link>
          <Link
            to="/app/admin/analytics"
            className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
              activeTab === 'analytics'
                ? 'border-indigo text-indigo font-semibold'
                : 'border-transparent text-gray-600 hover:text-navy'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Analytics
          </Link>
          <Link
            to="/app/admin/avatars"
            className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
              activeTab === 'avatars'
                ? 'border-indigo text-indigo font-semibold'
                : 'border-transparent text-gray-600 hover:text-navy'
            }`}
          >
            <Image className="w-4 h-4" />
            Avatars
          </Link>
        </nav>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div>
          <div className="flex items-center gap-4 mb-6">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search users by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchUsers()}
                className="input pl-10"
              />
            </div>
            <button onClick={fetchUsers} className="btn-primary">
              Search
            </button>
          </div>

          {isLoading ? (
            <div className="text-center py-12 text-gray-500">Loading users...</div>
          ) : (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Role
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Content
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Joined
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div>
                          <div className="font-medium text-navy">
                            {u.displayName || u.name}
                          </div>
                          <div className="text-sm text-gray-500">{u.email}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            u.role === 'admin'
                              ? 'bg-purple-100 text-purple-800'
                              : u.role === 'moderator'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {u._count.episodes + u._count.courses + u._count.narrowListeningPacks + u._count.chunkPacks} items
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {formatDate(u.createdAt)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {u.role !== 'admin' && u.id !== user.id && (
                          <button
                            onClick={() => handleDeleteUser(u.id, u.email)}
                            className="text-red-600 hover:text-red-800 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {users.length === 0 && (
                <div className="text-center py-12 text-gray-500">No users found</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Invite Codes Tab */}
      {activeTab === 'invite-codes' && (
        <div>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold text-navy">Invite Codes</h2>
              <p className="text-sm text-gray-600 mt-1">
                Create and manage invite codes for new users
              </p>
            </div>
            <button onClick={handleCreateInviteCode} className="btn-primary flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Create Code
            </button>
          </div>

          {isLoading ? (
            <div className="text-center py-12 text-gray-500">Loading invite codes...</div>
          ) : (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Code
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Used By
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Created
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {inviteCodes.map((code) => (
                    <tr key={code.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <code className="font-mono font-semibold text-navy">
                            {code.code}
                          </code>
                          <button
                            onClick={() => handleCopyCode(code.code)}
                            className="text-gray-400 hover:text-indigo transition-colors"
                            title="Copy code"
                          >
                            {copiedCode === code.code ? (
                              <Check className="w-4 h-4 text-green-600" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            code.usedBy
                              ? 'bg-gray-100 text-gray-800'
                              : 'bg-green-100 text-green-800'
                          }`}
                        >
                          {code.usedBy ? 'Used' : 'Available'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {code.user ? (
                          <div>
                            <div className="font-medium">{code.user.name}</div>
                            <div className="text-xs text-gray-400">{code.user.email}</div>
                          </div>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {formatDate(code.createdAt)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {!code.usedBy && (
                          <button
                            onClick={() => handleDeleteInviteCode(code.id, code.code)}
                            className="text-red-600 hover:text-red-800 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {inviteCodes.length === 0 && (
                <div className="text-center py-12 text-gray-500">No invite codes found</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && (
        <div>
          <h2 className="text-xl font-semibold text-navy mb-6">Platform Analytics</h2>

          {isLoading ? (
            <div className="text-center py-12 text-gray-500">Loading stats...</div>
          ) : stats ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Users */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-600">Total Users</h3>
                  <Users className="w-5 h-5 text-indigo" />
                </div>
                <p className="text-3xl font-bold text-navy">{stats.users}</p>
              </div>

              {/* Episodes */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-600">Episodes</h3>
                  <BarChart3 className="w-5 h-5 text-indigo" />
                </div>
                <p className="text-3xl font-bold text-navy">{stats.episodes}</p>
              </div>

              {/* Courses */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-600">Courses</h3>
                  <BarChart3 className="w-5 h-5 text-indigo" />
                </div>
                <p className="text-3xl font-bold text-navy">{stats.courses}</p>
              </div>

              {/* Narrow Listening Packs */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-600">Listening Packs</h3>
                  <BarChart3 className="w-5 h-5 text-indigo" />
                </div>
                <p className="text-3xl font-bold text-navy">{stats.narrowListeningPacks}</p>
              </div>

              {/* Chunk Packs */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-600">Chunk Packs</h3>
                  <BarChart3 className="w-5 h-5 text-indigo" />
                </div>
                <p className="text-3xl font-bold text-navy">{stats.chunkPacks}</p>
              </div>

              {/* Invite Codes */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-600">Invite Codes</h3>
                  <Ticket className="w-5 h-5 text-indigo" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-gray-600">
                    Total: <span className="font-semibold text-navy">{stats.inviteCodes.total}</span>
                  </p>
                  <p className="text-sm text-gray-600">
                    Used: <span className="font-semibold text-navy">{stats.inviteCodes.used}</span>
                  </p>
                  <p className="text-sm text-green-600">
                    Available: <span className="font-semibold">{stats.inviteCodes.available}</span>
                  </p>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* Avatars Tab */}
      {activeTab === 'avatars' && (
        <div>
          {/* Speaker Avatars Section */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-navy mb-4">Speaker Avatars</h2>
            <p className="text-sm text-gray-600 mb-6">
              Manage the 12 speaker avatar images used in dialogues and courses
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {DEFAULT_SPEAKER_AVATARS.map((filename) => {
                const avatar = speakerAvatars.find(a => a.filename === filename);

                if (avatar) {
                  // Avatar exists - show it with manage buttons
                  return (
                    <div key={filename} className="bg-white rounded-lg shadow p-4">
                      <div className="aspect-square w-32 h-32 mx-auto mb-3 rounded-lg overflow-hidden bg-gray-100">
                        <img
                          src={avatar.croppedUrl}
                          alt={filename}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="128" height="128"%3E%3Crect fill="%23ddd" width="128" height="128"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%23999" font-family="sans-serif" font-size="12"%3ENo Image%3C/text%3E%3C/svg%3E';
                          }}
                        />
                      </div>
                      <p className="text-sm text-gray-700 text-center mb-3 font-medium" title={filename}>
                        {formatAvatarTitle(filename)}
                      </p>
                      <div className="flex flex-col gap-2">
                        <button
                          onClick={() => handleRecropSpeaker(filename)}
                          className="btn-secondary text-sm py-1"
                        >
                          Re-crop
                        </button>
                        <button
                          onClick={() => handleUploadNewSpeaker(filename)}
                          className="btn-primary text-sm py-1"
                        >
                          Upload New
                        </button>
                      </div>
                    </div>
                  );
                } else {
                  // Avatar missing - show upload placeholder
                  return (
                    <div key={filename} className="bg-white rounded-lg shadow p-4 border-2 border-dashed border-gray-300">
                      <div className="aspect-square w-32 h-32 mx-auto mb-3 rounded-lg overflow-hidden bg-gray-50 flex items-center justify-center">
                        <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      </div>
                      <p className="text-sm text-gray-700 text-center mb-3 font-medium" title={filename}>
                        {formatAvatarTitle(filename)}
                      </p>
                      <button
                        onClick={() => handleUploadNewSpeaker(filename)}
                        className="btn-primary text-sm py-1 w-full"
                      >
                        Upload
                      </button>
                    </div>
                  );
                }
              })}
            </div>
          </div>

          {/* User Avatars Section */}
          <div>
            <h2 className="text-xl font-semibold text-navy mb-4">User Avatars</h2>
            <p className="text-sm text-gray-600 mb-6">
              Manage custom avatar images for users
            </p>

            {isLoading ? (
              <div className="text-center py-12 text-gray-500">Loading users...</div>
            ) : (
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        User
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Avatar
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {users.map((u) => (
                      <tr key={u.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div>
                            <div className="font-medium text-navy">
                              {u.displayName || u.name}
                            </div>
                            <div className="text-sm text-gray-500">{u.email}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center">
                            {u.avatarUrl ? (
                              <img
                                src={u.avatarUrl}
                                alt={u.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className={`w-full h-full flex items-center justify-center text-white font-semibold ${
                                u.avatarColor === 'indigo' ? 'bg-indigo-500' :
                                u.avatarColor === 'teal' ? 'bg-teal-500' :
                                u.avatarColor === 'purple' ? 'bg-purple-500' :
                                u.avatarColor === 'pink' ? 'bg-pink-500' :
                                u.avatarColor === 'emerald' ? 'bg-emerald-500' :
                                u.avatarColor === 'amber' ? 'bg-amber-500' :
                                u.avatarColor === 'rose' ? 'bg-rose-500' :
                                u.avatarColor === 'cyan' ? 'bg-cyan-500' : 'bg-indigo-500'
                              }`}>
                                {(u.displayName || u.name).charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => {
                              const input = document.createElement('input');
                              input.type = 'file';
                              input.accept = 'image/*';
                              input.onchange = async (e) => {
                                const file = (e.target as HTMLInputElement).files?.[0];
                                if (file) {
                                  const url = URL.createObjectURL(file);
                                  setCropperImageUrl(url);
                                  setCropperTitle(`Upload Avatar for ${u.displayName || u.name}`);
                                  // Capture the file in the closure directly
                                  setCropperSaveHandler(() => async (blob: Blob, cropArea: any) => {
                                    try {
                                      const formData = new FormData();
                                      formData.append('image', file, `avatar.jpg`);
                                      formData.append('cropArea', JSON.stringify(cropArea));

                                      const response = await fetch(`${API_URL}/api/admin/avatars/user/${u.id}/upload`, {
                                        method: 'POST',
                                        credentials: 'include',
                                        body: formData,
                                      });

                                      if (!response.ok) throw new Error('Failed to upload user avatar');

                                      alert('User avatar updated successfully');
                                      setCropperOpen(false);

                                      // Reload users to show updated avatar
                                      fetchUsers();
                                    } catch (err) {
                                      alert(err instanceof Error ? err.message : 'Failed to upload user avatar');
                                    }
                                  });
                                  setCropperOpen(true);
                                }
                              };
                              input.click();
                            }}
                            className="btn-primary text-sm"
                          >
                            Upload Avatar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {users.length === 0 && (
                  <div className="text-center py-12 text-gray-500">No users found</div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Avatar Cropper Modal */}
      <AvatarCropperModal
        isOpen={cropperOpen}
        onClose={() => setCropperOpen(false)}
        imageUrl={cropperImageUrl}
        onSave={cropperSaveHandler || (async () => {})}
        title={cropperTitle}
      />

      {/* Toast Notification */}
      <Toast
        message={toastMessage}
        type={toastType}
        isVisible={toastVisible}
        onClose={() => setToastVisible(false)}
      />
    </div>
  );
}
