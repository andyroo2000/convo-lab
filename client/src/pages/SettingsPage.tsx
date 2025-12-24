import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation(['settings', 'common']);
  const { user, updateUser, deleteAccount, changePassword, refreshUser } = useAuth();
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
      setStudyLanguageSaveMessage(t('settings:messages.saved'));
      setTimeout(() => setStudyLanguageSaveMessage(null), 2000);
    } catch (err: any) {
      setStudyLanguageSaveMessage(t('settings:messages.failedToSave'));
      setTimeout(() => setStudyLanguageSaveMessage(null), 3000);
    }
  };

  // Auto-save native language when it changes
  const handleNativeLanguageChange = async (lang: LanguageCode) => {
    setPreferredNativeLanguage(lang);
    setNativeLanguageSaveMessage(null);

    try {
      await updateUser({ preferredNativeLanguage: lang });
      setNativeLanguageSaveMessage(t('settings:messages.saved'));
      setTimeout(() => setNativeLanguageSaveMessage(null), 2000);
    } catch (err: any) {
      setNativeLanguageSaveMessage(t('settings:messages.failedToSave'));
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
      setProficiencySaveMessage(t('settings:messages.saved'));
      setTimeout(() => setProficiencySaveMessage(null), 2000);
    } catch (err: any) {
      setProficiencySaveMessage(t('settings:messages.failedToSave'));
      setTimeout(() => setProficiencySaveMessage(null), 3000);
    }
  };

  // Auto-save pinyin display mode when it changes
  const handlePinyinModeChange = async (mode: 'toneMarks' | 'toneNumbers') => {
    setPinyinDisplayMode(mode);
    setPinyinSaveMessage(null);

    try {
      await updateUser({ pinyinDisplayMode: mode });
      setPinyinSaveMessage(t('settings:messages.saved'));
      setTimeout(() => setPinyinSaveMessage(null), 2000);
    } catch (err: any) {
      setPinyinSaveMessage(t('settings:messages.failedToSave'));
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
      setBillingError(t('settings:billing.errors.loadSubscription'));
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
      setBillingError(err instanceof Error ? err.message : t('settings:billing.errors.createPortal'));
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
    if (activeTab === 'billing') {
      // Refresh user data to get latest tier info
      refreshUser();
      fetchSubscriptionStatus();
    }
  }, [activeTab]);

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
      setError(t('settings:messages.noChanges'));
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
      setSuccess(t('settings:messages.saveSuccess'));
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || t('settings:messages.failedToSave'));
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
      setError(err.message || t('settings:messages.deleteError'));
      setShowDeleteModal(false);
      setIsDeleting(false);
    }
  };

  const handleChangePassword = async () => {
    setPasswordError(null);
    setPasswordSuccess(null);

    // Validation
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError(t('settings:security.errors.required'));
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError(t('settings:security.errors.tooShort'));
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError(t('settings:security.errors.mismatch'));
      return;
    }

    setIsChangingPassword(true);

    try {
      await changePassword(currentPassword, newPassword);
      setPasswordSuccess(t('settings:security.success'));
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSuccess(null), 3000);
    } catch (err: any) {
      setPasswordError(err.message || t('settings:messages.failedToSave'));
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

      setSuccess(t('settings:profile.avatar.uploadSuccess'));
      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      console.error('Failed to upload avatar:', error);
      setError(t('settings:profile.avatar.uploadError'));
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8 pb-6 border-b-4 border-periwinkle">
        <h1 className="text-5xl font-bold text-dark-brown mb-3">{t('settings:title')}</h1>
        <p className="text-xl text-gray-600">{t('settings:subtitle')}</p>
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
            <span className="hidden xs:inline">{t('settings:tabs.profile')}</span>
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
            <span className="hidden xs:inline">{t('settings:tabs.language')}</span>
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
            <span className="hidden xs:inline">{t('settings:tabs.security')}</span>
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
            <span className="hidden xs:inline">{t('settings:tabs.billing')}</span>
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
            <span className="hidden xs:inline">{t('settings:tabs.danger')}</span>
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
          <h2 className="text-2xl font-bold text-dark-brown mb-6">{t('settings:profile.title')}</h2>

          {/* Avatar */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              {t('settings:profile.avatar.label')}
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
                {user?.avatarUrl ? t('settings:profile.avatar.change') : t('settings:profile.avatar.upload')}
              </button>

              {user?.avatarUrl && (
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await updateUser({ avatarUrl: null });
                      setSuccess(t('settings:profile.avatar.removeSuccess'));
                      setTimeout(() => setSuccess(null), 3000);
                    } catch (error) {
                      setError(t('settings:profile.avatar.removeError'));
                    }
                  }}
                  className="text-sm text-red-600 hover:text-red-700"
                  data-testid="settings-button-remove-avatar"
                >
                  {t('settings:profile.avatar.remove')}
                </button>
              )}
            </div>
            <p className="mt-2 text-sm text-gray-500">
              {t('settings:profile.avatar.helper')}
            </p>
          </div>

          {/* Display Name Section */}
          <div className="mb-8">
            <label className="block text-base font-bold text-dark-brown mb-3">
              {t('settings:profile.displayName.label')}
            </label>
            <input
              type="text"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-periwinkle focus:outline-none text-base"
              placeholder={t('settings:profile.displayName.placeholder')}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={50}
              data-testid="settings-input-display-name"
            />
            <p className="text-sm text-gray-500 mt-2">
              {t('settings:profile.displayName.helper')}
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
              {isSaving ? t('settings:profile.saving') : t('settings:profile.saveButton')}
            </button>
            <button
              onClick={handleCancel}
              disabled={!hasChanges() || isSaving}
              className="px-8 py-3 border-2 border-gray-300 rounded-lg font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-all"
              data-testid="settings-button-cancel"
            >
              {t('settings:profile.cancelButton')}
            </button>
          </div>
        </div>
        </div>
      )}

      {/* Language Preferences Card */}
      {activeTab === 'language' && (
        <div className="max-w-4xl mx-auto">
        <div className="bg-white border-l-8 border-periwinkle p-8 shadow-sm mb-6">
          <h2 className="text-2xl font-bold text-dark-brown mb-6">{t('settings:language.title')}</h2>

        {/* Study Language */}
        <div className="mb-6">
          <label className="block text-base font-bold text-dark-brown mb-3">
            {t('settings:language.study.label')}
          </label>
          <select
            value={preferredStudyLanguage}
            onChange={(e) => handleStudyLanguageChange(e.target.value as LanguageCode)}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-periwinkle focus:outline-none text-base"
            data-testid="settings-select-study-language"
          >
            {preferredNativeLanguage !== 'en' && <option value="en">English</option>}
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
              {t('settings:language.study.helper')}
            </p>
          )}
        </div>

        {/* Native Language */}
        <div className="mb-6">
          <label className="block text-base font-bold text-dark-brown mb-3">
            {t('settings:language.native.label')}
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
              {t('settings:language.native.helper')}
            </p>
          )}
        </div>

        {/* Proficiency Level */}
        {preferredStudyLanguage === 'ja' && (
          <div className="mb-6">
            <label className="block text-base font-bold text-dark-brown mb-3">
              {t('settings:language.proficiency.jlpt.label')}
            </label>
            <select
              value={jlptLevel}
              onChange={(e) => handleProficiencyLevelChange(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-periwinkle focus:outline-none text-base"
              data-testid="settings-select-jlpt-level"
            >
              <option value="N5">{t('settings:language.proficiency.jlpt.n5')}</option>
              <option value="N4">{t('settings:language.proficiency.jlpt.n4')}</option>
              <option value="N3">{t('settings:language.proficiency.jlpt.n3')}</option>
              <option value="N2">{t('settings:language.proficiency.jlpt.n2')}</option>
              <option value="N1">{t('settings:language.proficiency.jlpt.n1')}</option>
            </select>
            {proficiencySaveMessage && (
              <p className={`text-sm font-medium mt-2 ${proficiencySaveMessage === t('settings:messages.saved') ? 'text-green-600' : 'text-red-600'}`}>
                {proficiencySaveMessage}
              </p>
            )}
            {!proficiencySaveMessage && (
              <p className="text-sm text-gray-500 mt-2">
                {t('settings:language.proficiency.jlpt.helper')}
              </p>
            )}
          </div>
        )}

        {preferredStudyLanguage === 'zh' && (
          <div className="mb-6">
            <label className="block text-base font-bold text-dark-brown mb-3">
              {t('settings:language.proficiency.hsk.label')}
            </label>
            <select
              value={hskLevel}
              onChange={(e) => handleProficiencyLevelChange(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-periwinkle focus:outline-none text-base"
              data-testid="settings-select-hsk-level"
            >
              <option value="HSK1">{t('settings:language.proficiency.hsk.hsk1')}</option>
              <option value="HSK2">{t('settings:language.proficiency.hsk.hsk2')}</option>
              <option value="HSK3">{t('settings:language.proficiency.hsk.hsk3')}</option>
              <option value="HSK4">{t('settings:language.proficiency.hsk.hsk4')}</option>
              <option value="HSK5">{t('settings:language.proficiency.hsk.hsk5')}</option>
              <option value="HSK6">{t('settings:language.proficiency.hsk.hsk6')}</option>
            </select>
            {proficiencySaveMessage && (
              <p className={`text-sm font-medium mt-2 ${proficiencySaveMessage === t('settings:messages.saved') ? 'text-green-600' : 'text-red-600'}`}>
                {proficiencySaveMessage}
              </p>
            )}
            {!proficiencySaveMessage && (
              <p className="text-sm text-gray-500 mt-2">
                {t('settings:language.proficiency.hsk.helper')}
              </p>
            )}
          </div>
        )}

        {/* Spanish - CEFR Levels */}
        {preferredStudyLanguage === 'es' && (
          <div className="mb-6">
            <label className="block text-base font-bold text-dark-brown mb-3">
              {t('settings:language.proficiency.cefr.spanish')}
            </label>
            <select
              value={cefrLevel}
              onChange={(e) => handleProficiencyLevelChange(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-periwinkle focus:outline-none text-base"
              data-testid="settings-select-cefr-level"
            >
              <option value="A1">{t('settings:language.proficiency.cefr.a1')}</option>
              <option value="A2">{t('settings:language.proficiency.cefr.a2')}</option>
              <option value="B1">{t('settings:language.proficiency.cefr.b1')}</option>
              <option value="B2">{t('settings:language.proficiency.cefr.b2')}</option>
              <option value="C1">{t('settings:language.proficiency.cefr.c1')}</option>
              <option value="C2">{t('settings:language.proficiency.cefr.c2')}</option>
            </select>
            {proficiencySaveMessage && (
              <p className={`text-sm font-medium mt-2 ${proficiencySaveMessage === t('settings:messages.saved') ? 'text-green-600' : 'text-red-600'}`}>
                {proficiencySaveMessage}
              </p>
            )}
            {!proficiencySaveMessage && (
              <p className="text-sm text-gray-500 mt-2">
                {t('settings:language.proficiency.cefr.helper')}
              </p>
            )}
          </div>
        )}

        {/* French - CEFR Levels */}
        {preferredStudyLanguage === 'fr' && (
          <div className="mb-6">
            <label className="block text-base font-bold text-dark-brown mb-3">
              {t('settings:language.proficiency.cefr.french')}
            </label>
            <select
              value={cefrLevel}
              onChange={(e) => handleProficiencyLevelChange(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-periwinkle focus:outline-none text-base"
              data-testid="settings-select-cefr-level"
            >
              <option value="A1">{t('settings:language.proficiency.cefr.a1')}</option>
              <option value="A2">{t('settings:language.proficiency.cefr.a2')}</option>
              <option value="B1">{t('settings:language.proficiency.cefr.b1')}</option>
              <option value="B2">{t('settings:language.proficiency.cefr.b2')}</option>
              <option value="C1">{t('settings:language.proficiency.cefr.c1')}</option>
              <option value="C2">{t('settings:language.proficiency.cefr.c2')}</option>
            </select>
            {proficiencySaveMessage && (
              <p className={`text-sm font-medium mt-2 ${proficiencySaveMessage === t('settings:messages.saved') ? 'text-green-600' : 'text-red-600'}`}>
                {proficiencySaveMessage}
              </p>
            )}
            {!proficiencySaveMessage && (
              <p className="text-sm text-gray-500 mt-2">
                {t('settings:language.proficiency.cefr.helper')}
              </p>
            )}
          </div>
        )}

        {/* Arabic - CEFR Levels */}
        {preferredStudyLanguage === 'ar' && (
          <div className="mb-6">
            <label className="block text-base font-bold text-dark-brown mb-3">
              {t('settings:language.proficiency.cefr.arabic')}
            </label>
            <select
              value={cefrLevel}
              onChange={(e) => handleProficiencyLevelChange(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-periwinkle focus:outline-none text-base"
              data-testid="settings-select-cefr-level"
            >
              <option value="A1">{t('settings:language.proficiency.cefr.a1')}</option>
              <option value="A2">{t('settings:language.proficiency.cefr.a2')}</option>
              <option value="B1">{t('settings:language.proficiency.cefr.b1')}</option>
              <option value="B2">{t('settings:language.proficiency.cefr.b2')}</option>
              <option value="C1">{t('settings:language.proficiency.cefr.c1')}</option>
              <option value="C2">{t('settings:language.proficiency.cefr.c2')}</option>
            </select>
            {proficiencySaveMessage && (
              <p className={`text-sm font-medium mt-2 ${proficiencySaveMessage === t('settings:messages.saved') ? 'text-green-600' : 'text-red-600'}`}>
                {proficiencySaveMessage}
              </p>
            )}
            {!proficiencySaveMessage && (
              <p className="text-sm text-gray-500 mt-2">
                {t('settings:language.proficiency.cefr.helper')}
              </p>
            )}
          </div>
        )}

        {/* English - CEFR Levels */}
        {preferredStudyLanguage === 'en' && (
          <div className="mb-6">
            <label className="block text-base font-bold text-dark-brown mb-3">
              {t('settings:language.proficiency.cefr.english')}
            </label>
            <select
              value={cefrLevel}
              onChange={(e) => handleProficiencyLevelChange(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-periwinkle focus:outline-none text-base"
              data-testid="settings-select-proficiency"
            >
              <option value="A1">{t('settings:language.proficiency.cefr.a1')}</option>
              <option value="A2">{t('settings:language.proficiency.cefr.a2')}</option>
              <option value="B1">{t('settings:language.proficiency.cefr.b1')}</option>
              <option value="B2">{t('settings:language.proficiency.cefr.b2')}</option>
              <option value="C1">{t('settings:language.proficiency.cefr.c1')}</option>
              <option value="C2">{t('settings:language.proficiency.cefr.c2')}</option>
            </select>
            {proficiencySaveMessage && (
              <p className={`text-sm font-medium mt-2 ${proficiencySaveMessage === t('settings:messages.saved') ? 'text-green-600' : 'text-red-600'}`}>
                {proficiencySaveMessage}
              </p>
            )}
            {!proficiencySaveMessage && (
              <p className="text-sm text-gray-500 mt-2">
                {t('settings:language.proficiency.cefr.helper')}
              </p>
            )}
          </div>
        )}

        {/* Pinyin Display Mode (only shown when study language is Chinese) */}
        {preferredStudyLanguage === 'zh' && (
          <div className="mb-6">
            <label className="block text-base font-bold text-dark-brown mb-3">
              {t('settings:language.pinyin.label')}
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
                <span className="text-base text-gray-700">{t('settings:language.pinyin.toneMarks')}</span>
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
                <span className="text-base text-gray-700">{t('settings:language.pinyin.toneNumbers')}</span>
              </label>
            </div>
            {pinyinSaveMessage && (
              <p className={`text-sm font-medium mt-2 ${pinyinSaveMessage === t('settings:messages.saved') ? 'text-green-600' : 'text-red-600'}`}>
                {pinyinSaveMessage}
              </p>
            )}
            {!pinyinSaveMessage && (
              <p className="text-sm text-gray-500 mt-2">
                {t('settings:language.pinyin.helper')}
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
          <h2 className="text-2xl font-bold text-dark-brown mb-6">{t('settings:security.title')}</h2>

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
            {t('settings:security.currentPassword.label')}
          </label>
          <input
            type="password"
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-periwinkle focus:outline-none text-base"
            placeholder={t('settings:security.currentPassword.placeholder')}
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
            data-testid="settings-input-current-password"
          />
        </div>

        {/* New Password */}
        <div className="mb-4">
          <label className="block text-base font-bold text-dark-brown mb-3">
            {t('settings:security.newPassword.label')}
          </label>
          <input
            type="password"
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-periwinkle focus:outline-none text-base"
            placeholder={t('settings:security.newPassword.placeholder')}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            data-testid="settings-input-new-password"
          />
        </div>

        {/* Confirm New Password */}
        <div className="mb-6">
          <label className="block text-base font-bold text-dark-brown mb-3">
            {t('settings:security.confirmPassword.label')}
          </label>
          <input
            type="password"
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-periwinkle focus:outline-none text-base"
            placeholder={t('settings:security.confirmPassword.placeholder')}
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
            {isChangingPassword ? t('settings:security.changing') : t('settings:security.changeButton')}
          </button>
        </div>
        </div>
        </div>
      )}

      {/* Billing Card */}
      {activeTab === 'billing' && (
        <div className="max-w-4xl mx-auto">
          <div className="bg-white border-l-8 border-periwinkle p-8 shadow-sm mb-6">
            <h2 className="text-2xl font-bold text-dark-brown mb-6">{t('settings:billing.title')}</h2>

            {billingError && (
              <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-700">{billingError}</p>
              </div>
            )}

            {loadingSubscription ? (
              <div className="text-center py-8">
                <div className="loading-spinner w-8 h-8 border-4 border-periwinkle border-t-transparent rounded-full mx-auto mb-4" />
                <p className="text-medium-brown">{t('settings:billing.loading')}</p>
              </div>
            ) : (
              <>
                {/* Current Plan */}
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-dark-brown mb-4">{t('settings:billing.currentPlan.title')}</h3>
                  <div className="bg-periwinkle-light border-2 border-periwinkle rounded-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="text-2xl font-bold text-dark-brown capitalize">
                          {user?.tier === 'pro' ? t('settings:billing.currentPlan.pro') : t('settings:billing.currentPlan.free')} {t('settings:billing.currentPlan.plan')}
                        </p>
                        <p className="text-medium-brown">
                          {user?.tier === 'pro' ? t('settings:billing.currentPlan.proPrice') : t('settings:billing.currentPlan.freePrice')}
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
                        {t('settings:billing.currentPlan.limit')}
                      </p>
                      <p className="text-lg font-semibold text-dark-brown">
                        {user?.tier === 'pro' ? '30' : '5'} {t('settings:billing.currentPlan.generations')}
                      </p>
                    </div>

                    {subscriptionStatus?.currentPeriodEnd && (
                      <p className="text-sm text-medium-brown">
                        {subscriptionStatus.cancelAtPeriodEnd
                          ? `${t('settings:billing.currentPlan.cancelsOn')} ${new Date(subscriptionStatus.currentPeriodEnd).toLocaleDateString()}`
                          : `${t('settings:billing.currentPlan.renewsOn')} ${new Date(subscriptionStatus.currentPeriodEnd).toLocaleDateString()}`}
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
                        {t('settings:billing.actions.upgrade')}
                      </button>
                      <p className="text-sm text-medium-brown mt-2 text-center">
                        {t('settings:billing.actions.upgradeHelper')}
                      </p>
                    </div>
                  ) : (
                    <div>
                      <button
                        onClick={handleManageSubscription}
                        disabled={loadingSubscription}
                        className="btn-secondary w-full disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {loadingSubscription ? t('settings:billing.loading') : t('settings:billing.actions.manage')}
                      </button>
                      <p className="text-sm text-medium-brown mt-2 text-center">
                        {t('settings:billing.actions.manageHelper')}
                      </p>
                    </div>
                  )}
                </div>

                {/* Plan Comparison */}
                <div className="mt-8 pt-8 border-t border-gray-200">
                  <h3 className="text-lg font-semibold text-dark-brown mb-4">
                    {t('settings:billing.comparison.title')}
                  </h3>
                  <button
                    onClick={() => navigate('/pricing')}
                    className="text-periwinkle hover:text-dark-periwinkle font-medium"
                  >
                    {t('settings:billing.comparison.viewAll')}
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
          <h2 className="text-2xl font-bold text-strawberry mb-6">{t('settings:danger.title')}</h2>
          <div className="bg-strawberry-light border-l-4 border-strawberry p-6">
            <div className="flex items-start gap-3">
              <Trash2 className="w-5 h-5 text-strawberry flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-bold text-lg text-dark-brown mb-2">{t('settings:danger.deleteAccount.title')}</h3>
                <p className="text-base text-gray-700 mb-3">
                  {t('settings:danger.deleteAccount.warning')}
                </p>
                <ul className="text-base text-gray-700 list-disc list-inside space-y-1 mb-4">
                  <li>{t('settings:danger.deleteAccount.items.dialogues')}</li>
                  <li>{t('settings:danger.deleteAccount.items.courses')}</li>
                  <li>{t('settings:danger.deleteAccount.items.narrowListening')}</li>
                  <li>{t('settings:danger.deleteAccount.items.chunkPacks')}</li>
                  <li>{t('settings:danger.deleteAccount.items.account')}</li>
                </ul>
                <button
                  onClick={() => setShowDeleteModal(true)}
                  className="px-6 py-3 bg-strawberry text-white rounded-lg hover:bg-strawberry-dark transition-colors font-bold"
                  data-testid="settings-button-delete-account"
                >
                  {t('settings:danger.deleteAccount.button')}
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
        title={t('settings:danger.deleteAccount.confirmTitle')}
        message={t('settings:danger.deleteAccount.confirmMessage')}
        confirmLabel={t('settings:danger.deleteAccount.confirmButton')}
        cancelLabel={t('settings:danger.deleteAccount.cancelButton')}
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
