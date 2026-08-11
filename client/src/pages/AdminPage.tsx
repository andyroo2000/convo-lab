import { useEffect, useRef, useState } from 'react';
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
  TestTube,
} from 'lucide-react';
import { Area } from 'react-easy-crop';
import { useAuth } from '../contexts/AuthContext';
import AvatarCropperModal from '../components/admin/AvatarCropperModal';
import ConfirmModal from '../components/common/ConfirmModal';
import Toast from '../components/common/Toast';
import ScriptLabTab from '../components/admin/scriptLab/ScriptLabTab';
import {
  adminApi,
  getAdminFeatureFlags,
  getAdminInviteCodes,
  getAdminPronunciationDictionary,
  getAdminSpeakerAvatarOriginal,
  getAdminSpeakerAvatars,
  getAdminStats,
  getAdminUsers,
  recropAdminSpeakerAvatar,
  updateAdminFeatureFlag,
  updateAdminPronunciationDictionary,
  uploadAdminSpeakerAvatar,
  type AdminFeatureFlagKey,
  type AdminFeatureFlags,
  type AdminInviteCode,
  type AdminPronunciationDictionary,
  type AdminReadRequestInit,
  type AdminSpeakerAvatar,
  type AdminStats,
  type AdminUser,
} from '../lib/adminApi';

type Tab = 'users' | 'invite-codes' | 'analytics' | 'avatars' | 'settings' | 'script-lab';

const isAbortError = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError';

const AdminPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { tab } = useParams<{ tab?: string }>();
  const activeTab: Tab = (tab as Tab) || 'users';
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [inviteCodes, setInviteCodes] = useState<AdminInviteCode[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [speakerAvatars, setSpeakerAvatars] = useState<AdminSpeakerAvatar[]>([]);
  const [isSpeakerAvatarsLoading, setIsSpeakerAvatarsLoading] = useState(false);
  const [speakerAvatarsError, setSpeakerAvatarsError] = useState('');
  const [loadingSpeakerAvatarOriginal, setLoadingSpeakerAvatarOriginal] = useState<string | null>(
    null
  );
  const [featureFlags, setFeatureFlags] = useState<AdminFeatureFlags | null>(null);
  const [savingFeatureFlags, setSavingFeatureFlags] = useState<ReadonlySet<AdminFeatureFlagKey>>(
    () => new Set()
  );
  const [pronunciationDictionary, setPronunciationDictionary] =
    useState<AdminPronunciationDictionary | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [pronunciationLoading, setPronunciationLoading] = useState(false);
  const [pronunciationSaving, setPronunciationSaving] = useState(false);
  const [keepKanjiText, setKeepKanjiText] = useState('');
  const [forceKanaText, setForceKanaText] = useState('');
  const [verbKanaText, setVerbKanaText] = useState('');
  const [confirmAction, setConfirmAction] = useState<
    | { type: 'delete-user'; id: string; email: string }
    | { type: 'delete-invite-code'; id: string; code: string }
    | null
  >(null);
  const [isConfirmingAction, setIsConfirmingAction] = useState(false);
  const dashboardReadControllerRef = useRef<AbortController | null>(null);
  const speakerAvatarsReadControllerRef = useRef<AbortController | null>(null);
  const speakerAvatarOriginalReadControllerRef = useRef<AbortController | null>(null);
  const speakerAvatarMutationControllerRef = useRef<AbortController | null>(null);
  const featureFlagsReadControllerRef = useRef<AbortController | null>(null);
  const pronunciationReadControllerRef = useRef<AbortController | null>(null);
  const featureFlagsReadRevisionRef = useRef(0);
  const featureFlagMutationsRef = useRef(new Set<AdminFeatureFlagKey>());
  const featureFlagMutationControllersRef = useRef(new Map<AdminFeatureFlagKey, AbortController>());
  const pronunciationMutationRef = useRef(false);
  const pronunciationMutationControllerRef = useRef<AbortController | null>(null);

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
        return 'retro-admin-v3-badge retro-admin-v3-badge-admin';
      case 'moderator':
        return 'retro-admin-v3-badge retro-admin-v3-badge-moderator';
      case 'demo':
        return 'retro-admin-v3-badge retro-admin-v3-badge-demo';
      default:
        return 'retro-admin-v3-badge retro-admin-v3-badge-user';
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

  const fetchUsers = async (init?: AdminReadRequestInit) => {
    setIsLoading(true);
    setError('');
    try {
      setUsers(await getAdminUsers(searchQuery, init));
    } catch (err) {
      if (isAbortError(err)) return;
      setError(err instanceof Error ? err.message : 'Failed to fetch users');
    } finally {
      if (!init?.signal?.aborted) setIsLoading(false);
    }
  };

  const fetchInviteCodes = async (init?: AdminReadRequestInit) => {
    setIsLoading(true);
    setError('');
    try {
      setInviteCodes(await getAdminInviteCodes(init));
    } catch (err) {
      if (isAbortError(err)) return;
      setError(err instanceof Error ? err.message : 'Failed to fetch invite codes');
    } finally {
      if (!init?.signal?.aborted) setIsLoading(false);
    }
  };

  const fetchStats = async (init?: AdminReadRequestInit) => {
    setIsLoading(true);
    setError('');
    try {
      setStats(await getAdminStats(init));
    } catch (err) {
      if (isAbortError(err)) return;
      setError(err instanceof Error ? err.message : 'Failed to fetch stats');
    } finally {
      if (!init?.signal?.aborted) setIsLoading(false);
    }
  };

  const refreshDashboardRead = (
    read: (init: AdminReadRequestInit) => Promise<void>
  ): Promise<void> => {
    dashboardReadControllerRef.current?.abort();
    const controller = new AbortController();
    dashboardReadControllerRef.current = controller;

    return read({ signal: controller.signal }).finally(() => {
      if (dashboardReadControllerRef.current === controller) {
        dashboardReadControllerRef.current = null;
      }
    });
  };

  const fetchSpeakerAvatars = async (
    bustCache = false,
    init?: AdminReadRequestInit
  ): Promise<void> => {
    setIsSpeakerAvatarsLoading(true);
    setSpeakerAvatarsError('');
    try {
      setSpeakerAvatars(await getAdminSpeakerAvatars(bustCache ? Date.now() : undefined, init));
    } catch (err) {
      if (isAbortError(err)) return;
      setSpeakerAvatarsError(
        err instanceof Error ? err.message : 'Failed to fetch speaker avatars'
      );
    } finally {
      if (!init?.signal?.aborted) setIsSpeakerAvatarsLoading(false);
    }
  };

  const refreshSpeakerAvatars = (bustCache = false): Promise<void> => {
    speakerAvatarsReadControllerRef.current?.abort();
    const controller = new AbortController();
    speakerAvatarsReadControllerRef.current = controller;

    return fetchSpeakerAvatars(bustCache, { signal: controller.signal }).finally(() => {
      if (speakerAvatarsReadControllerRef.current === controller) {
        speakerAvatarsReadControllerRef.current = null;
      }
    });
  };

  const fetchFeatureFlags = async (init?: AdminReadRequestInit): Promise<void> => {
    setIsLoading(true);
    setError('');
    try {
      const data = await getAdminFeatureFlags(init);
      featureFlagsReadRevisionRef.current += 1;
      setFeatureFlags(data);
    } catch (err) {
      if (isAbortError(err)) return;
      setError(err instanceof Error ? err.message : 'Failed to fetch feature flags');
    } finally {
      if (!init?.signal?.aborted) setIsLoading(false);
    }
  };

  const refreshFeatureFlags = (): Promise<void> => {
    featureFlagsReadControllerRef.current?.abort();
    const controller = new AbortController();
    featureFlagsReadControllerRef.current = controller;

    return fetchFeatureFlags({ signal: controller.signal }).finally(() => {
      if (featureFlagsReadControllerRef.current === controller) {
        featureFlagsReadControllerRef.current = null;
      }
    });
  };

  const updateFeatureFlag = async (key: AdminFeatureFlagKey, value: boolean) => {
    if (!featureFlags || featureFlagMutationsRef.current.has(key)) return;

    const previousValue = featureFlags[key];
    const readRevision = featureFlagsReadRevisionRef.current;
    const controller = new AbortController();
    featureFlagMutationsRef.current.add(key);
    featureFlagMutationControllersRef.current.set(key, controller);
    setSavingFeatureFlags(new Set(featureFlagMutationsRef.current));

    // Optimistic update
    setFeatureFlags((current) => (current ? { ...current, [key]: value } : current));

    try {
      const updated = await updateAdminFeatureFlag(key, value, { signal: controller.signal });
      setFeatureFlags((current) => (current ? { ...current, [key]: updated[key] } : updated));
      showToast('Settings updated successfully', 'success');
    } catch (err) {
      if (isAbortError(err)) return;
      if (featureFlagsReadRevisionRef.current === readRevision) {
        setFeatureFlags((current) => (current ? { ...current, [key]: previousValue } : current));
      }
      showToast(err instanceof Error ? err.message : 'Failed to update settings', 'error');
    } finally {
      if (featureFlagMutationControllersRef.current.get(key) === controller) {
        featureFlagMutationControllersRef.current.delete(key);
        featureFlagMutationsRef.current.delete(key);
        if (!controller.signal.aborted) {
          setSavingFeatureFlags(new Set(featureFlagMutationsRef.current));
        }
      }
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

  const fetchPronunciationDictionary = async (init?: AdminReadRequestInit): Promise<void> => {
    setPronunciationLoading(true);
    try {
      const data = await getAdminPronunciationDictionary(init);
      setPronunciationDictionary(data);
      setKeepKanjiText(formatKeepKanjiText(data.keepKanji || []));
      setForceKanaText(formatForceKanaText(data.forceKana || {}));
      setVerbKanaText(formatForceKanaText(data.verbKana || {}));
    } catch (err) {
      if (isAbortError(err)) return;
      showToast(
        err instanceof Error ? err.message : 'Failed to fetch pronunciation dictionary',
        'error'
      );
    } finally {
      if (!init?.signal?.aborted) setPronunciationLoading(false);
    }
  };

  const refreshPronunciationDictionary = (): Promise<void> => {
    if (pronunciationMutationRef.current) return Promise.resolve();

    pronunciationReadControllerRef.current?.abort();
    const controller = new AbortController();
    pronunciationReadControllerRef.current = controller;

    return fetchPronunciationDictionary({ signal: controller.signal }).finally(() => {
      if (pronunciationReadControllerRef.current === controller) {
        pronunciationReadControllerRef.current = null;
      }
    });
  };

  const handleSavePronunciationDictionary = async () => {
    if (pronunciationMutationRef.current) return;

    const keepKanji = parseKeepKanjiText(keepKanjiText);
    const { entries: forceKana, errors } = parseForceKanaText(forceKanaText);
    const { entries: verbKana, errors: verbKanaErrors } = parseForceKanaText(verbKanaText);

    if (errors.length > 0) {
      showToast(errors[0], 'error');
      return;
    }
    if (verbKanaErrors.length > 0) {
      showToast(verbKanaErrors[0], 'error');
      return;
    }

    const submittedText = {
      keepKanji: keepKanjiText,
      forceKana: forceKanaText,
      verbKana: verbKanaText,
    };
    const controller = new AbortController();
    pronunciationMutationRef.current = true;
    pronunciationMutationControllerRef.current = controller;
    setPronunciationSaving(true);
    try {
      const updated = await updateAdminPronunciationDictionary(
        { keepKanji, forceKana, verbKana },
        { signal: controller.signal }
      );
      setPronunciationDictionary(updated);
      setKeepKanjiText((current) =>
        current === submittedText.keepKanji ? formatKeepKanjiText(updated.keepKanji || []) : current
      );
      setForceKanaText((current) =>
        current === submittedText.forceKana ? formatForceKanaText(updated.forceKana || {}) : current
      );
      setVerbKanaText((current) =>
        current === submittedText.verbKana ? formatForceKanaText(updated.verbKana || {}) : current
      );
      showToast('Pronunciation dictionary updated', 'success');
    } catch (err) {
      if (isAbortError(err)) return;
      showToast(
        err instanceof Error ? err.message : 'Failed to update pronunciation dictionary',
        'error'
      );
    } finally {
      if (pronunciationMutationControllerRef.current === controller) {
        pronunciationMutationControllerRef.current = null;
        pronunciationMutationRef.current = false;
        if (!controller.signal.aborted) setPronunciationSaving(false);
      }
    }
  };

  const handleConfirmAction = async () => {
    if (!confirmAction) {
      return;
    }
    setIsConfirmingAction(true);
    try {
      if (confirmAction.type === 'delete-user') {
        const response = await fetch(adminApi.user(confirmAction.id), {
          method: 'DELETE',
          credentials: 'include',
        });
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.message || 'Failed to delete user');
        }
        refreshDashboardRead(fetchUsers);
        showToast('User deleted successfully', 'success');
      } else if (confirmAction.type === 'delete-invite-code') {
        const response = await fetch(adminApi.inviteCode(confirmAction.id), {
          method: 'DELETE',
          credentials: 'include',
        });
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.message || 'Failed to delete invite code');
        }
        refreshDashboardRead(fetchInviteCodes);
        showToast('Invite code deleted successfully', 'success');
      }
    } catch (err) {
      const fallbackMessage =
        confirmAction.type === 'delete-user'
          ? 'Failed to delete user'
          : 'Failed to delete invite code';
      showToast(err instanceof Error ? err.message : fallbackMessage, 'error');
    } finally {
      setIsConfirmingAction(false);
      setConfirmAction(null);
    }
  };

  const handleCreateInviteCode = async () => {
    try {
      const response = await fetch(adminApi.inviteCodes, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({}),
      });
      if (!response.ok) throw new Error('Failed to create invite code');
      refreshDashboardRead(fetchInviteCodes);
      showToast('Invite code created successfully', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to create invite code', 'error');
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
    speakerAvatarMutationControllerRef.current?.abort();
    const controller = new AbortController();
    speakerAvatarMutationControllerRef.current = controller;

    try {
      await recropAdminSpeakerAvatar(filename, cropArea, {
        signal: controller.signal,
      });
      if (controller.signal.aborted || speakerAvatarMutationControllerRef.current !== controller) {
        return;
      }

      showToast('Speaker avatar re-cropped successfully', 'success');
      setCropperOpen(false);

      // Refresh speaker avatars to show the updated avatar (bust cache)
      await refreshSpeakerAvatars(true);
    } catch (err) {
      if (
        isAbortError(err) ||
        controller.signal.aborted ||
        speakerAvatarMutationControllerRef.current !== controller
      ) {
        return;
      }
      showToast(err instanceof Error ? err.message : 'Failed to re-crop speaker avatar', 'error');
    } finally {
      if (speakerAvatarMutationControllerRef.current === controller) {
        speakerAvatarMutationControllerRef.current = null;
      }
    }
  };

  const handleRecropSpeaker = async (filename: string) => {
    speakerAvatarOriginalReadControllerRef.current?.abort();
    const controller = new AbortController();
    speakerAvatarOriginalReadControllerRef.current = controller;
    setLoadingSpeakerAvatarOriginal(filename);

    try {
      const data = await getAdminSpeakerAvatarOriginal(filename, { signal: controller.signal });
      if (
        controller.signal.aborted ||
        speakerAvatarOriginalReadControllerRef.current !== controller
      ) {
        return;
      }

      setCropperImageUrl(data.originalUrl);
      setCropperTitle(`Re-crop ${filename}`);
      setCropperSaveHandler(() => async (_blob: Blob, cropArea: Area) => {
        await handleSaveSpeakerRecrop(filename, cropArea);
      });
      setCropperOpen(true);
    } catch (err) {
      if (
        isAbortError(err) ||
        controller.signal.aborted ||
        speakerAvatarOriginalReadControllerRef.current !== controller
      ) {
        return;
      }
      showToast(err instanceof Error ? err.message : 'Failed to load original image', 'error');
    } finally {
      if (speakerAvatarOriginalReadControllerRef.current === controller) {
        speakerAvatarOriginalReadControllerRef.current = null;
        if (!controller.signal.aborted) setLoadingSpeakerAvatarOriginal(null);
      }
    }
  };

  const handleSaveSpeakerCrop = async (filename: string, originalFile: File, cropArea: Area) => {
    speakerAvatarMutationControllerRef.current?.abort();
    const controller = new AbortController();
    speakerAvatarMutationControllerRef.current = controller;

    try {
      await uploadAdminSpeakerAvatar(filename, originalFile, cropArea, {
        signal: controller.signal,
      });
      if (controller.signal.aborted || speakerAvatarMutationControllerRef.current !== controller) {
        return;
      }

      showToast('Speaker avatar updated successfully', 'success');
      setCropperOpen(false);

      // Refresh speaker avatars to show the updated avatar (bust cache)
      await refreshSpeakerAvatars(true);
    } catch (err) {
      if (
        isAbortError(err) ||
        controller.signal.aborted ||
        speakerAvatarMutationControllerRef.current !== controller
      ) {
        return;
      }
      showToast(err instanceof Error ? err.message : 'Failed to upload speaker avatar', 'error');
    } finally {
      if (speakerAvatarMutationControllerRef.current === controller) {
        speakerAvatarMutationControllerRef.current = null;
      }
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
        setCropperSaveHandler(() => async (_blob: Blob, cropArea: Area) => {
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
      refreshDashboardRead(fetchUsers);
    } else if (activeTab === 'invite-codes') {
      refreshDashboardRead(fetchInviteCodes);
    } else if (activeTab === 'analytics') {
      refreshDashboardRead(fetchStats);
    } else if (activeTab === 'avatars') {
      setLoadingSpeakerAvatarOriginal(null);
      refreshDashboardRead(fetchUsers);
      refreshSpeakerAvatars();
    } else if (activeTab === 'settings') {
      refreshFeatureFlags();
      refreshPronunciationDictionary();
    }

    return () => {
      dashboardReadControllerRef.current?.abort();
      dashboardReadControllerRef.current = null;
      speakerAvatarsReadControllerRef.current?.abort();
      speakerAvatarsReadControllerRef.current = null;
      speakerAvatarOriginalReadControllerRef.current?.abort();
      speakerAvatarOriginalReadControllerRef.current = null;
      featureFlagsReadControllerRef.current?.abort();
      featureFlagsReadControllerRef.current = null;
      pronunciationReadControllerRef.current?.abort();
      pronunciationReadControllerRef.current = null;
    };
  }, [activeTab]);
  /* eslint-enable react-hooks/exhaustive-deps */

  useEffect(
    () => () => {
      speakerAvatarMutationControllerRef.current?.abort();
      featureFlagMutationControllersRef.current.forEach((controller) => controller.abort());
      pronunciationMutationControllerRef.current?.abort();
    },
    []
  );

  if (!user || user.role !== 'admin') {
    return null;
  }

  return (
    <div className="max-w-[80rem] mx-auto retro-admin-v3-wrap">
      <div className="retro-admin-v3-shell">
        <div className="retro-admin-v3-top">
          <h1 className="retro-admin-v3-title">Admin Dashboard</h1>
          <p className="retro-admin-v3-subtitle">Manage users, invite codes, and view analytics</p>
        </div>

        <div className="retro-admin-v3-main">
          {/* Tabs */}
          <div className="retro-admin-v3-tabs-wrap">
            <nav className="retro-admin-v3-tabs">
              <Link
                to="/app/admin/users"
                className={`retro-admin-v3-tab ${
                  activeTab === 'users' ? 'is-active border-indigo font-semibold' : ''
                }`}
              >
                <Users className="w-4 h-4" />
                Users
              </Link>
              <Link
                to="/app/admin/invite-codes"
                className={`retro-admin-v3-tab ${
                  activeTab === 'invite-codes' ? 'is-active border-indigo font-semibold' : ''
                }`}
              >
                <Ticket className="w-4 h-4" />
                Invite Codes
              </Link>
              <Link
                to="/app/admin/analytics"
                className={`retro-admin-v3-tab ${
                  activeTab === 'analytics' ? 'is-active border-indigo font-semibold' : ''
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                Analytics
              </Link>
              <Link
                to="/app/admin/avatars"
                className={`retro-admin-v3-tab ${
                  activeTab === 'avatars' ? 'is-active border-indigo font-semibold' : ''
                }`}
              >
                <Image className="w-4 h-4" />
                Avatars
              </Link>
              <Link
                to="/app/admin/settings"
                className={`retro-admin-v3-tab ${
                  activeTab === 'settings' ? 'is-active border-indigo font-semibold' : ''
                }`}
              >
                <Settings className="w-4 h-4" />
                Settings
              </Link>
              <Link
                to="/app/admin/script-lab"
                className={`retro-admin-v3-tab ${
                  activeTab === 'script-lab' ? 'is-active border-indigo font-semibold' : ''
                }`}
              >
                <TestTube className="w-4 h-4" />
                Script Lab
              </Link>
            </nav>
          </div>

          {/* Error Message */}
          {error && <div className="retro-admin-v3-alert is-error mb-6">{error}</div>}

          {/* Users Tab */}
          {activeTab === 'users' && (
            <div className="retro-admin-v3-pane">
              <div className="retro-admin-v3-search-row mb-6">
                <div className="relative flex-1 min-w-[20rem]">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search users by name or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') refreshDashboardRead(fetchUsers);
                    }}
                    className="retro-admin-v3-input pl-10"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    refreshDashboardRead(fetchUsers);
                  }}
                  className="retro-admin-v3-btn-primary shrink-0"
                >
                  Search
                </button>
              </div>

              {isLoading ? (
                <div className="text-center py-12 text-gray-500">Loading users...</div>
              ) : (
                <div className="bg-white rounded-lg shadow overflow-x-auto retro-admin-v3-table-wrap">
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
                      {users.map((u) => (
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
                              <div className="text-sm text-gray-500 whitespace-nowrap">
                                {u.email}
                              </div>
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
                                  onClick={() =>
                                    setConfirmAction({
                                      type: 'delete-user',
                                      id: u.id,
                                      email: u.email,
                                    })
                                  }
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

                  {users.length === 0 && (
                    <div className="text-center py-12 text-gray-500">No users found</div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Invite Codes Tab */}
          {activeTab === 'invite-codes' && (
            <div className="retro-admin-v3-pane">
              <div className="retro-admin-v3-pane-header mb-6">
                <div>
                  <h2 className="text-xl font-semibold text-navy">Invite Codes</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Create and manage invite codes for new users
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCreateInviteCode}
                  className="retro-admin-v3-btn-primary flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Create Code
                </button>
              </div>

              {isLoading ? (
                <div className="text-center py-12 text-gray-500">Loading invite codes...</div>
              ) : (
                <div className="bg-white rounded-lg shadow overflow-x-auto retro-admin-v3-table-wrap">
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
                                  setConfirmAction({
                                    type: 'delete-invite-code',
                                    id: code.id,
                                    code: code.code,
                                  })
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
            <div className="retro-admin-v3-pane">
              <h2 className="text-xl font-semibold text-navy mb-6">Platform Analytics</h2>

              {isLoading && <div className="text-center py-12 text-gray-500">Loading stats...</div>}
              {!isLoading && stats && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {/* Users */}
                  <div className="bg-white rounded-lg shadow p-6 retro-admin-v3-card">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-medium text-gray-600">Total Users</h3>
                      <Users className="w-5 h-5 text-indigo" />
                    </div>
                    <p className="text-3xl font-bold text-navy">{stats.users}</p>
                  </div>

                  {/* Episodes */}
                  <div className="bg-white rounded-lg shadow p-6 retro-admin-v3-card">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-medium text-gray-600">Episodes</h3>
                      <BarChart3 className="w-5 h-5 text-indigo" />
                    </div>
                    <p className="text-3xl font-bold text-navy">{stats.episodes}</p>
                  </div>

                  {/* Courses */}
                  <div className="bg-white rounded-lg shadow p-6 retro-admin-v3-card">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-medium text-gray-600">Courses</h3>
                      <BarChart3 className="w-5 h-5 text-indigo" />
                    </div>
                    <p className="text-3xl font-bold text-navy">{stats.courses}</p>
                  </div>

                  {/* Invite Codes */}
                  <div className="bg-white rounded-lg shadow p-6 retro-admin-v3-card">
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
                        Used:{' '}
                        <span className="font-semibold text-navy">{stats.inviteCodes.used}</span>
                      </p>
                      <p className="text-sm text-green-600">
                        Available:{' '}
                        <span className="font-semibold">{stats.inviteCodes.available}</span>
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Avatars Tab */}
          {activeTab === 'avatars' && (
            <div className="retro-admin-v3-pane">
              {/* Speaker Avatars Section */}
              <div className="mb-8">
                <h2 className="text-xl font-semibold text-navy mb-4">Speaker Avatars</h2>
                <p className="text-sm text-gray-600 mb-6">
                  Manage the 6 speaker avatar images used in dialogues and courses
                </p>

                {speakerAvatarsError && (
                  <div className="retro-admin-v3-alert is-error mb-6">{speakerAvatarsError}</div>
                )}

                {isSpeakerAvatarsLoading ? (
                  <div className="text-center py-12 text-gray-500">Loading speaker avatars...</div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {DEFAULT_SPEAKER_AVATARS.map((filename) => {
                      const avatar = speakerAvatars.find((a) => a.filename === filename);

                      if (avatar) {
                        // Avatar exists - show it with manage buttons
                        return (
                          <div
                            key={filename}
                            className="bg-white rounded-lg shadow p-4 retro-admin-v3-card"
                          >
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
                                disabled={loadingSpeakerAvatarOriginal === filename}
                                className="retro-admin-v3-btn-secondary text-xs sm:text-sm py-1"
                              >
                                {loadingSpeakerAvatarOriginal === filename
                                  ? 'Loading...'
                                  : 'Re-crop'}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleUploadNewSpeaker(filename)}
                                className="retro-admin-v3-btn-primary text-xs sm:text-sm py-1"
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
                          className="bg-white rounded-lg shadow p-4 border-2 border-dashed border-gray-300 retro-admin-v3-card"
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
                            className="retro-admin-v3-btn-primary text-xs sm:text-sm py-1 w-full"
                          >
                            Upload
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* User Avatars Section */}
              <div>
                <h2 className="text-xl font-semibold text-navy mb-4">User Avatars</h2>
                <p className="text-sm text-gray-600 mb-6">Manage custom avatar images for users</p>

                {isLoading ? (
                  <div className="text-center py-12 text-gray-500">Loading users...</div>
                ) : (
                  <div className="bg-white rounded-lg shadow overflow-x-auto retro-admin-v3-table-wrap">
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
                                <div className="text-sm text-gray-500 whitespace-nowrap">
                                  {u.email}
                                </div>
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
                                      setCropperTitle(
                                        `Upload Avatar for ${u.displayName || u.name}`
                                      );
                                      // Capture the file in the closure directly
                                      setCropperSaveHandler(
                                        () => async (_blob: Blob, cropArea: Area) => {
                                          try {
                                            const formData = new FormData();
                                            formData.append('image', file, `avatar.jpg`);
                                            formData.append('cropArea', JSON.stringify(cropArea));

                                            const response = await fetch(
                                              adminApi.userAvatarUpload(u.id),
                                              {
                                                method: 'POST',
                                                credentials: 'include',
                                                body: formData,
                                              }
                                            );

                                            if (!response.ok)
                                              throw new Error('Failed to upload user avatar');

                                            showToast(
                                              'User avatar updated successfully',
                                              'success'
                                            );
                                            setCropperOpen(false);

                                            // Reload users to show updated avatar
                                            refreshDashboardRead(fetchUsers);
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
            <div className="retro-admin-v3-pane">
              <h2 className="text-xl font-semibold text-navy mb-2">Feature Visibility Settings</h2>
              <p className="text-sm text-gray-600 mb-6">
                Control which content types are visible to non-admin users. Admins can always see
                all content types.
              </p>

              {isLoading && (
                <div className="text-center py-12 text-gray-500">Loading settings...</div>
              )}
              {!isLoading && featureFlags && (
                <div className="bg-white rounded-lg shadow p-6 retro-admin-v3-card">
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
                          disabled={savingFeatureFlags.has('dialoguesEnabled')}
                          onChange={(e) => updateFeatureFlag('dialoguesEnabled', e.target.checked)}
                          className="sr-only peer"
                          aria-label="Toggle AI-Generated Dialogues"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600" />
                      </label>
                    </div>

                    <div className="flex items-center justify-between py-4 border-b border-gray-200">
                      <div>
                        <h3 className="text-base font-semibold text-navy">Script Player</h3>
                        <p className="text-sm text-gray-600 mt-1">
                          Japanese script creation with timed audio and illustrations
                        </p>
                      </div>
                      <label
                        htmlFor="toggle-scripts"
                        className="relative inline-flex items-center cursor-pointer"
                      >
                        <input
                          id="toggle-scripts"
                          type="checkbox"
                          checked={featureFlags.scriptsEnabled}
                          disabled={savingFeatureFlags.has('scriptsEnabled')}
                          onChange={(e) => updateFeatureFlag('scriptsEnabled', e.target.checked)}
                          className="sr-only peer"
                          aria-label="Toggle Script Player"
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
                          disabled={savingFeatureFlags.has('audioCourseEnabled')}
                          onChange={(e) =>
                            updateFeatureFlag('audioCourseEnabled', e.target.checked)
                          }
                          className="sr-only peer"
                          aria-label="Toggle Guided Audio Course"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600" />
                      </label>
                    </div>

                    <div className="flex items-center justify-between py-4">
                      <div>
                        <h3 className="text-base font-semibold text-navy">Study / Flashcards</h3>
                        <p className="text-sm text-gray-600 mt-1">
                          Server-side Japanese SRS with import, review history, and study pages
                        </p>
                      </div>
                      <label
                        htmlFor="toggle-study"
                        className="relative inline-flex items-center cursor-pointer"
                      >
                        <input
                          id="toggle-study"
                          type="checkbox"
                          checked={featureFlags.flashcardsEnabled}
                          disabled={savingFeatureFlags.has('flashcardsEnabled')}
                          onChange={(e) => updateFeatureFlag('flashcardsEnabled', e.target.checked)}
                          className="sr-only peer"
                          aria-label="Toggle Study and Flashcards"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600" />
                      </label>
                    </div>
                  </div>

                  <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg retro-admin-v3-note">
                    <p className="text-sm text-blue-800">
                      <strong>Note:</strong> Visibility settings only affect non-admin users.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="retro-admin-v3-pane mt-10">
              <h2 className="text-xl font-semibold text-navy mb-2">Pronunciation Dictionaries</h2>
              <p className="text-sm text-gray-600 mb-6">
                Keep-kanji words stay in kanji for TTS. Force-kana words replace kanji with kana.
                Verb-kana words derive common godan stems for TTS. Enter one item per line. Kana
                formats: word=reading.
              </p>

              {pronunciationLoading ? (
                <div className="text-center py-12 text-gray-500">
                  Loading pronunciation dictionary...
                </div>
              ) : (
                <div className="bg-white rounded-lg shadow p-6 retro-admin-v3-card">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div>
                      <h3 className="text-base font-semibold text-navy mb-2">Keep-Kanji</h3>
                      <textarea
                        value={keepKanjiText}
                        onChange={(e) => setKeepKanjiText(e.target.value)}
                        rows={12}
                        className="retro-admin-v3-input w-full p-3 text-sm font-mono text-gray-800"
                        placeholder="例: 橋"
                      />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-navy mb-2">Force-Kana</h3>
                      <textarea
                        value={forceKanaText}
                        onChange={(e) => setForceKanaText(e.target.value)}
                        rows={12}
                        className="retro-admin-v3-input w-full p-3 text-sm font-mono text-gray-800"
                        placeholder="例: 北海道=ほっかいどう"
                      />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-navy mb-2">Verb-Kana</h3>
                      <textarea
                        value={verbKanaText}
                        onChange={(e) => setVerbKanaText(e.target.value)}
                        rows={12}
                        className="retro-admin-v3-input w-full p-3 text-sm font-mono text-gray-800"
                        placeholder="例: 話す=はなす"
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
                        onClick={refreshPronunciationDictionary}
                        className="retro-admin-v3-btn-secondary text-sm"
                        disabled={pronunciationSaving}
                      >
                        Reload
                      </button>
                      <button
                        type="button"
                        onClick={handleSavePronunciationDictionary}
                        className="retro-admin-v3-btn-primary text-sm"
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

          {/* Script Lab Tab */}
          {activeTab === 'script-lab' && <ScriptLabTab />}
        </div>
      </div>

      {/* Avatar Cropper Modal */}
      <AvatarCropperModal
        isOpen={cropperOpen}
        onClose={() => setCropperOpen(false)}
        imageUrl={cropperImageUrl}
        onSave={cropperSaveHandler || (async () => {})}
        title={cropperTitle}
      />

      {/* User Details Modal */}
      {selectedUserId &&
        (() => {
          const selectedUser = users.find((u) => u.id === selectedUserId);
          if (!selectedUser) return null;

          return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-navy">User Details</h2>
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
                    </div>
                  </div>

                  {/* Admin Actions */}
                  <div className="flex gap-3">
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
        isOpen={!!confirmAction}
        title={confirmAction?.type === 'delete-user' ? 'Delete User' : 'Delete Invite Code'}
        message={
          confirmAction?.type === 'delete-user'
            ? `Are you sure you want to delete user ${confirmAction?.email ?? ''}? This action cannot be undone.`
            : `Are you sure you want to delete invite code ${confirmAction?.code ?? ''}?`
        }
        confirmLabel={confirmAction?.type === 'delete-user' ? 'Delete User' : 'Delete Code'}
        onConfirm={handleConfirmAction}
        onCancel={() => setConfirmAction(null)}
        isLoading={isConfirmingAction}
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
