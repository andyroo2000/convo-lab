import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { User, Settings, Trash2, ArrowLeft, Lock, Languages } from 'lucide-react';
import ConfirmModal from '../components/common/ConfirmModal';
import { LanguageCode } from '../types';

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

  const [displayName, setDisplayName] = useState('');
  const [selectedColor, setSelectedColor] = useState('indigo');
  const [preferredStudyLanguage, setPreferredStudyLanguage] = useState<LanguageCode>('ja');
  const [preferredNativeLanguage, setPreferredNativeLanguage] = useState<LanguageCode>('en');
  const [pinyinDisplayMode, setPinyinDisplayMode] = useState<'toneMarks' | 'toneNumbers'>('toneMarks');
  const [jlptLevel, setJlptLevel] = useState<string>('N5');
  const [hskLevel, setHskLevel] = useState<string>('HSK1');
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
      }
    }
  }, [user]);

  const hasChanges = () => {
    if (!user) return false;
    const currentDisplayName = user.displayName || user.name;
    const currentColor = user.avatarColor || 'indigo';
    const currentStudyLang = user.preferredStudyLanguage || 'ja';
    const currentNativeLang = user.preferredNativeLanguage || 'en';
    const currentPinyinMode = user.pinyinDisplayMode || 'toneMarks';
    const currentProficiency = user.proficiencyLevel || '';
    const newProficiency = preferredStudyLanguage === 'ja' ? jlptLevel : hskLevel;

    return displayName !== currentDisplayName ||
           selectedColor !== currentColor ||
           preferredStudyLanguage !== currentStudyLang ||
           preferredNativeLanguage !== currentNativeLang ||
           pinyinDisplayMode !== currentPinyinMode ||
           newProficiency !== currentProficiency;
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
      // Get the appropriate proficiency level based on study language
      const proficiencyLevel = preferredStudyLanguage === 'ja' ? jlptLevel : hskLevel;

      await updateUser({
        displayName: displayName.trim() || undefined,
        avatarColor: selectedColor,
        preferredStudyLanguage,
        preferredNativeLanguage,
        pinyinDisplayMode,
        proficiencyLevel,
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

  if (!user) {
    return null;
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate('/app/studio')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Studio
        </button>
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl">
            <Settings className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-navy">Settings</h1>
            <p className="text-gray-600 mt-1">Manage your account preferences</p>
          </div>
        </div>
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
      <div className="card bg-white shadow-lg mb-6">
        <h2 className="text-xl font-bold text-navy mb-6">Profile Settings</h2>

        {/* Display Name Section */}
        <div className="mb-8">
          <label className="block text-sm font-semibold text-gray-900 mb-2">
            Display Name
          </label>
          <input
            type="text"
            className="input"
            placeholder="Enter your display name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={50}
          />
          <p className="text-xs text-gray-500 mt-1">
            This is the name that will be displayed throughout the app
          </p>
        </div>

        {/* Avatar Color Section */}
        <div className="mb-8">
          <label className="block text-sm font-semibold text-gray-900 mb-3">
            Avatar Color
          </label>
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
            {AVATAR_COLORS.map((color) => {
              const isSelected = selectedColor === color.value;
              return (
                <button
                  key={color.value}
                  onClick={() => setSelectedColor(color.value)}
                  className={`relative flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all ${
                    isSelected
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  title={color.name}
                >
                  <div className={`w-10 h-10 ${color.bg} rounded-full flex items-center justify-center`}>
                    <User className={`w-5 h-5 ${color.text}`} />
                  </div>
                  <span className="text-xs text-gray-600">{color.name}</span>
                  {isSelected && (
                    <div className="absolute top-1 right-1 w-3 h-3 bg-indigo-600 rounded-full" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Save/Cancel Buttons */}
        <div className="flex gap-3 pt-4 border-t">
          <button
            onClick={handleSave}
            disabled={!hasChanges() || isSaving}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
          <button
            onClick={handleCancel}
            disabled={!hasChanges() || isSaving}
            className="btn-outline disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
        </div>
      </div>

      {/* Language Preferences Card */}
      <div className="card bg-white shadow-lg mb-6">
        <div className="flex items-center gap-2 mb-6">
          <Languages className="w-5 h-5 text-gray-700" />
          <h2 className="text-xl font-bold text-navy">Language Preferences</h2>
        </div>

        {/* Study Language */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-gray-900 mb-2">
            Study Language
          </label>
          <select
            value={preferredStudyLanguage}
            onChange={(e) => setPreferredStudyLanguage(e.target.value as LanguageCode)}
            className="input"
          >
            <option value="ja">Japanese (日本語)</option>
            <option value="zh">Mandarin Chinese (中文)</option>
          </select>
          <p className="text-xs text-gray-500 mt-1">
            Your primary target language for learning
          </p>
        </div>

        {/* Native Language */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-gray-900 mb-2">
            Native Language
          </label>
          <select
            value={preferredNativeLanguage}
            onChange={(e) => setPreferredNativeLanguage(e.target.value as LanguageCode)}
            className="input"
          >
            <option value="en">English</option>
            <option value="es">Spanish (Español)</option>
            <option value="fr">French (Français)</option>
            <option value="zh">Chinese (中文)</option>
            <option value="ja">Japanese (日本語)</option>
          </select>
          <p className="text-xs text-gray-500 mt-1">
            Your first language, used for translations
          </p>
        </div>

        {/* Proficiency Level */}
        {preferredStudyLanguage === 'ja' && (
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Current JLPT Level
            </label>
            <select
              value={jlptLevel}
              onChange={(e) => setJlptLevel(e.target.value)}
              className="input"
            >
              <option value="N5">N5 (Beginner)</option>
              <option value="N4">N4 (Upper Beginner)</option>
              <option value="N3">N3 (Intermediate)</option>
              <option value="N2">N2 (Upper Intermediate)</option>
              <option value="N1">N1 (Advanced)</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              This helps us generate content at the right difficulty level
            </p>
          </div>
        )}

        {preferredStudyLanguage === 'zh' && (
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Current HSK Level
            </label>
            <select
              value={hskLevel}
              onChange={(e) => setHskLevel(e.target.value)}
              className="input"
            >
              <option value="HSK1">HSK 1 (Beginner)</option>
              <option value="HSK2">HSK 2 (Upper Beginner)</option>
              <option value="HSK3">HSK 3 (Intermediate)</option>
              <option value="HSK4">HSK 4 (Upper Intermediate)</option>
              <option value="HSK5">HSK 5 (Advanced)</option>
              <option value="HSK6">HSK 6 (Mastery)</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              This helps us generate content at the right difficulty level
            </p>
          </div>
        )}

        {/* Pinyin Display Mode (only shown when study language is Chinese) */}
        {preferredStudyLanguage === 'zh' && (
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Pinyin Display Format
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="pinyinMode"
                  value="toneMarks"
                  checked={pinyinDisplayMode === 'toneMarks'}
                  onChange={(e) => setPinyinDisplayMode(e.target.value as 'toneMarks' | 'toneNumbers')}
                  className="w-4 h-4 text-indigo-600"
                />
                <span className="text-sm text-gray-700">Tone marks (nǐ hǎo)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="pinyinMode"
                  value="toneNumbers"
                  checked={pinyinDisplayMode === 'toneNumbers'}
                  onChange={(e) => setPinyinDisplayMode(e.target.value as 'toneMarks' | 'toneNumbers')}
                  className="w-4 h-4 text-indigo-600"
                />
                <span className="text-sm text-gray-700">Tone numbers (ni3 hao3)</span>
              </label>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Choose how pinyin is displayed above Chinese characters
            </p>
          </div>
        )}

        <p className="text-xs text-gray-500 border-t pt-4">
          These preferences will be used as defaults when creating new content
        </p>
      </div>

      {/* Change Password Card */}
      <div className="card bg-white shadow-lg mb-6">
        <div className="flex items-center gap-2 mb-6">
          <Lock className="w-5 h-5 text-gray-700" />
          <h2 className="text-xl font-bold text-navy">Change Password</h2>
        </div>

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
          <label className="block text-sm font-semibold text-gray-900 mb-2">
            Current Password
          </label>
          <input
            type="password"
            className="input"
            placeholder="Enter your current password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>

        {/* New Password */}
        <div className="mb-4">
          <label className="block text-sm font-semibold text-gray-900 mb-2">
            New Password
          </label>
          <input
            type="password"
            className="input"
            placeholder="Enter your new password (min 8 characters)"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
          />
        </div>

        {/* Confirm New Password */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-gray-900 mb-2">
            Confirm New Password
          </label>
          <input
            type="password"
            className="input"
            placeholder="Confirm your new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
          />
        </div>

        {/* Change Password Button */}
        <div className="pt-4 border-t">
          <button
            onClick={handleChangePassword}
            disabled={isChangingPassword}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isChangingPassword ? 'Changing Password...' : 'Change Password'}
          </button>
        </div>
      </div>

      {/* Danger Zone Card */}
      <div className="card bg-white shadow-lg border-2 border-red-200">
        <h2 className="text-xl font-bold text-red-700 mb-4">Danger Zone</h2>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <div className="flex items-start gap-3">
            <Trash2 className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-red-900 mb-1">Delete Account</h3>
              <p className="text-sm text-red-700 mb-3">
                Once you delete your account, there is no going back. This will permanently delete:
              </p>
              <ul className="text-sm text-red-700 list-disc list-inside space-y-1 mb-4">
                <li>All your dialogues and episodes</li>
                <li>All your audio courses</li>
                <li>All your narrow listening packs</li>
                <li>All your chunk packs</li>
                <li>Your account information and settings</li>
              </ul>
              <button
                onClick={() => setShowDeleteModal(true)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium text-sm"
              >
                Delete My Account
              </button>
            </div>
          </div>
        </div>
      </div>

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
    </div>
  );
}
