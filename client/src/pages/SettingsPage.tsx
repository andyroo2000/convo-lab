import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { User, Trash2, Lock, Camera } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import ConfirmModal from '../components/common/ConfirmModal';
import AvatarCropperModal from '../components/admin/AvatarCropperModal';
import { API_URL } from '../config';

type Tab = 'profile' | 'security' | 'danger';
const SETTINGS_TABS = new Set<string>(['profile', 'security', 'danger']);

const SettingsPage = () => {
  const { t } = useTranslation(['settings', 'common']);
  const { user, updateUser, deleteAccount, changePassword } = useAuth();
  const navigate = useNavigate();
  const { tab } = useParams<{ tab?: string }>();
  const activeTab: Tab = SETTINGS_TABS.has(tab ?? '') ? (tab as Tab) : 'profile';

  const AVATAR_COLORS = useMemo(
    () => [
      {
        name: t('settings:profile.colors.indigo'),
        value: 'indigo',
        bg: 'bg-indigo-100',
        text: 'text-indigo-600',
      },
      {
        name: t('settings:profile.colors.teal'),
        value: 'teal',
        bg: 'bg-teal-100',
        text: 'text-teal-600',
      },
      {
        name: t('settings:profile.colors.purple'),
        value: 'purple',
        bg: 'bg-purple-100',
        text: 'text-purple-600',
      },
      {
        name: t('settings:profile.colors.pink'),
        value: 'pink',
        bg: 'bg-pink-100',
        text: 'text-pink-600',
      },
      {
        name: t('settings:profile.colors.emerald'),
        value: 'emerald',
        bg: 'bg-emerald-100',
        text: 'text-emerald-600',
      },
      {
        name: t('settings:profile.colors.amber'),
        value: 'amber',
        bg: 'bg-amber-100',
        text: 'text-amber-600',
      },
      {
        name: t('settings:profile.colors.rose'),
        value: 'rose',
        bg: 'bg-rose-100',
        text: 'text-rose-600',
      },
      {
        name: t('settings:profile.colors.cyan'),
        value: 'cyan',
        bg: 'bg-cyan-100',
        text: 'text-cyan-600',
      },
    ],
    [t]
  );

  const [displayName, setDisplayName] = useState('');
  const [selectedColor, setSelectedColor] = useState('indigo');
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

  // Avatar cropper state
  const [cropperOpen, setCropperOpen] = useState(false);
  const [cropperImageUrl, setCropperImageUrl] = useState('');

  useEffect(() => {
    if (tab && !SETTINGS_TABS.has(tab)) {
      navigate('/app/settings/profile', { replace: true });
    }
  }, [tab, navigate]);

  // Initialize form with user data
  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName || user.name);
      setSelectedColor(user.avatarColor || 'indigo');
    }
  }, [user]);

  const hasChanges = () => {
    if (!user) return false;
    const currentDisplayName = user.displayName || user.name;
    const currentColor = user.avatarColor || 'indigo';

    return displayName !== currentDisplayName || selectedColor !== currentColor;
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
      });
      setSuccess(t('settings:messages.saveSuccess'));
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('settings:messages.failedToSave'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (user) {
      setDisplayName(user.displayName || user.name);
      setSelectedColor(user.avatarColor || 'indigo');

      setError(null);
      setSuccess(null);
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      await deleteAccount();
      navigate('/login');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('settings:messages.deleteError'));
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
    } catch (err: unknown) {
      setPasswordError(err instanceof Error ? err.message : t('settings:messages.failedToSave'));
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
        reader.onload = (readerEvent) => {
          const dataUrl = readerEvent.target?.result as string;
          setCropperImageUrl(dataUrl);
          setCropperOpen(true);
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };

  const handleSaveAvatarCrop = async (blob: Blob, cropArea: Record<string, unknown>) => {
    try {
      if (!user) return;

      const formData = new FormData();
      formData.append('image', blob, 'avatar.jpg');
      formData.append('cropArea', JSON.stringify(cropArea));

      const response = await fetch(`${API_URL}/api/admin/avatars/user/${user.id}/upload`, {
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
    } catch (uploadError) {
      console.error('Failed to upload avatar:', uploadError);
      setError(t('settings:profile.avatar.uploadError'));
    }
  };

  if (!user) {
    return null;
  }

  const getTabButtonClass = (tabKey: Tab) => {
    if (tabKey === 'danger') {
      return `retro-settings-tab ${activeTab === tabKey ? 'is-active-danger' : ''}`;
    }
    return `retro-settings-tab ${activeTab === tabKey ? 'is-active' : ''}`;
  };

  return (
    <div className="retro-settings-wrap">
      <div className="retro-settings-shell">
        {/* Header */}
        <div className="retro-settings-top">
          <h1 className="retro-settings-title">{t('settings:title')}</h1>
          <p className="retro-settings-subtitle">{t('settings:subtitle')}</p>
        </div>

        <div className="retro-settings-main">
          {/* Tab Navigation */}
          <div className="retro-settings-tabs">
            <button
              type="button"
              onClick={() => navigate('/app/settings/profile')}
              className={getTabButtonClass('profile')}
              data-testid="settings-tab-profile"
            >
              <User className="w-4 h-4" />
              <span>{t('settings:tabs.profile')}</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('/app/settings/security')}
              className={getTabButtonClass('security')}
              data-testid="settings-tab-security"
            >
              <Lock className="w-4 h-4" />
              <span>{t('settings:tabs.security')}</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('/app/settings/danger')}
              className={getTabButtonClass('danger')}
              data-testid="settings-tab-danger"
            >
              <Trash2 className="w-4 h-4" />
              <span>{t('settings:tabs.danger')}</span>
            </button>
          </div>

          {/* Success/Error Messages */}
          {success && (
            <div className="retro-settings-alert is-success mb-6">
              <p className="text-sm">{success}</p>
            </div>
          )}
          {error && (
            <div className="retro-settings-alert is-error mb-6">
              <p className="text-sm">{error}</p>
            </div>
          )}

          {/* Profile Settings Card */}
          {activeTab === 'profile' && (
            <div className="max-w-4xl mx-auto">
              <div className="retro-settings-panel retro-paper-panel mb-6">
                <h2 className="retro-headline text-3xl mb-6">{t('settings:profile.title')}</h2>

                {/* Avatar */}
                <div className="mb-6">
                  <p className="retro-settings-label mb-3">{t('settings:profile.avatar.label')}</p>
                  <div className="flex flex-wrap items-center gap-4">
                    {/* Current Avatar Preview */}
                    {user?.avatarUrl ? (
                      <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-gray-200">
                        <img
                          src={user.avatarUrl}
                          alt={t('settings:profile.avatar.altText')}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div
                        className={`w-20 h-20 ${AVATAR_COLORS.find((c) => c.value === selectedColor)?.bg || 'bg-indigo-100'} rounded-full flex items-center justify-center`}
                      >
                        <span
                          className={`text-2xl font-medium ${AVATAR_COLORS.find((c) => c.value === selectedColor)?.text || 'text-indigo-600'}`}
                        >
                          {displayName.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}

                    {/* Upload Button */}
                    <button
                      type="button"
                      onClick={handleAvatarUpload}
                      className="retro-settings-btn-subtle"
                      data-testid="settings-button-upload-avatar"
                    >
                      <Camera className="w-4 h-4" />
                      {user?.avatarUrl
                        ? t('settings:profile.avatar.change')
                        : t('settings:profile.avatar.upload')}
                    </button>

                    {user?.avatarUrl && (
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await updateUser({ avatarUrl: null });
                            setSuccess(t('settings:profile.avatar.removeSuccess'));
                            setTimeout(() => setSuccess(null), 3000);
                          } catch (removeError) {
                            setError(t('settings:profile.avatar.removeError'));
                          }
                        }}
                        className="retro-settings-link-danger"
                        data-testid="settings-button-remove-avatar"
                      >
                        {t('settings:profile.avatar.remove')}
                      </button>
                    )}
                  </div>
                  <p className="retro-settings-helper mt-2">
                    {t('settings:profile.avatar.helper')}
                  </p>
                </div>

                {/* Display Name Section */}
                <div className="mb-8">
                  <label htmlFor="settings-display-name" className="retro-settings-label mb-3">
                    {t('settings:profile.displayName.label')}
                  </label>
                  <input
                    id="settings-display-name"
                    type="text"
                    className="retro-settings-input"
                    placeholder={t('settings:profile.displayName.placeholder')}
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    maxLength={50}
                    data-testid="settings-input-display-name"
                  />
                  <p className="retro-settings-helper mt-2">
                    {t('settings:profile.displayName.helper')}
                  </p>
                </div>

                {/* Save/Cancel Buttons */}
                <div className="flex gap-3 pt-4 retro-settings-divider">
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={!hasChanges() || isSaving}
                    className="retro-settings-btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                    data-testid="settings-button-save"
                  >
                    {isSaving ? t('settings:profile.saving') : t('settings:profile.saveButton')}
                  </button>
                  <button
                    type="button"
                    onClick={handleCancel}
                    disabled={!hasChanges() || isSaving}
                    className="retro-settings-btn-secondary disabled:opacity-50"
                    data-testid="settings-button-cancel"
                  >
                    {t('settings:profile.cancelButton')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Change Password Card */}
          {activeTab === 'security' && (
            <div className="max-w-4xl mx-auto">
              <div className="retro-settings-panel retro-paper-panel mb-6">
                <h2 className="retro-headline text-3xl mb-6">{t('settings:security.title')}</h2>

                {/* Password Success/Error Messages */}
                {passwordSuccess && (
                  <div className="retro-settings-alert is-success mb-4">
                    <p className="text-sm">{passwordSuccess}</p>
                  </div>
                )}
                {passwordError && (
                  <div className="retro-settings-alert is-error mb-4">
                    <p className="text-sm">{passwordError}</p>
                  </div>
                )}

                {/* Current Password */}
                <div className="mb-4">
                  <label htmlFor="settings-current-password" className="retro-settings-label mb-3">
                    {t('settings:security.currentPassword.label')}
                  </label>
                  <input
                    id="settings-current-password"
                    type="password"
                    className="retro-settings-input"
                    placeholder={t('settings:security.currentPassword.placeholder')}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    autoComplete="current-password"
                    data-testid="settings-input-current-password"
                  />
                </div>

                {/* New Password */}
                <div className="mb-4">
                  <label htmlFor="settings-new-password" className="retro-settings-label mb-3">
                    {t('settings:security.newPassword.label')}
                  </label>
                  <input
                    id="settings-new-password"
                    type="password"
                    className="retro-settings-input"
                    placeholder={t('settings:security.newPassword.placeholder')}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoComplete="new-password"
                    data-testid="settings-input-new-password"
                  />
                </div>

                {/* Confirm New Password */}
                <div className="mb-6">
                  <label htmlFor="settings-confirm-password" className="retro-settings-label mb-3">
                    {t('settings:security.confirmPassword.label')}
                  </label>
                  <input
                    id="settings-confirm-password"
                    type="password"
                    className="retro-settings-input"
                    placeholder={t('settings:security.confirmPassword.placeholder')}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    data-testid="settings-input-confirm-password"
                  />
                </div>

                {/* Change Password Button */}
                <div className="pt-4 retro-settings-divider">
                  <button
                    type="button"
                    onClick={handleChangePassword}
                    disabled={isChangingPassword}
                    className="retro-settings-btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                    data-testid="settings-button-change-password"
                  >
                    {isChangingPassword
                      ? t('settings:security.changing')
                      : t('settings:security.changeButton')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Danger Zone Card */}
          {activeTab === 'danger' && (
            <div className="max-w-4xl mx-auto">
              <div className="retro-settings-panel retro-paper-panel danger">
                <h2 className="retro-headline text-3xl text-strawberry mb-6">
                  {t('settings:danger.title')}
                </h2>
                <div className="retro-settings-subpanel danger">
                  <div className="flex items-start gap-3">
                    <Trash2 className="w-5 h-5 text-strawberry flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h3 className="retro-settings-section-title mb-2">
                        {t('settings:danger.deleteAccount.title')}
                      </h3>
                      <p className="text-base text-gray-700 mb-3">
                        {t('settings:danger.deleteAccount.warning')}
                      </p>
                      <ul className="text-base text-gray-700 list-disc list-inside space-y-1 mb-4">
                        <li>{t('settings:danger.deleteAccount.items.dialogues')}</li>
                        <li>{t('settings:danger.deleteAccount.items.courses')}</li>
                        <li>{t('settings:danger.deleteAccount.items.account')}</li>
                      </ul>
                      <button
                        type="button"
                        onClick={() => setShowDeleteModal(true)}
                        className="retro-settings-btn-danger"
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
        </div>
      </div>

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
        title={t('settings:profile.avatar.cropTitle')}
      />
    </div>
  );
};

export default SettingsPage;
