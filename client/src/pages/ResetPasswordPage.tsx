import { useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, CheckCircle, XCircle, Lock } from 'lucide-react';
import JournalAuthShell from '../components/common/JournalAuthShell';
import { errorMessageFromPayload } from '../lib/apiError';
import { authApi } from '../lib/authApi';

const ResetPasswordPage = () => {
  const { t } = useTranslation(['auth', 'common']);
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const email = searchParams.get('email') ?? '';
  const invalidLink = !token || !email;
  const navigate = useNavigate();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError(t('auth:resetPassword.errors.passwordMismatch'));
      return;
    }

    if (newPassword.length < 8) {
      setError(t('auth:resetPassword.errors.passwordLength'));
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(authApi.resetPassword, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(authApi.resetPasswordBody(email, token, newPassword)),
      });

      if (!response.ok) {
        const data = await response.json();
        const detail = errorMessageFromPayload({ error: data?.error });
        throw new Error(
          detail ?? errorMessageFromPayload(data) ?? t('auth:resetPassword.errors.failed')
        );
      }

      setSuccess(true);

      // Redirect to login after 3 seconds
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <JournalAuthShell>
      <div className="mb-6">
        <Link to="/login" className="journal-auth-link inline-flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" />
          {t('auth:resetPassword.backToLogin')}
        </Link>
      </div>

      <div>
        {invalidLink && (
          <div className="text-center">
            <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h1>{t('auth:resetPassword.invalid.title')}</h1>
            <p className="text-medium-brown mb-6">{t('auth:resetPassword.invalid.description')}</p>
            <Link to="/forgot-password" className="journal-auth-link inline-block">
              {t('auth:resetPassword.invalid.requestNewLink')}
            </Link>
          </div>
        )}

        {!invalidLink && !success && (
          <>
            <div className="mb-6">
              <Lock className="w-12 h-12 text-periwinkle mx-auto mb-3" />
              <h1>{t('auth:resetPassword.title')}</h1>
              <p className="text-medium-brown text-sm">
                {t('auth:resetPassword.description', { email })}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="newPassword" className="journal-auth-label">
                  {t('auth:resetPassword.newPassword')}
                </label>
                <input
                  id="newPassword"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="journal-auth-input"
                  placeholder={t('auth:resetPassword.newPasswordPlaceholder')}
                  required
                  minLength={8}
                />
              </div>

              <div>
                <label htmlFor="confirmPassword" className="journal-auth-label">
                  {t('auth:resetPassword.confirmPassword')}
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="journal-auth-input"
                  placeholder={t('auth:resetPassword.confirmPasswordPlaceholder')}
                  required
                  minLength={8}
                />
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="journal-auth-submit disabled:opacity-50"
              >
                {loading ? t('auth:resetPassword.submitting') : t('auth:resetPassword.submit')}
              </button>
            </form>
          </>
        )}

        {success && (
          <div className="text-center">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h1>{t('auth:resetPassword.success.title')}</h1>
            <p className="text-medium-brown mb-4">{t('auth:resetPassword.success.description')}</p>
            <p className="text-sm text-gray-500">{t('auth:resetPassword.success.redirecting')}</p>
          </div>
        )}
      </div>

      <p className="text-center text-sm text-gray-500 mt-6">{t('common:footer')}</p>
    </JournalAuthShell>
  );
};

export default ResetPasswordPage;
