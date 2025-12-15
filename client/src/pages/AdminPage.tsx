import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Users, Ticket, BarChart3, Search, Trash2, Copy, Plus, Check, Image, Settings, Eye } from 'lucide-react';
import AvatarCropperModal from '../components/admin/AvatarCropperModal';
import Toast from '../components/common/Toast';
import { API_URL } from '../config';

type Tab = 'users' | 'invite-codes' | 'analytics' | 'avatars' | 'settings';

interface UserData {
  id: string;
  email: string;
  name: string;
  displayName?: string;
  avatarColor?: string;
  avatarUrl?: string;
  role: string;
  tier: 'free' | 'pro';
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  stripeSubscriptionStatus?: string;
  stripePriceId?: string;
  subscriptionStartedAt?: string;
  subscriptionExpiresAt?: string;
  subscriptionCanceledAt?: string;
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

interface FeatureFlags {
  id: string;
  dialoguesEnabled: boolean;
  audioCourseEnabled: boolean;
  narrowListeningEnabled: boolean;
  processingInstructionEnabled: boolean;
  lexicalChunksEnabled: boolean;
  updatedAt: string;
}

export default function AdminPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { tab } = useParams<{ tab?: string }>();
  const activeTab: Tab = (tab as Tab) || 'users';
  const [users, setUsers] = useState<UserData[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserData[]>([]);
  const [tierFilter, setTierFilter] = useState<'all' | 'free' | 'pro' | 'canceled'>('all');
  const [inviteCodes, setInviteCodes] = useState<InviteCode[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [speakerAvatars, setSpeakerAvatars] = useState<SpeakerAvatar[]>([]);
  const [featureFlags, setFeatureFlags] = useState<FeatureFlags | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [isSavingFlags, setIsSavingFlags] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

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
      es: 'Spanish',
      fr: 'French',
      ar: 'Arabic',
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
    'es-female-casual.jpg', 'es-female-polite.jpg', 'es-female-formal.jpg',
    'es-male-casual.jpg', 'es-male-polite.jpg', 'es-male-formal.jpg',
    'fr-female-casual.jpg', 'fr-female-polite.jpg', 'fr-female-formal.jpg',
    'fr-male-casual.jpg', 'fr-male-polite.jpg', 'fr-male-formal.jpg',
    'ar-female-casual.jpg', 'ar-female-polite.jpg', 'ar-female-formal.jpg',
    'ar-male-casual.jpg', 'ar-male-polite.jpg', 'ar-male-formal.jpg',
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
    } else if (activeTab === 'settings') {
      fetchFeatureFlags();
    }
  }, [activeTab]);

  // Filter users based on tier
  useEffect(() => {
    if (tierFilter === 'all') {
      setFilteredUsers(users);
    } else if (tierFilter === 'canceled') {
      setFilteredUsers(users.filter(u => u.subscriptionCanceledAt !== null && u.subscriptionCanceledAt !== undefined));
    } else {
      setFilteredUsers(users.filter(u => u.tier === tierFilter));
    }
  }, [users, tierFilter]);

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

  const fetchSpeakerAvatars = async (bustCache = false) => {
    try {
      // Add cache-busting timestamp when needed (e.g., after upload)
      const url = bustCache
        ? `${API_URL}/api/admin/avatars/speakers?t=${Date.now()}`
        : `${API_URL}/api/admin/avatars/speakers`;

      const response = await fetch(url, {
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

  const fetchFeatureFlags = async () => {
    setIsLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_URL}/api/admin/feature-flags`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch feature flags');
      const data = await response.json();
      setFeatureFlags(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch feature flags');
    } finally {
      setIsLoading(false);
    }
  };

  const updateFeatureFlag = async (key: keyof Omit<FeatureFlags, 'id' | 'updatedAt'>, value: boolean) => {
    if (!featureFlags) return;

    // Optimistic update
    const previous = { ...featureFlags };
    setFeatureFlags({ ...featureFlags, [key]: value });

    try {
      const response = await fetch(`${API_URL}/api/admin/feature-flags`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ [key]: value }),
      });

      if (!response.ok) throw new Error('Failed to update feature flag');

      const updated = await response.json();
      setFeatureFlags(updated);
      showToast('Settings updated successfully', 'success');
    } catch (err) {
      // Revert on error
      setFeatureFlags(previous);
      showToast(err instanceof Error ? err.message : 'Failed to update settings', 'error');
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

      // Refresh speaker avatars to show the updated avatar (bust cache)
      await fetchSpeakerAvatars(true);
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

      // Refresh speaker avatars to show the updated avatar (bust cache)
      await fetchSpeakerAvatars(true);
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
      <div className="border-b border-gray-200 mb-6 overflow-x-auto">
        <nav className="flex gap-2 sm:gap-4 min-w-max">
          <Link
            to="/app/admin/users"
            className={`flex items-center gap-2 px-3 sm:px-4 py-3 border-b-2 transition-colors whitespace-nowrap text-sm sm:text-base ${
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
            className={`flex items-center gap-2 px-3 sm:px-4 py-3 border-b-2 transition-colors whitespace-nowrap text-sm sm:text-base ${
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
            className={`flex items-center gap-2 px-3 sm:px-4 py-3 border-b-2 transition-colors whitespace-nowrap text-sm sm:text-base ${
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
            className={`flex items-center gap-2 px-3 sm:px-4 py-3 border-b-2 transition-colors whitespace-nowrap text-sm sm:text-base ${
              activeTab === 'avatars'
                ? 'border-indigo text-indigo font-semibold'
                : 'border-transparent text-gray-600 hover:text-navy'
            }`}
          >
            <Image className="w-4 h-4" />
            Avatars
          </Link>
          <Link
            to="/app/admin/settings"
            className={`flex items-center gap-2 px-3 sm:px-4 py-3 border-b-2 transition-colors whitespace-nowrap text-sm sm:text-base ${
              activeTab === 'settings'
                ? 'border-indigo text-indigo font-semibold'
                : 'border-transparent text-gray-600 hover:text-navy'
            }`}
          >
            <Settings className="w-4 h-4" />
            Settings
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
          {/* Tier Filter Buttons */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setTierFilter('all')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                tierFilter === 'all'
                  ? 'bg-indigo text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All Users
            </button>
            <button
              onClick={() => setTierFilter('free')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                tierFilter === 'free'
                  ? 'bg-indigo text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Free Tier
            </button>
            <button
              onClick={() => setTierFilter('pro')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                tierFilter === 'pro'
                  ? 'bg-indigo text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Pro Tier
            </button>
            <button
              onClick={() => setTierFilter('canceled')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                tierFilter === 'canceled'
                  ? 'bg-indigo text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Canceled
            </button>
          </div>

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
            <div className="bg-white rounded-lg shadow overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                      User
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                      Role
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                      Tier
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                      Sub Status
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                      Quota
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                      Content
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                      Joined
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedUserId(u.id)}>
                      <td className="px-3 sm:px-6 py-4">
                        <div>
                          <div className="font-medium text-navy whitespace-nowrap">
                            {u.displayName || u.name}
                          </div>
                          <div className="text-sm text-gray-500 whitespace-nowrap">{u.email}</div>
                        </div>
                      </td>
                      <td className="px-3 sm:px-6 py-4">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full whitespace-nowrap ${
                            u.role === 'admin'
                              ? 'bg-purple-100 text-purple-800'
                              : u.role === 'moderator'
                              ? 'bg-blue-100 text-blue-800'
                              : u.role === 'demo'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className="px-3 sm:px-6 py-4">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full whitespace-nowrap ${
                            u.tier === 'pro'
                              ? 'bg-gradient-to-r from-periwinkle to-indigo text-white'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {u.tier}
                        </span>
                      </td>
                      <td className="px-3 sm:px-6 py-4">
                        {u.stripeSubscriptionStatus ? (
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full whitespace-nowrap ${
                              u.stripeSubscriptionStatus === 'active'
                                ? 'bg-green-100 text-green-800'
                                : u.stripeSubscriptionStatus === 'past_due'
                                ? 'bg-orange-100 text-orange-800'
                                : u.stripeSubscriptionStatus === 'canceled'
                                ? 'bg-red-100 text-red-800'
                                : u.stripeSubscriptionStatus === 'trialing'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {u.stripeSubscriptionStatus}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-3 sm:px-6 py-4 text-sm text-gray-500 whitespace-nowrap">
                        {u.tier === 'pro' ? '30/week' : '5/week'}
                      </td>
                      <td className="px-3 sm:px-6 py-4 text-sm text-gray-500 whitespace-nowrap">
                        {u._count.episodes + u._count.courses + u._count.narrowListeningPacks + u._count.chunkPacks} items
                      </td>
                      <td className="px-3 sm:px-6 py-4 text-sm text-gray-500 whitespace-nowrap">
                        {formatDate(u.createdAt)}
                      </td>
                      <td className="px-3 sm:px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => navigate(`/app/library?viewAs=${u.id}`)}
                            className="text-indigo-600 hover:text-indigo-800 transition-colors"
                            title={`View as ${u.displayName || u.name}`}
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {u.role !== 'admin' && u.id !== user.id && (
                            <button
                              onClick={() => handleDeleteUser(u.id, u.email)}
                              className="text-red-600 hover:text-red-800 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {filteredUsers.length === 0 && (
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
            <div className="bg-white rounded-lg shadow overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                      Code
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                      Status
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                      Used By
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                      Created
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {inviteCodes.map((code) => (
                    <tr key={code.id} className="hover:bg-gray-50">
                      <td className="px-3 sm:px-6 py-4">
                        <div className="flex items-center gap-2 whitespace-nowrap">
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
                      <td className="px-3 sm:px-6 py-4">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full whitespace-nowrap ${
                            code.usedBy
                              ? 'bg-gray-100 text-gray-800'
                              : 'bg-green-100 text-green-800'
                          }`}
                        >
                          {code.usedBy ? 'Used' : 'Available'}
                        </span>
                      </td>
                      <td className="px-3 sm:px-6 py-4 text-sm text-gray-500">
                        {code.user ? (
                          <div className="whitespace-nowrap">
                            <div className="font-medium">{code.user.name}</div>
                            <div className="text-xs text-gray-400">{code.user.email}</div>
                          </div>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="px-3 sm:px-6 py-4 text-sm text-gray-500 whitespace-nowrap">
                        {formatDate(code.createdAt)}
                      </td>
                      <td className="px-3 sm:px-6 py-4 text-right">
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
                      <p className="text-xs sm:text-sm text-gray-700 text-center mb-3 font-medium" title={filename}>
                        {formatAvatarTitle(filename)}
                      </p>
                      <div className="flex flex-col gap-2">
                        <button
                          onClick={() => handleRecropSpeaker(filename)}
                          className="btn-secondary text-xs sm:text-sm py-1"
                        >
                          Re-crop
                        </button>
                        <button
                          onClick={() => handleUploadNewSpeaker(filename)}
                          className="btn-primary text-xs sm:text-sm py-1"
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
                      <p className="text-xs sm:text-sm text-gray-700 text-center mb-3 font-medium" title={filename}>
                        {formatAvatarTitle(filename)}
                      </p>
                      <button
                        onClick={() => handleUploadNewSpeaker(filename)}
                        className="btn-primary text-xs sm:text-sm py-1 w-full"
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
              <div className="bg-white rounded-lg shadow overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                        User
                      </th>
                      <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                        Avatar
                      </th>
                      <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {users.map((u) => (
                      <tr key={u.id} className="hover:bg-gray-50">
                        <td className="px-3 sm:px-6 py-4">
                          <div>
                            <div className="font-medium text-navy whitespace-nowrap">
                              {u.displayName || u.name}
                            </div>
                            <div className="text-sm text-gray-500 whitespace-nowrap">{u.email}</div>
                          </div>
                        </td>
                        <td className="px-3 sm:px-6 py-4">
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
                        <td className="px-3 sm:px-6 py-4 text-right">
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
                            className="btn-primary text-xs sm:text-sm whitespace-nowrap"
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

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <div>
          <h2 className="text-xl font-semibold text-navy mb-2">Feature Visibility Settings</h2>
          <p className="text-sm text-gray-600 mb-6">
            Control which content types are visible to non-admin users. Admins can always see all content types.
          </p>

          {isLoading ? (
            <div className="text-center py-12 text-gray-500">Loading settings...</div>
          ) : featureFlags ? (
            <div className="bg-white rounded-lg shadow p-6">
              <div className="space-y-6">
                {/* Dialogues Toggle */}
                <div className="flex items-center justify-between py-4 border-b border-gray-200">
                  <div>
                    <h3 className="text-base font-semibold text-navy">Comprehensible Input Dialogues</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      AI-generated dialogues calibrated to user proficiency level
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={featureFlags.dialoguesEnabled}
                      onChange={(e) => updateFeatureFlag('dialoguesEnabled', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>

                {/* Audio Course Toggle */}
                <div className="flex items-center justify-between py-4 border-b border-gray-200">
                  <div>
                    <h3 className="text-base font-semibold text-navy">Guided Audio Course</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Audio-only lessons built from dialogues—perfect for commutes
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={featureFlags.audioCourseEnabled}
                      onChange={(e) => updateFeatureFlag('audioCourseEnabled', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>

                {/* Narrow Listening Toggle */}
                <div className="flex items-center justify-between py-4 border-b border-gray-200">
                  <div>
                    <h3 className="text-base font-semibold text-navy">Narrow Listening Packs</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      The same story told 5 different ways—deeply internalize patterns
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={featureFlags.narrowListeningEnabled}
                      onChange={(e) => updateFeatureFlag('narrowListeningEnabled', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>

                {/* Processing Instruction Toggle */}
                <div className="flex items-center justify-between py-4 border-b border-gray-200">
                  <div>
                    <h3 className="text-base font-semibold text-navy">Processing Instruction Activities</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Learn grammar through structured input—answer meaning-based questions
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={featureFlags.processingInstructionEnabled}
                      onChange={(e) => updateFeatureFlag('processingInstructionEnabled', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>

                {/* Lexical Chunks Toggle */}
                <div className="flex items-center justify-between py-4">
                  <div>
                    <h3 className="text-base font-semibold text-navy">Lexical Chunk Packs</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Acquire phrases as complete units—learn high-frequency chunks
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={featureFlags.lexicalChunksEnabled}
                      onChange={(e) => updateFeatureFlag('lexicalChunksEnabled', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>
              </div>

              <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> These settings only affect non-admin users. As an admin, you will always see all content creation options.
                </p>
              </div>
            </div>
          ) : null}
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

      {/* Subscription Details Modal */}
      {selectedUserId && (() => {
        const selectedUser = users.find(u => u.id === selectedUserId);
        if (!selectedUser) return null;

        const formatDate = (dateString: string | undefined) => {
          if (!dateString) return '-';
          return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
          });
        };

        return (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-navy">Subscription Details</h2>
                  <button
                    onClick={() => setSelectedUserId(null)}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* User Info */}
                <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                  <h3 className="font-semibold text-navy mb-2">User Information</h3>
                  <div className="space-y-1 text-sm">
                    <p><span className="font-medium">Name:</span> {selectedUser.displayName || selectedUser.name}</p>
                    <p><span className="font-medium">Email:</span> {selectedUser.email}</p>
                    <p><span className="font-medium">Role:</span> {selectedUser.role}</p>
                    <p><span className="font-medium">Tier:</span> {selectedUser.tier}</p>
                  </div>
                </div>

                {/* Subscription Details */}
                <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                  <h3 className="font-semibold text-navy mb-2">Subscription Details</h3>
                  <div className="space-y-2 text-sm">
                    {selectedUser.stripeCustomerId && (
                      <p>
                        <span className="font-medium">Stripe Customer ID:</span>{' '}
                        <a
                          href={`https://dashboard.stripe.com/customers/${selectedUser.stripeCustomerId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo hover:text-dark-periwinkle"
                        >
                          {selectedUser.stripeCustomerId}
                        </a>
                      </p>
                    )}
                    {selectedUser.stripeSubscriptionId && (
                      <p>
                        <span className="font-medium">Subscription ID:</span>{' '}
                        <a
                          href={`https://dashboard.stripe.com/subscriptions/${selectedUser.stripeSubscriptionId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo hover:text-dark-periwinkle"
                        >
                          {selectedUser.stripeSubscriptionId}
                        </a>
                      </p>
                    )}
                    {selectedUser.stripeSubscriptionStatus && (
                      <p>
                        <span className="font-medium">Status:</span>{' '}
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          selectedUser.stripeSubscriptionStatus === 'active' ? 'bg-green-100 text-green-800' :
                          selectedUser.stripeSubscriptionStatus === 'past_due' ? 'bg-orange-100 text-orange-800' :
                          selectedUser.stripeSubscriptionStatus === 'canceled' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {selectedUser.stripeSubscriptionStatus}
                        </span>
                      </p>
                    )}
                    <p><span className="font-medium">Started:</span> {formatDate(selectedUser.subscriptionStartedAt)}</p>
                    <p><span className="font-medium">Current period ends:</span> {formatDate(selectedUser.subscriptionExpiresAt)}</p>
                    <p><span className="font-medium">Canceled at:</span> {formatDate(selectedUser.subscriptionCanceledAt)}</p>
                  </div>
                </div>

                {/* Admin Actions */}
                <div className="flex gap-3">
                  {selectedUser.stripeCustomerId && (
                    <a
                      href={`https://dashboard.stripe.com/customers/${selectedUser.stripeCustomerId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-primary flex items-center gap-2"
                    >
                      <Eye className="w-4 h-4" />
                      View in Stripe
                    </a>
                  )}
                  <button
                    onClick={() => navigate(`/app/library?viewAs=${selectedUser.id}`)}
                    className="btn-secondary flex items-center gap-2"
                  >
                    <Eye className="w-4 h-4" />
                    Impersonate User
                  </button>
                  <button
                    onClick={() => setSelectedUserId(null)}
                    className="btn-secondary"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

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
