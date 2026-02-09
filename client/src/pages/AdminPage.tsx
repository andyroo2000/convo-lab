import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  Users,
  Ticket,
  BarChart3,
  Search,
  Trash2,
  Copy,
  Plus,
  Check,
  Image,
  Settings,
  Eye,
} from 'lucide-react';
import { Area } from 'react-easy-crop';
import { useAuth } from '../contexts/AuthContext';
import AvatarCropperModal from '../components/admin/AvatarCropperModal';
import ConfirmModal from '../components/common/ConfirmModal';
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
  isTestUser?: boolean;
  createdAt: string;
  _count: {
    episodes: number;
    courses: number;
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
  updatedAt: string;
}

interface PronunciationDictionary {
  keepKanji: string[];
  forceKana: Record<string, string>;
  updatedAt?: string;
}

const AdminPage = () => {
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
  const [pronunciationDictionary, setPronunciationDictionary] =
    useState<PronunciationDictionary | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [pronunciationLoading, setPronunciationLoading] = useState(false);
  const [pronunciationSaving, setPronunciationSaving] = useState(false);
  const [keepKanjiText, setKeepKanjiText] = useState('');
  const [forceKanaText, setForceKanaText] = useState('');
  const [confirmDeleteUser, setConfirmDeleteUser] = useState<{
    id: string;
    email: string;
  } | null>(null);
  const [confirmDeleteInviteCode, setConfirmDeleteInviteCode] = useState<{
    id: string;
    code: string;
  } | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);
  const [isDeletingInviteCode, setIsDeletingInviteCode] = useState(false);

  // Avatar cropper state
  const [cropperOpen, setCropperOpen] = useState(false);
  const [cropperImageUrl, setCropperImageUrl] = useState('');
  const [cropperTitle, setCropperTitle] = useState('');
  const [cropperSaveHandler, setCropperSaveHandler] = useState<
    ((blob: Blob, cropArea: Area) => Promise<void>) | null
  >(null);

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
    };

    // Capitalize first letter
    const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);

    const language = languageMap[parts[0]] || capitalize(parts[0]);
    const gender = capitalize(parts[1]);
    const tone = capitalize(parts[2]);

    return `${language} ${gender} - ${tone}`;
  };

  const getRoleBadgeClass = (role: string): string => {
    switch (role) {
      case 'admin':
        return 'bg-purple-100 text-purple-800';
      case 'moderator':
        return 'bg-blue-100 text-blue-800';
      case 'demo':
        return 'bg-amber-100 text-amber-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getSubscriptionStatusClass = (status: string): string => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'past_due':
        return 'bg-orange-100 text-orange-800';
      case 'canceled':
        return 'bg-red-100 text-red-800';
      case 'trialing':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getAvatarColorClass = (color?: string): string => {
    const colorMap: Record<string, string> = {
      indigo: 'bg-indigo-500',
      teal: 'bg-teal-500',
      purple: 'bg-purple-500',
      pink: 'bg-pink-500',
      emerald: 'bg-emerald-500',
      amber: 'bg-amber-500',
      rose: 'bg-rose-500',
      cyan: 'bg-cyan-500',
    };

    return color ? colorMap[color] || 'bg-indigo-500' : 'bg-indigo-500';
  };

  // Speaker avatar filenames for initial upload (when no avatars in DB)
  const DEFAULT_SPEAKER_AVATARS = [
    'ja-female-casual.jpg',
    'ja-female-polite.jpg',
    'ja-female-formal.jpg',
    'ja-male-casual.jpg',
    'ja-male-polite.jpg',
    'ja-male-formal.jpg',
  ];

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

  const updateFeatureFlag = async (
    key: keyof Omit<FeatureFlags, 'id' | 'updatedAt'>,
    value: boolean
  ) => {
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

  const formatKeepKanjiText = (keepKanji: string[]) => keepKanji.filter(Boolean).join('\n');

  const formatForceKanaText = (forceKana: Record<string, string>) =>
    Object.entries(forceKana)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([word, kana]) => `${word}=${kana}`)
      .join('\n');

  const parseKeepKanjiText = (text: string) =>
    text
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

  const parseForceKanaText = (text: string) => {
    const entries: Record<string, string> = {};
    const errors: string[] = [];

    text.split('\n').forEach((line, index) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      const parts = trimmed.split(/\s*[:=]\s*|\t/).filter(Boolean);
      if (parts.length < 2) {
        errors.push(`Line ${index + 1}: expected "word=reading"`);
        return;
      }

      const word = parts[0].trim();
      const kana = parts.slice(1).join(' ').trim();
      if (!word || !kana) {
        errors.push(`Line ${index + 1}: missing word or reading`);
        return;
      }

      entries[word] = kana;
    });

    return { entries, errors };
  };

  const fetchPronunciationDictionary = async () => {
    setPronunciationLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/admin/pronunciation-dictionaries`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch pronunciation dictionary');
      const data = (await response.json()) as PronunciationDictionary;
      setPronunciationDictionary(data);
      setKeepKanjiText(formatKeepKanjiText(data.keepKanji || []));
      setForceKanaText(formatForceKanaText(data.forceKana || {}));
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Failed to fetch pronunciation dictionary',
        'error'
      );
    } finally {
      setPronunciationLoading(false);
    }
  };

  const handleSavePronunciationDictionary = async () => {
    const keepKanji = parseKeepKanjiText(keepKanjiText);
    const { entries: forceKana, errors } = parseForceKanaText(forceKanaText);

    if (errors.length > 0) {
      showToast(errors[0], 'error');
      return;
    }

    setPronunciationSaving(true);
    try {
      const response = await fetch(`${API_URL}/api/admin/pronunciation-dictionaries`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ keepKanji, forceKana }),
      });

      if (!response.ok) throw new Error('Failed to update pronunciation dictionary');

      const updated = (await response.json()) as PronunciationDictionary;
      setPronunciationDictionary(updated);
      setKeepKanjiText(formatKeepKanjiText(updated.keepKanji || []));
      setForceKanaText(formatForceKanaText(updated.forceKana || {}));
      showToast('Pronunciation dictionary updated', 'success');
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Failed to update pronunciation dictionary',
        'error'
      );
    } finally {
      setPronunciationSaving(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!confirmDeleteUser) {
      return;
    }
    const { id } = confirmDeleteUser;
    setIsDeletingUser(true);
    try {
      const response = await fetch(`${API_URL}/api/admin/users/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to delete user');
      }
      fetchUsers();
      showToast('User deleted successfully', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete user', 'error');
    } finally {
      setIsDeletingUser(false);
      setConfirmDeleteUser(null);
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
      showToast('Invite code created successfully', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to create invite code', 'error');
    }
  };

  const handleDeleteInviteCode = async () => {
    if (!confirmDeleteInviteCode) {
      return;
    }
    const { id } = confirmDeleteInviteCode;
    setIsDeletingInviteCode(true);
    try {
      const response = await fetch(`${API_URL}/api/admin/invite-codes/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to delete invite code');
      }
      fetchInviteCodes();
      showToast('Invite code deleted successfully', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete invite code', 'error');
    } finally {
      setIsDeletingInviteCode(false);
      setConfirmDeleteInviteCode(null);
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

  // Avatar handler functions
  const handleSaveSpeakerRecrop = async (filename: string, cropArea: Area) => {
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
      setCropperSaveHandler(() => async (blob: Blob, cropArea: Area) => {
        await handleSaveSpeakerRecrop(filename, cropArea);
      });
      setCropperOpen(true);
    } catch (cropError) {
      console.error('Failed to open cropper:', cropError);
      showToast('Failed to load original image', 'error');
    }
  };

  const handleSaveSpeakerCrop = async (filename: string, originalFile: File, cropArea: Area) => {
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
        setCropperSaveHandler(() => async (blob: Blob, cropArea: Area) => {
          await handleSaveSpeakerCrop(filename, file, cropArea);
        });
        setCropperOpen(true);
      }
    };
    input.click();
  };

  // Redirect if not admin
  useEffect(() => {
    if (user && user.role !== 'admin') {
      navigate('/app/library');
    }
  }, [user, navigate]);

  // Fetch data based on active tab
  /* eslint-disable react-hooks/exhaustive-deps */
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
      fetchPronunciationDictionary();
    }
  }, [activeTab]);
  /* eslint-enable react-hooks/exhaustive-deps */

  // Filter users based on tier
  useEffect(() => {
    if (tierFilter === 'all') {
      setFilteredUsers(users);
    } else if (tierFilter === 'canceled') {
      setFilteredUsers(
        users.filter(
          (u) => u.subscriptionCanceledAt !== null && u.subscriptionCanceledAt !== undefined
        )
      );
    } else {
      setFilteredUsers(users.filter((u) => u.tier === tierFilter));
    }
  }, [users, tierFilter]);

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
              type="button"
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
              type="button"
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
              type="button"
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
              type="button"
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
            <button type="button" onClick={fetchUsers} className="btn-primary">
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
                      Test User
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
                    <tr
                      key={u.id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => setSelectedUserId(u.id)}
                    >
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
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full whitespace-nowrap ${getRoleBadgeClass(
                            u.role
                          )}`}
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
                        {u.isTestUser ? (
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
                            Test
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-3 sm:px-6 py-4">
                        {u.stripeSubscriptionStatus ? (
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full whitespace-nowrap ${getSubscriptionStatusClass(
                              u.stripeSubscriptionStatus
                            )}`}
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
                        {u._count.episodes + u._count.courses} items
                      </td>
                      <td className="px-3 sm:px-6 py-4 text-sm text-gray-500 whitespace-nowrap">
                        {formatDate(u.createdAt)}
                      </td>
                      <td
                        className="px-3 sm:px-6 py-4 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => navigate(`/app/library?viewAs=${u.id}`)}
                            className="text-indigo-600 hover:text-indigo-800 transition-colors"
                            title={`View as ${u.displayName || u.name}`}
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {u.role !== 'admin' && u.id !== user.id && (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteUser({ id: u.id, email: u.email })}
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
            <button
              type="button"
              onClick={handleCreateInviteCode}
              className="btn-primary flex items-center gap-2"
            >
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
                          <code className="font-mono font-semibold text-navy">{code.code}</code>
                          <button
                            type="button"
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
                            type="button"
                            onClick={() =>
                              setConfirmDeleteInviteCode({ id: code.id, code: code.code })
                            }
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

          {isLoading && <div className="text-center py-12 text-gray-500">Loading stats...</div>}
          {!isLoading && stats && (
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

              {/* Invite Codes */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-600">Invite Codes</h3>
                  <Ticket className="w-5 h-5 text-indigo" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-gray-600">
                    Total:{' '}
                    <span className="font-semibold text-navy">{stats.inviteCodes.total}</span>
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
          )}
        </div>
      )}

      {/* Avatars Tab */}
      {activeTab === 'avatars' && (
        <div>
          {/* Speaker Avatars Section */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-navy mb-4">Speaker Avatars</h2>
            <p className="text-sm text-gray-600 mb-6">
              Manage the 6 speaker avatar images used in dialogues and courses
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {DEFAULT_SPEAKER_AVATARS.map((filename) => {
                const avatar = speakerAvatars.find((a) => a.filename === filename);

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
                            (e.target as HTMLImageElement).src =
                              'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="128" height="128"%3E%3Crect fill="%23ddd" width="128" height="128"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%23999" font-family="sans-serif" font-size="12"%3ENo Image%3C/text%3E%3C/svg%3E';
                          }}
                        />
                      </div>
                      <p
                        className="text-xs sm:text-sm text-gray-700 text-center mb-3 font-medium"
                        title={filename}
                      >
                        {formatAvatarTitle(filename)}
                      </p>
                      <div className="flex flex-col gap-2">
                        <button
                          type="button"
                          onClick={() => handleRecropSpeaker(filename)}
                          className="btn-secondary text-xs sm:text-sm py-1"
                        >
                          Re-crop
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUploadNewSpeaker(filename)}
                          className="btn-primary text-xs sm:text-sm py-1"
                        >
                          Upload New
                        </button>
                      </div>
                    </div>
                  );
                }
                // Avatar missing - show upload placeholder
                return (
                  <div
                    key={filename}
                    className="bg-white rounded-lg shadow p-4 border-2 border-dashed border-gray-300"
                  >
                    <div className="aspect-square w-32 h-32 mx-auto mb-3 rounded-lg overflow-hidden bg-gray-50 flex items-center justify-center">
                      <svg
                        className="w-12 h-12 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 4v16m8-8H4"
                        />
                      </svg>
                    </div>
                    <p
                      className="text-xs sm:text-sm text-gray-700 text-center mb-3 font-medium"
                      title={filename}
                    >
                      {formatAvatarTitle(filename)}
                    </p>
                    <button
                      type="button"
                      onClick={() => handleUploadNewSpeaker(filename)}
                      className="btn-primary text-xs sm:text-sm py-1 w-full"
                    >
                      Upload
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* User Avatars Section */}
          <div>
            <h2 className="text-xl font-semibold text-navy mb-4">User Avatars</h2>
            <p className="text-sm text-gray-600 mb-6">Manage custom avatar images for users</p>

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
                              <div
                                className={`w-full h-full flex items-center justify-center text-white font-semibold ${getAvatarColorClass(
                                  u.avatarColor
                                )}`}
                              >
                                {(u.displayName || u.name).charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-3 sm:px-6 py-4 text-right">
                          <button
                            type="button"
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
                                  setCropperSaveHandler(
                                    () => async (blob: Blob, cropArea: Area) => {
                                      try {
                                        const formData = new FormData();
                                        formData.append('image', file, `avatar.jpg`);
                                        formData.append('cropArea', JSON.stringify(cropArea));

                                        const response = await fetch(
                                          `${API_URL}/api/admin/avatars/user/${u.id}/upload`,
                                          {
                                            method: 'POST',
                                            credentials: 'include',
                                            body: formData,
                                          }
                                        );

                                        if (!response.ok)
                                          throw new Error('Failed to upload user avatar');

                                        showToast('User avatar updated successfully', 'success');
                                        setCropperOpen(false);

                                        // Reload users to show updated avatar
                                        fetchUsers();
                                      } catch (err) {
                                        showToast(
                                          err instanceof Error
                                            ? err.message
                                            : 'Failed to upload user avatar',
                                          'error'
                                        );
                                      }
                                    }
                                  );
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
            Control which content types are visible to non-admin users. Admins can always see all
            content types.
          </p>

          {isLoading && <div className="text-center py-12 text-gray-500">Loading settings...</div>}
          {!isLoading && featureFlags && (
            <div className="bg-white rounded-lg shadow p-6">
              <div className="space-y-6">
                {/* Dialogues Toggle */}
                <div className="flex items-center justify-between py-4 border-b border-gray-200">
                  <div>
                    <h3 className="text-base font-semibold text-navy">
                      Comprehensible Input Dialogues
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      AI-generated dialogues calibrated to user proficiency level
                    </p>
                  </div>
                  <label
                    htmlFor="toggle-dialogues"
                    className="relative inline-flex items-center cursor-pointer"
                  >
                    <input
                      id="toggle-dialogues"
                      type="checkbox"
                      checked={featureFlags.dialoguesEnabled}
                      onChange={(e) => updateFeatureFlag('dialoguesEnabled', e.target.checked)}
                      className="sr-only peer"
                      aria-label="Toggle AI-Generated Dialogues"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600" />
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
                  <label
                    htmlFor="toggle-audio-course"
                    className="relative inline-flex items-center cursor-pointer"
                  >
                    <input
                      id="toggle-audio-course"
                      type="checkbox"
                      checked={featureFlags.audioCourseEnabled}
                      onChange={(e) => updateFeatureFlag('audioCourseEnabled', e.target.checked)}
                      className="sr-only peer"
                      aria-label="Toggle Guided Audio Course"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600" />
                  </label>
                </div>
              </div>

              <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> These settings only affect non-admin users. As an admin,
                  you will always see all content creation options.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="mt-10">
          <h2 className="text-xl font-semibold text-navy mb-2">Pronunciation Dictionaries</h2>
          <p className="text-sm text-gray-600 mb-6">
            Keep-kanji words stay in kanji for TTS. Force-kana words replace kanji with kana. Enter
            one item per line. Force-kana format: word=reading.
          </p>

          {pronunciationLoading ? (
            <div className="text-center py-12 text-gray-500">
              Loading pronunciation dictionary...
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-base font-semibold text-navy mb-2">Keep-Kanji</h3>
                  <textarea
                    value={keepKanjiText}
                    onChange={(e) => setKeepKanjiText(e.target.value)}
                    rows={12}
                    className="w-full border border-gray-200 rounded-md p-3 text-sm font-mono text-gray-800"
                    placeholder="例: 橋"
                  />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-navy mb-2">Force-Kana</h3>
                  <textarea
                    value={forceKanaText}
                    onChange={(e) => setForceKanaText(e.target.value)}
                    rows={12}
                    className="w-full border border-gray-200 rounded-md p-3 text-sm font-mono text-gray-800"
                    placeholder="例: 北海道=ほっかいどう"
                  />
                </div>
              </div>

              <div className="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="text-xs text-gray-500">
                  Updated:{' '}
                  {pronunciationDictionary?.updatedAt
                    ? new Date(pronunciationDictionary.updatedAt).toLocaleString()
                    : '-'}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={fetchPronunciationDictionary}
                    className="btn-secondary text-sm"
                  >
                    Reload
                  </button>
                  <button
                    type="button"
                    onClick={handleSavePronunciationDictionary}
                    className="btn-primary text-sm"
                    disabled={pronunciationSaving}
                  >
                    {pronunciationSaving ? 'Saving...' : 'Save Dictionary'}
                  </button>
                </div>
              </div>
            </div>
          )}
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
      {selectedUserId &&
        (() => {
          const selectedUser = users.find((u) => u.id === selectedUserId);
          if (!selectedUser) return null;

          const formatSubscriptionDate = (dateString: string | undefined) => {
            if (!dateString) return '-';
            return new Date(dateString).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            });
          };

          return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-navy">Subscription Details</h2>
                    <button
                      type="button"
                      onClick={() => setSelectedUserId(null)}
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <svg
                        className="w-6 h-6"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>

                  {/* User Info */}
                  <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                    <h3 className="font-semibold text-navy mb-2">User Information</h3>
                    <div className="space-y-1 text-sm">
                      <p>
                        <span className="font-medium">Name:</span>{' '}
                        {selectedUser.displayName || selectedUser.name}
                      </p>
                      <p>
                        <span className="font-medium">Email:</span> {selectedUser.email}
                      </p>
                      <p>
                        <span className="font-medium">Role:</span> {selectedUser.role}
                      </p>
                      <p>
                        <span className="font-medium">Tier:</span> {selectedUser.tier}
                      </p>
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
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getSubscriptionStatusClass(
                              selectedUser.stripeSubscriptionStatus
                            )}`}
                          >
                            {selectedUser.stripeSubscriptionStatus}
                          </span>
                        </p>
                      )}
                      <p>
                        <span className="font-medium">Started:</span>{' '}
                        {formatSubscriptionDate(selectedUser.subscriptionStartedAt)}
                      </p>
                      <p>
                        <span className="font-medium">Current period ends:</span>{' '}
                        {formatSubscriptionDate(selectedUser.subscriptionExpiresAt)}
                      </p>
                      <p>
                        <span className="font-medium">Canceled at:</span>{' '}
                        {formatSubscriptionDate(selectedUser.subscriptionCanceledAt)}
                      </p>
                    </div>
                  </div>

                  {/* Test User Settings */}
                  <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                    <h3 className="font-semibold text-navy mb-2">Test User Settings</h3>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-700">
                          Test users can access the $0.01/month test tier
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const response = await fetch(
                              `${API_URL}/api/admin/users/${selectedUser.id}/test-user`,
                              {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                credentials: 'include',
                                body: JSON.stringify({ isTestUser: !selectedUser.isTestUser }),
                              }
                            );
                            if (!response.ok) throw new Error('Failed to update test user status');

                            showToast('Test user status updated', 'success');
                            fetchUsers(); // Refresh user list
                            setSelectedUserId(null); // Close modal
                          } catch (err) {
                            showToast(
                              err instanceof Error ? err.message : 'Failed to update',
                              'error'
                            );
                          }
                        }}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                          selectedUser.isTestUser
                            ? 'bg-yellow-500 text-white hover:bg-yellow-600'
                            : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
                        }`}
                      >
                        {selectedUser.isTestUser ? 'Disable Test User' : 'Enable Test User'}
                      </button>
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
                      type="button"
                      onClick={() => navigate(`/app/library?viewAs=${selectedUser.id}`)}
                      className="btn-secondary flex items-center gap-2"
                    >
                      <Eye className="w-4 h-4" />
                      Impersonate User
                    </button>
                    <button
                      type="button"
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
      <ConfirmModal
        isOpen={!!confirmDeleteUser}
        title="Delete User"
        message={`Are you sure you want to delete user ${confirmDeleteUser?.email ?? ''}? This action cannot be undone.`}
        confirmLabel="Delete User"
        onConfirm={handleDeleteUser}
        onCancel={() => setConfirmDeleteUser(null)}
        isLoading={isDeletingUser}
        variant="danger"
      />
      <ConfirmModal
        isOpen={!!confirmDeleteInviteCode}
        title="Delete Invite Code"
        message={`Are you sure you want to delete invite code ${confirmDeleteInviteCode?.code ?? ''}?`}
        confirmLabel="Delete Code"
        onConfirm={handleDeleteInviteCode}
        onCancel={() => setConfirmDeleteInviteCode(null)}
        isLoading={isDeletingInviteCode}
        variant="danger"
      />
      <Toast
        message={toastMessage}
        type={toastType}
        isVisible={toastVisible}
        onClose={() => setToastVisible(false)}
      />
    </div>
  );
};

export default AdminPage;
