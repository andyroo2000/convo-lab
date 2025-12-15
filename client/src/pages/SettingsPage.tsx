import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { User, Settings, Trash2, ArrowLeft, Lock, Languages, Camera, CreditCard } from 'lucide-react';
import ConfirmModal from '../components/common/ConfirmModal';
import AvatarCropperModal from '../components/admin/AvatarCropperModal';
import Toast from '../components/common/Toast';
import { LanguageCode } from '../types';
import { API_URL } from '../config';

type Tab = 'profile' | 'language' | 'security' | 'billing' | 'danger';

const AVATAR_COLORS = [
  { name: 'Indigo', value: 'indigo', bg: 'bg-indigo-100', text: 'text-indigo-600' },
  { name: 'Teal', value: 'teal', bg: 'bg-teal-100', text: 'text-teal-600' },
  { name: 'Purple', value: 'purple', bg: 'bg-purple-100', text: 'text-purple-600' },
  { name: 'Pink', value: 'pink', bg: 'bg-pink-100', text: 'text-pink-600' },
  { name: 'Emerald', value: 'emerald', bg: 'bg-emerald-100', text: 'text-emerald-600' },
  { name: 'Amber', value: 'amber', bg: 'bg-amber-100', text: 'text-amber-600' },
  { name: 'Rose', value: 'rose', bg: 'bg-rose-100', text: 'text-rose-600' },
  { name: 'Cyan', value: 'cyan', bg: 'bg-cyan-100', text: 'text-cyan-600' },
];

export default function SettingsPage() {
  const { user, updateUser, deleteAccount, changePassword } = useAuth();
  const navigate = useNavigate();
  const { tab } = useParams<{ tab?: string }>();
  const activeTab: Tab = (tab as Tab) || 'profile';

  const [displayName, setDisplayName] = useState('');
  const [selectedColor, setSelectedColor] = useState('indigo');
  const [preferredStudyLanguage, setPreferredStudyLanguage] = useState<LanguageCode>('ja');
  const [preferredNativeLanguage, setPreferredNativeLanguage] = useState<LanguageCode>('en');
  const [pinyinDisplayMode, setPinyinDisplayMode] = useState<'toneMarks' | 'toneNumbers'>('toneMarks');
  const [jlptLevel, setJlptLevel] = useState<string>('N5');
  const [hskLevel, setHskLevel] = useState<string>('HSK1');
  const [cefrLevel, setCefrLevel] = useState<string>('A1');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  // Language preferences save states
  const [proficiencySaveMessage, setProficiencySaveMessage] = useState<string | null>(null);
  const [studyLanguageSaveMessage, setStudyLanguageSaveMessage] = useState<string | null>(null);
  const [nativeLanguageSaveMessage, setNativeLanguageSaveMessage] = useState<string | null>(null);
  const [pinyinSaveMessage, setPinyinSaveMessage] = useState<string | null>(null);

  // Avatar cropper state
  const [cropperOpen, setCropperOpen] = useState(false);
  const [cropperImageUrl, setCropperImageUrl] = useState('');

  // Toast state
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('success');

  // Billing state
  const [subscriptionStatus, setSubscriptionStatus] = useState<any>(null);
  const [loadingSubscription, setLoadingSubscription] = useState(false);
  const [billingError, setBillingError] = useState<string | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage(message);
    setToastType(type);
    setToastVisible(true);
  };

  // Auto-save study language when it changes
  const handleStudyLanguageChange = async (lang: LanguageCode) => {
    setPreferredStudyLanguage(lang);
    setStudyLanguageSaveMessage(null);

    try {
      await updateUser({ preferredStudyLanguage: lang });
      setStudyLanguageSaveMessage('Saved!');
      setTimeout(() => setStudyLanguageSaveMessage(null), 2000);
    } catch (err: any) {
      setStudyLanguageSaveMessage('Failed to save');
      setTimeout(() => setStudyLanguageSaveMessage(null), 3000);
    }
  };

  // Auto-save native language when it changes
  const handleNativeLanguageChange = async (lang: LanguageCode) => {
    setPreferredNativeLanguage(lang);
    setNativeLanguageSaveMessage(null);

    try {
      await updateUser({ preferredNativeLanguage: lang });
      setNativeLanguageSaveMessage('Saved!');
      setTimeout(() => setNativeLanguageSaveMessage(null), 2000);
    } catch (err: any) {
      setNativeLanguageSaveMessage('Failed to save');
      setTimeout(() => setNativeLanguageSaveMessage(null), 3000);
    }
  };

  // Auto-save proficiency level when it changes
  const handleProficiencyLevelChange = async (level: string) => {
    const isJLPT = level.startsWith('N');
    const isHSK = level.startsWith('HSK');
    const isCEFR = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].includes(level);

    if (isJLPT) {
      setJlptLevel(level);
    } else if (isHSK) {
      setHskLevel(level);
    } else if (isCEFR) {
      setCefrLevel(level);
    }

    setProficiencySaveMessage(null);

    try {
      await updateUser({ proficiencyLevel: level });
      setProficiencySaveMessage('Saved!');
      setTimeout(() => setProficiencySaveMessage(null), 2000);
    } catch (err: any) {
      setProficiencySaveMessage('Failed to save');
      setTimeout(() => setProficiencySaveMessage(null), 3000);
    }
  };

  // Auto-save pinyin display mode when it changes
  const handlePinyinModeChange = async (mode: 'toneMarks' | 'toneNumbers') => {
    setPinyinDisplayMode(mode);
    setPinyinSaveMessage(null);

    try {
      await updateUser({ pinyinDisplayMode: mode });
      setPinyinSaveMessage('Saved!');
      setTimeout(() => setPinyinSaveMessage(null), 2000);
    } catch (err: any) {
      setPinyinSaveMessage('Failed to save');
      setTimeout(() => setPinyinSaveMessage(null), 3000);
    }
  };

  // Fetch subscription status
  const fetchSubscriptionStatus = async () => {
    setLoadingSubscription(true);
    setBillingError(null);

    try {
      const response = await fetch(`${API_URL}/api/billing/subscription-status`, {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to fetch subscription status');
      }

      const data = await response.json();
      setSubscriptionStatus(data);
    } catch (err) {
      setBillingError('Failed to load subscription information');
    } finally {
      setLoadingSubscription(false);
    }
  };

  // Open Stripe customer portal
  const handleManageSubscription = async () => {
    setLoadingSubscription(true);
    setBillingError(null);

    try {
      const response = await fetch(`${API_URL}/api/billing/create-portal-session`, {
        method: 'POST',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to create portal session');
      }

      const { url } = await response.json();
      window.location.href = url;
    } catch (err) {
      setBillingError(err instanceof Error ? err.message : 'Failed to open billing portal');
      setLoadingSubscription(false);
    }
  };

  // Upgrade to Pro
  const handleUpgradeToPro = () => {
    navigate('/pricing');
  };

  // Initialize form with user data
  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName || user.name);
      setSelectedColor(user.avatarColor || 'indigo');
      setPreferredStudyLanguage(user.preferredStudyLanguage || 'ja');
      setPreferredNativeLanguage(user.preferredNativeLanguage || 'en');
      setPinyinDisplayMode(user.pinyinDisplayMode || 'toneMarks');

      // Initialize language-specific proficiency level
      const storedLevel = user.proficiencyLevel;
      if (storedLevel) {
        // If it's a JLPT level (N1-N5), set jlptLevel
        if (storedLevel.startsWith('N')) {
          setJlptLevel(storedLevel);
        }
        // If it's an HSK level (HSK1-HSK6), set hskLevel
        else if (storedLevel.startsWith('HSK')) {
          setHskLevel(storedLevel);
        }
        // If it's a CEFR level (A1-C2), set cefrLevel
        else if (['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].includes(storedLevel)) {
          setCefrLevel(storedLevel);
        }
      }
    }
  }, [user]);

  // Fetch subscription status when billing tab is active
  useEffect(() => {
    if (activeTab === 'billing' && user) {
      fetchSubscriptionStatus();
    }
  }, [activeTab, user]);

  const hasChanges = () => {
    if (!user) return false;
    const currentDisplayName = user.displayName || user.name;
    const currentColor = user.avatarColor || 'indigo';
    const currentStudyLang = user.preferredStudyLanguage || 'ja';
    const currentNativeLang = user.preferredNativeLanguage || 'en';
    const currentPinyinMode = user.pinyinDisplayMode || 'toneMarks';

    return displayName !== currentDisplayName ||
           selectedColor !== currentColor ||
           preferredStudyLanguage !== currentStudyLang ||
           preferredNativeLanguage !== currentNativeLang ||
           pinyinDisplayMode !== currentPinyinMode;
  };

  const handleSave = async () => {
    if (!hasChanges()) {
      setError('No changes to save');
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await updateUser({
        displayName: displayName.trim() || undefined,
        avatarColor: selectedColor,
        preferredStudyLanguage,
        preferredNativeLanguage,
        pinyinDisplayMode,
      });
      setSuccess('Settings saved successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (user) {
      setDisplayName(user.displayName || user.name);
      setSelectedColor(user.avatarColor || 'indigo');
      setPreferredStudyLanguage(user.preferredStudyLanguage || 'ja');
      setPreferredNativeLanguage(user.preferredNativeLanguage || 'en');
      setPinyinDisplayMode(user.pinyinDisplayMode || 'toneMarks');

      // Reset language-specific proficiency level
      const storedLevel = user.proficiencyLevel;
      if (storedLevel) {
        if (storedLevel.startsWith('N')) {
          setJlptLevel(storedLevel);
        } else if (storedLevel.startsWith('HSK')) {
          setHskLevel(storedLevel);
        }
      }

      setError(null);
      setSuccess(null);
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      await deleteAccount();
      navigate('/login');
    } catch (err: any) {
      setError(err.message || 'Failed to delete account');
      setShowDeleteModal(false);
      setIsDeleting(false);
    }
  };

  const handleChangePassword = async () => {
    setPasswordError(null);
    setPasswordSuccess(null);

    // Validation
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('All password fields are required');
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    setIsChangingPassword(true);

    try {
      await changePassword(currentPassword, newPassword);
      setPasswordSuccess('Password changed successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSuccess(null), 3000);
    } catch (err: any) {
      setPasswordError(err.message || 'Failed to change password');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleAvatarUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const dataUrl = e.target?.result as string;
          setCropperImageUrl(dataUrl);
          setCropperOpen(true);
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };

  const handleSaveAvatarCrop = async (blob: Blob, cropArea: any) => {
    try {
      if (!user) return;

      const formData = new FormData();
      formData.append('image', blob, 'avatar.jpg');
      formData.append('cropArea', JSON.stringify(cropArea));

      const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/admin/avatars/user/${user.id}/upload`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to upload avatar');
      }

      const data = await response.json();

      // Update user context with new avatar URL
      await updateUser({ avatarUrl: data.avatarUrl });

      setSuccess('Avatar updated successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      console.error('Failed to upload avatar:', error);
      setError('Failed to upload avatar. Please try again.');
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8 pb-6 border-b-4 border-periwinkle">
        <h1 className="text-5xl font-bold text-dark-brown mb-3">Settings</h1>
        <p className="text-xl text-gray-600">Manage your account preferences</p>
      </div>

      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-2 sm:gap-3 mb-6 sm:mb-8">
        <button
          onClick={() => navigate('/app/settings/profile')}
          className={`px-4 sm:px-6 py-2 sm:py-3 rounded-lg border-2 font-bold transition-all text-sm sm:text-base ${
            activeTab === 'profile'
              ? 'border-periwinkle bg-periwinkle text-white shadow-md'
              : 'border-gray-200 bg-white text-gray-700 hover:border-periwinkle hover:bg-periwinkle-light'
          }`}
          data-testid="settings-tab-profile"
        >
          <div className="flex items-center gap-1 sm:gap-2">
            <User className="w-4 h-4" />
            <span className="hidden xs:inline">Profile</span>
          </div>
        </button>
        <button
          onClick={() => navigate('/app/settings/language')}
          className={`px-4 sm:px-6 py-2 sm:py-3 rounded-lg border-2 font-bold transition-all text-sm sm:text-base ${
            activeTab === 'language'
              ? 'border-periwinkle bg-periwinkle text-white shadow-md'
              : 'border-gray-200 bg-white text-gray-700 hover:border-periwinkle hover:bg-periwinkle-light'
          }`}
          data-testid="settings-tab-language"
        >
          <div className="flex items-center gap-1 sm:gap-2">
            <Languages className="w-4 h-4" />
            <span className="hidden xs:inline">Language</span>
          </div>
        </button>
        <button
          onClick={() => navigate('/app/settings/security')}
          className={`px-4 sm:px-6 py-2 sm:py-3 rounded-lg border-2 font-bold transition-all text-sm sm:text-base ${
            activeTab === 'security'
              ? 'border-periwinkle bg-periwinkle text-white shadow-md'
              : 'border-gray-200 bg-white text-gray-700 hover:border-periwinkle hover:bg-periwinkle-light'
          }`}
          data-testid="settings-tab-security"
        >
          <div className="flex items-center gap-1 sm:gap-2">
            <Lock className="w-4 h-4" />
            <span className="hidden xs:inline">Security</span>
          </div>
        </button>
        <button
          onClick={() => navigate('/app/settings/billing')}
          className={`px-4 sm:px-6 py-2 sm:py-3 rounded-lg border-2 font-bold transition-all text-sm sm:text-base ${
            activeTab === 'billing'
              ? 'border-periwinkle bg-periwinkle text-white shadow-md'
              : 'border-gray-200 bg-white text-gray-700 hover:border-periwinkle hover:bg-periwinkle-light'
          }`}
          data-testid="settings-tab-billing"
        >
          <div className="flex items-center gap-1 sm:gap-2">
            <CreditCard className="w-4 h-4" />
            <span className="hidden xs:inline">Billing</span>
          </div>
        </button>
        <button
          onClick={() => navigate('/app/settings/danger')}
          className={`px-4 sm:px-6 py-2 sm:py-3 rounded-lg border-2 font-bold transition-all text-sm sm:text-base ${
            activeTab === 'danger'
              ? 'border-strawberry bg-strawberry text-white shadow-md'
              : 'border-gray-200 bg-white text-gray-700 hover:border-strawberry hover:bg-strawberry-light'
          }`}
          data-testid="settings-tab-danger"
        >
          <div className="flex items-center gap-1 sm:gap-2">
            <Trash2 className="w-4 h-4" />
            <span className="hidden xs:inline">Danger Zone</span>
          </div>
        </button>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-sm text-green-700">{success}</p>
        </div>
      )}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Profile Settings Card */}
      {activeTab === 'profile' && (
        <div className="max-w-4xl mx-auto">
        <div className="bg-white border-l-8 border-periwinkle p-8 shadow-sm mb-6">
          <h2 className="text-2xl font-bold text-dark-brown mb-6">Profile Settings</h2>

          {/* Avatar */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Avatar
            </label>
            <div className="flex items-center gap-4">
              {/* Current Avatar Preview */}
              {user?.avatarUrl ? (
                <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-gray-200">
                  <img
                    src={user.avatarUrl}
                    alt="Your avatar"
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className={`w-20 h-20 ${AVATAR_COLORS.find(c => c.value === selectedColor)?.bg || 'bg-indigo-100'} rounded-full flex items-center justify-center`}>
                  <span className={`text-2xl font-medium ${AVATAR_COLORS.find(c => c.value === selectedColor)?.text || 'text-indigo-600'}`}>
                    {displayName.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}

              {/* Upload Button */}
              <button
                type="button"
                onClick={handleAvatarUpload}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
                data-testid="settings-button-upload-avatar"
              >
                <Camera className="w-4 h-4" />
                {user?.avatarUrl ? 'Change Avatar' : 'Upload Avatar'}
              </button>

              {user?.avatarUrl && (
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await updateUser({ avatarUrl: null });
                      setSuccess('Avatar removed successfully!');
                      setTimeout(() => setSuccess(null), 3000);
                    } catch (error) {
                      setError('Failed to remove avatar');
                    }
                  }}
                  className="text-sm text-red-600 hover:text-red-700"
                  data-testid="settings-button-remove-avatar"
                >
                  Remove
                </button>
              )}
            </div>
            <p className="mt-2 text-sm text-gray-500">
              Upload a custom profile picture or use your initial as your avatar
            </p>
          </div>

          {/* Display Name Section */}
          <div className="mb-8">
            <label className="block text-base font-bold text-dark-brown mb-3">
              Display Name
            </label>
            <input
              type="text"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-periwinkle focus:outline-none text-base"
              placeholder="Enter your display name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={50}
              data-testid="settings-input-display-name"
            />
            <p className="text-sm text-gray-500 mt-2">
              This is the name that will be displayed throughout the app
            </p>
          </div>

          {/* Save/Cancel Buttons */}
          <div className="flex gap-3 pt-4 border-t">
            <button
              onClick={handleSave}
              disabled={!hasChanges() || isSaving}
              className="px-8 py-3 bg-periwinkle hover:bg-periwinkle-dark text-white font-bold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="settings-button-save"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              onClick={handleCancel}
              disabled={!hasChanges() || isSaving}
              className="px-8 py-3 border-2 border-gray-300 rounded-lg font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-all"
              data-testid="settings-button-cancel"
            >
              Cancel
            </button>
          </div>
        </div>
        </div>
      )}

      {/* Language Preferences Card */}
      {activeTab === 'language' && (
        <div className="max-w-4xl mx-auto">
        <div className="bg-white border-l-8 border-periwinkle p-8 shadow-sm mb-6">
          <h2 className="text-2xl font-bold text-dark-brown mb-6">Language Preferences</h2>

        {/* Study Language */}
        <div className="mb-6">
          <label className="block text-base font-bold text-dark-brown mb-3">
            Study Language
          </label>
          <select
            value={preferredStudyLanguage}
            onChange={(e) => handleStudyLanguageChange(e.target.value as LanguageCode)}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-periwinkle focus:outline-none text-base"
            data-testid="settings-select-study-language"
          >
            {preferredNativeLanguage !== 'ja' && <option value="ja">Japanese (日本語)</option>}
            {preferredNativeLanguage !== 'zh' && <option value="zh">Mandarin Chinese (中文)</option>}
            {preferredNativeLanguage !== 'es' && <option value="es">Spanish (Español)</option>}
            {preferredNativeLanguage !== 'fr' && <option value="fr">French (Français)</option>}
            {preferredNativeLanguage !== 'ar' && <option value="ar">Arabic (العربية)</option>}
          </select>
          {studyLanguageSaveMessage && (
            <p className={`text-sm font-medium mt-2 ${studyLanguageSaveMessage === 'Saved!' ? 'text-green-600' : 'text-red-600'}`}>
              {studyLanguageSaveMessage}
            </p>
          )}
          {!studyLanguageSaveMessage && (
            <p className="text-sm text-gray-500 mt-2">
              Your primary target language for learning
            </p>
          )}
        </div>

        {/* Native Language */}
        <div className="mb-6">
          <label className="block text-base font-bold text-dark-brown mb-3">
            Native Language
          </label>
          <select
            value={preferredNativeLanguage}
            onChange={(e) => handleNativeLanguageChange(e.target.value as LanguageCode)}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-periwinkle focus:outline-none text-base"
            data-testid="settings-select-native-language"
          >
            {preferredStudyLanguage !== 'en' && <option value="en">English</option>}
            {preferredStudyLanguage !== 'es' && <option value="es">Spanish (Español)</option>}
            {preferredStudyLanguage !== 'fr' && <option value="fr">French (Français)</option>}
            {preferredStudyLanguage !== 'ar' && <option value="ar">Arabic (العربية)</option>}
            {preferredStudyLanguage !== 'zh' && <option value="zh">Chinese (中文)</option>}
            {preferredStudyLanguage !== 'ja' && <option value="ja">Japanese (日本語)</option>}
          </select>
          {nativeLanguageSaveMessage && (
            <p className={`text-sm font-medium mt-2 ${nativeLanguageSaveMessage === 'Saved!' ? 'text-green-600' : 'text-red-600'}`}>
              {nativeLanguageSaveMessage}
            </p>
          )}
          {!nativeLanguageSaveMessage && (
            <p className="text-sm text-gray-500 mt-2">
              Your first language, used for translations
            </p>
          )}
        </div>

        {/* Proficiency Level */}
        {preferredStudyLanguage === 'ja' && (
          <div className="mb-6">
            <label className="block text-base font-bold text-dark-brown mb-3">
              Current JLPT Level
            </label>
            <select
              value={jlptLevel}
              onChange={(e) => handleProficiencyLevelChange(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-periwinkle focus:outline-none text-base"
              data-testid="settings-select-jlpt-level"
            >
              <option value="N5">N5 (Beginner)</option>
              <option value="N4">N4 (Upper Beginner)</option>
              <option value="N3">N3 (Intermediate)</option>
              <option value="N2">N2 (Upper Intermediate)</option>
              <option value="N1">N1 (Advanced)</option>
            </select>
            {proficiencySaveMessage && (
              <p className={`text-sm font-medium mt-2 ${proficiencySaveMessage === 'Saved!' ? 'text-green-600' : 'text-red-600'}`}>
                {proficiencySaveMessage}
              </p>
            )}
            {!proficiencySaveMessage && (
              <p className="text-sm text-gray-500 mt-2">
                This helps us generate content at the right difficulty level
              </p>
            )}
          </div>
        )}

        {preferredStudyLanguage === 'zh' && (
          <div className="mb-6">
            <label className="block text-base font-bold text-dark-brown mb-3">
              Current HSK Level
            </label>
            <select
              value={hskLevel}
              onChange={(e) => handleProficiencyLevelChange(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-periwinkle focus:outline-none text-base"
              data-testid="settings-select-hsk-level"
            >
              <option value="HSK1">HSK 1 (Beginner)</option>
              <option value="HSK2">HSK 2 (Upper Beginner)</option>
              <option value="HSK3">HSK 3 (Intermediate)</option>
              <option value="HSK4">HSK 4 (Upper Intermediate)</option>
              <option value="HSK5">HSK 5 (Advanced)</option>
              <option value="HSK6">HSK 6 (Mastery)</option>
            </select>
            {proficiencySaveMessage && (
              <p className={`text-sm font-medium mt-2 ${proficiencySaveMessage === 'Saved!' ? 'text-green-600' : 'text-red-600'}`}>
                {proficiencySaveMessage}
              </p>
            )}
            {!proficiencySaveMessage && (
              <p className="text-sm text-gray-500 mt-2">
                This helps us generate content at the right difficulty level
              </p>
            )}
          </div>
        )}

        {/* Spanish - CEFR Levels */}
        {preferredStudyLanguage === 'es' && (
          <div className="mb-6">
            <label className="block text-base font-bold text-dark-brown mb-3">
              Spanish Proficiency Level (CEFR)
            </label>
            <select
              value={cefrLevel}
              onChange={(e) => handleProficiencyLevelChange(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-periwinkle focus:outline-none text-base"
              data-testid="settings-select-cefr-level"
            >
              <option value="A1">A1 - Beginner</option>
              <option value="A2">A2 - Elementary</option>
              <option value="B1">B1 - Intermediate</option>
              <option value="B2">B2 - Upper Intermediate</option>
              <option value="C1">C1 - Advanced</option>
              <option value="C2">C2 - Mastery</option>
            </select>
            {proficiencySaveMessage && (
              <p className={`text-sm font-medium mt-2 ${proficiencySaveMessage === 'Saved!' ? 'text-green-600' : 'text-red-600'}`}>
                {proficiencySaveMessage}
              </p>
            )}
            {!proficiencySaveMessage && (
              <p className="text-sm text-gray-500 mt-2">
                This helps us generate content at the right difficulty level
              </p>
            )}
          </div>
        )}

        {/* French - CEFR Levels */}
        {preferredStudyLanguage === 'fr' && (
          <div className="mb-6">
            <label className="block text-base font-bold text-dark-brown mb-3">
              French Proficiency Level (CEFR)
            </label>
            <select
              value={cefrLevel}
              onChange={(e) => handleProficiencyLevelChange(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-periwinkle focus:outline-none text-base"
              data-testid="settings-select-cefr-level"
            >
              <option value="A1">A1 - Beginner</option>
              <option value="A2">A2 - Elementary</option>
              <option value="B1">B1 - Intermediate</option>
              <option value="B2">B2 - Upper Intermediate</option>
              <option value="C1">C1 - Advanced</option>
              <option value="C2">C2 - Mastery</option>
            </select>
            {proficiencySaveMessage && (
              <p className={`text-sm font-medium mt-2 ${proficiencySaveMessage === 'Saved!' ? 'text-green-600' : 'text-red-600'}`}>
                {proficiencySaveMessage}
              </p>
            )}
            {!proficiencySaveMessage && (
              <p className="text-sm text-gray-500 mt-2">
                This helps us generate content at the right difficulty level
              </p>
            )}
          </div>
        )}

        {/* Arabic - CEFR Levels */}
        {preferredStudyLanguage === 'ar' && (
          <div className="mb-6">
            <label className="block text-base font-bold text-dark-brown mb-3">
              Arabic Proficiency Level (CEFR)
            </label>
            <select
              value={cefrLevel}
              onChange={(e) => handleProficiencyLevelChange(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-periwinkle focus:outline-none text-base"
              data-testid="settings-select-cefr-level"
            >
              <option value="A1">A1 - Beginner</option>
              <option value="A2">A2 - Elementary</option>
              <option value="B1">B1 - Intermediate</option>
              <option value="B2">B2 - Upper Intermediate</option>
              <option value="C1">C1 - Advanced</option>
              <option value="C2">C2 - Mastery</option>
            </select>
            {proficiencySaveMessage && (
              <p className={`text-sm font-medium mt-2 ${proficiencySaveMessage === 'Saved!' ? 'text-green-600' : 'text-red-600'}`}>
                {proficiencySaveMessage}
              </p>
            )}
            {!proficiencySaveMessage && (
              <p className="text-sm text-gray-500 mt-2">
                This helps us generate content at the right difficulty level
              </p>
            )}
          </div>
        )}

        {/* Pinyin Display Mode (only shown when study language is Chinese) */}
        {preferredStudyLanguage === 'zh' && (
          <div className="mb-6">
            <label className="block text-base font-bold text-dark-brown mb-3">
              Pinyin Display Format
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="pinyinMode"
                  value="toneMarks"
                  checked={pinyinDisplayMode === 'toneMarks'}
                  onChange={(e) => handlePinyinModeChange(e.target.value as 'toneMarks' | 'toneNumbers')}
                  className="w-4 h-4 text-periwinkle"
                  data-testid="settings-radio-pinyin-tone-marks"
                />
                <span className="text-base text-gray-700">Tone marks (nǐ hǎo)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="pinyinMode"
                  value="toneNumbers"
                  checked={pinyinDisplayMode === 'toneNumbers'}
                  onChange={(e) => handlePinyinModeChange(e.target.value as 'toneMarks' | 'toneNumbers')}
                  className="w-4 h-4 text-periwinkle"
                  data-testid="settings-radio-pinyin-tone-numbers"
                />
                <span className="text-base text-gray-700">Tone numbers (ni3 hao3)</span>
              </label>
            </div>
            {pinyinSaveMessage && (
              <p className={`text-sm font-medium mt-2 ${pinyinSaveMessage === 'Saved!' ? 'text-green-600' : 'text-red-600'}`}>
                {pinyinSaveMessage}
              </p>
            )}
            {!pinyinSaveMessage && (
              <p className="text-sm text-gray-500 mt-2">
                Choose how pinyin is displayed above Chinese characters
              </p>
            )}
          </div>
        )}
        </div>
        </div>
      )}

      {/* Change Password Card */}
      {activeTab === 'security' && (
        <div className="max-w-4xl mx-auto">
        <div className="bg-white border-l-8 border-periwinkle p-8 shadow-sm mb-6">
          <h2 className="text-2xl font-bold text-dark-brown mb-6">Change Password</h2>

        {/* Password Success/Error Messages */}
        {passwordSuccess && (
          <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-sm text-green-700">{passwordSuccess}</p>
          </div>
        )}
        {passwordError && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-700">{passwordError}</p>
          </div>
        )}

        {/* Current Password */}
        <div className="mb-4">
          <label className="block text-base font-bold text-dark-brown mb-3">
            Current Password
          </label>
          <input
            type="password"
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-periwinkle focus:outline-none text-base"
            placeholder="Enter your current password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
            data-testid="settings-input-current-password"
          />
        </div>

        {/* New Password */}
        <div className="mb-4">
          <label className="block text-base font-bold text-dark-brown mb-3">
            New Password
          </label>
          <input
            type="password"
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-periwinkle focus:outline-none text-base"
            placeholder="Enter your new password (min 8 characters)"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            data-testid="settings-input-new-password"
          />
        </div>

        {/* Confirm New Password */}
        <div className="mb-6">
          <label className="block text-base font-bold text-dark-brown mb-3">
            Confirm New Password
          </label>
          <input
            type="password"
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-periwinkle focus:outline-none text-base"
            placeholder="Confirm your new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            data-testid="settings-input-confirm-password"
          />
        </div>

        {/* Change Password Button */}
        <div className="pt-4 border-t">
          <button
            onClick={handleChangePassword}
            disabled={isChangingPassword}
            className="px-8 py-3 bg-periwinkle hover:bg-periwinkle-dark text-white font-bold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="settings-button-change-password"
          >
            {isChangingPassword ? 'Changing Password...' : 'Change Password'}
          </button>
        </div>
        </div>
        </div>
      )}

      {/* Billing Card */}
      {activeTab === 'billing' && (
        <div className="max-w-4xl mx-auto">
          <div className="bg-white border-l-8 border-periwinkle p-8 shadow-sm mb-6">
            <h2 className="text-2xl font-bold text-dark-brown mb-6">Billing & Subscription</h2>

            {billingError && (
              <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-700">{billingError}</p>
              </div>
            )}

            {loadingSubscription ? (
              <div className="text-center py-8">
                <div className="loading-spinner w-8 h-8 border-4 border-periwinkle border-t-transparent rounded-full mx-auto mb-4" />
                <p className="text-medium-brown">Loading subscription info...</p>
              </div>
            ) : (
              <>
                {/* Current Plan */}
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-dark-brown mb-4">Current Plan</h3>
                  <div className="bg-periwinkle-light border-2 border-periwinkle rounded-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="text-2xl font-bold text-dark-brown capitalize">
                          {user?.tier || 'Free'} Plan
                        </p>
                        <p className="text-medium-brown">
                          {user?.tier === 'pro' ? '$7/month' : 'Free forever'}
                        </p>
                      </div>
                      {subscriptionStatus?.status && (
                        <span
                          className={`px-3 py-1 rounded-full text-sm font-semibold ${
                            subscriptionStatus.status === 'active'
                              ? 'bg-green-100 text-green-700'
                              : subscriptionStatus.status === 'past_due'
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {subscriptionStatus.status}
                        </span>
                      )}
                    </div>

                    <div className="mb-4">
                      <p className="text-sm text-dark-brown font-medium mb-2">
                        Weekly generation limit
                      </p>
                      <p className="text-lg font-semibold text-dark-brown">
                        {user?.tier === 'pro' ? '30' : '5'} generations per week
                      </p>
                    </div>

                    {subscriptionStatus?.currentPeriodEnd && (
                      <p className="text-sm text-medium-brown">
                        {subscriptionStatus.cancelAtPeriodEnd
                          ? `Cancels on ${new Date(subscriptionStatus.currentPeriodEnd).toLocaleDateString()}`
                          : `Renews on ${new Date(subscriptionStatus.currentPeriodEnd).toLocaleDateString()}`}
                      </p>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="space-y-4">
                  {user?.tier === 'free' ? (
                    <div>
                      <button
                        onClick={handleUpgradeToPro}
                        className="btn-primary w-full"
                      >
                        Upgrade to Pro ($7/month)
                      </button>
                      <p className="text-sm text-medium-brown mt-2 text-center">
                        Get 30 generations per week and priority support
                      </p>
                    </div>
                  ) : (
                    <div>
                      <button
                        onClick={handleManageSubscription}
                        disabled={loadingSubscription}
                        className="btn-secondary w-full disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {loadingSubscription ? 'Loading...' : 'Manage Subscription'}
                      </button>
                      <p className="text-sm text-medium-brown mt-2 text-center">
                        Update payment method, view invoices, or cancel subscription
                      </p>
                    </div>
                  )}
                </div>

                {/* Plan Comparison */}
                <div className="mt-8 pt-8 border-t border-gray-200">
                  <h3 className="text-lg font-semibold text-dark-brown mb-4">
                    Need a different plan?
                  </h3>
                  <button
                    onClick={() => navigate('/pricing')}
                    className="text-periwinkle hover:text-dark-periwinkle font-medium"
                  >
                    View all plans →
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Danger Zone Card */}
      {activeTab === 'danger' && (
        <div className="max-w-4xl mx-auto">
        <div className="bg-white border-l-8 border-strawberry p-8 shadow-sm">
          <h2 className="text-2xl font-bold text-strawberry mb-6">Danger Zone</h2>
          <div className="bg-strawberry-light border-l-4 border-strawberry p-6">
            <div className="flex items-start gap-3">
              <Trash2 className="w-5 h-5 text-strawberry flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-bold text-lg text-dark-brown mb-2">Delete Account</h3>
                <p className="text-base text-gray-700 mb-3">
                  Once you delete your account, there is no going back. This will permanently delete:
                </p>
                <ul className="text-base text-gray-700 list-disc list-inside space-y-1 mb-4">
                  <li>All your dialogues and episodes</li>
                  <li>All your audio courses</li>
                  <li>All your narrow listening packs</li>
                  <li>All your chunk packs</li>
                  <li>Your account information and settings</li>
                </ul>
                <button
                  onClick={() => setShowDeleteModal(true)}
                  className="px-6 py-3 bg-strawberry text-white rounded-lg hover:bg-strawberry-dark transition-colors font-bold"
                  data-testid="settings-button-delete-account"
                >
                  Delete My Account
                </button>
              </div>
            </div>
          </div>
        </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteModal}
        title="Delete Account"
        message="Are you absolutely sure you want to delete your account? This action cannot be undone and will permanently delete all of your data including episodes, courses, narrow listening packs, and chunk packs."
        confirmLabel="Yes, Delete My Account"
        cancelLabel="Cancel"
        onConfirm={handleDeleteAccount}
        onCancel={() => setShowDeleteModal(false)}
        isLoading={isDeleting}
        variant="danger"
      />

      {/* Avatar Cropper Modal */}
      <AvatarCropperModal
        isOpen={cropperOpen}
        onClose={() => setCropperOpen(false)}
        imageUrl={cropperImageUrl}
        onSave={handleSaveAvatarCrop}
        title="Crop Profile Picture"
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
