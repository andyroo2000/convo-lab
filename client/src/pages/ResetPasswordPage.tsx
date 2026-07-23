import { useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, CheckCircle, XCircle, Lock } from 'lucide-react';
import Logo from '../components/common/Logo';
import { authApi } from '../lib/authApi';

const parseApiErrorMessage = (data: unknown, fallback: string): string => {
  if (!data || typeof data !== 'object') return fallback;

  const response = data as {
    error?: string | { message?: string };
    message?: string;
  };

  if (typeof response.error === 'string' && response.error.trim()) return response.error;
  if (response.error && typeof response.error === 'object' && response.error.message) {
    return response.error.message;
  }
  if (typeof response.message === 'string' && response.message.trim()) return response.message;
  return fallback;
};

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
        throw new Error(parseApiErrorMessage(data, 'Failed to reset password'));
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
    <div className="min-h-screen bg-cream flex items-start sm:items-center justify-center px-4 py-8">
      <div className="max-w-md w-full">
        <div className="mb-6">
          <Link
            to="/login"
            className="inline-flex items-center gap-2 text-medium-brown hover:text-dark-brown transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {t('auth:resetPassword.backToLogin')}
          </Link>
        </div>

        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-2">
            <h1 className="text-4xl font-bold text-dark-brown">ConvoLab</h1>
            <Logo size="large" />
          </div>
          <p className="text-medium-brown">{t('auth:resetPassword.subtitle')}</p>
        </div>

        <div className="card">
          {invalidLink && (
            <div className="text-center py-8">
              <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
              <h2 className="text-2xl font-semibold text-dark-brown mb-2">
                {t('auth:resetPassword.invalid.title')}
              </h2>
              <p className="text-red-600 mb-6">Invalid reset link</p>
              <p className="text-medium-brown mb-6">
                {t('auth:resetPassword.invalid.description')}
              </p>
              <Link to="/forgot-password" className="btn-primary inline-block">
                {t('auth:resetPassword.invalid.requestNewLink')}
              </Link>
            </div>
          )}

          {!invalidLink && !success && (
            <>
              <div className="text-center mb-6">
                <Lock className="w-12 h-12 text-periwinkle mx-auto mb-3" />
                <h2 className="text-2xl font-semibold text-dark-brown mb-2">
                  {t('auth:resetPassword.title')}
                </h2>
                <p className="text-medium-brown text-sm">
                  {t('auth:resetPassword.description', { email })}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label
                    htmlFor="newPassword"
                    className="block text-sm font-medium text-dark-brown mb-1"
                  >
                    {t('auth:resetPassword.newPassword')}
                  </label>
                  <input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="input"
                    placeholder={t('auth:resetPassword.newPasswordPlaceholder')}
                    required
                    minLength={8}
                  />
                </div>

                <div>
                  <label
                    htmlFor="confirmPassword"
                    className="block text-sm font-medium text-dark-brown mb-1"
                  >
                    {t('auth:resetPassword.confirmPassword')}
                  </label>
                  <input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="input"
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
                  className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? t('auth:resetPassword.submitting') : t('auth:resetPassword.submit')}
                </button>
              </form>
            </>
          )}

          {success && (
            <div className="text-center py-8">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-2xl font-semibold text-dark-brown mb-2">
                {t('auth:resetPassword.success.title')}
              </h2>
              <p className="text-medium-brown mb-4">
                {t('auth:resetPassword.success.description')}
              </p>
              <p className="text-sm text-gray-500">{t('auth:resetPassword.success.redirecting')}</p>
            </div>
          )}
        </div>

        <p className="text-center text-sm text-gray-500 mt-6">{t('common:footer')}</p>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
