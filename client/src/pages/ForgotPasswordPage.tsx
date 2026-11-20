import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Mail } from 'lucide-react';
import JournalAuthShell from '../components/common/JournalAuthShell';
import { authApi } from '../lib/authApi';

const ForgotPasswordPage = () => {
  const { t } = useTranslation(['auth', 'common']);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch(authApi.forgotPassword, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to send reset email');
      }

      setSuccess(true);
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
          {t('auth:forgotPassword.backToLogin')}
        </Link>
      </div>

      <div>
        {!success ? (
          <>
            <div className="mb-6">
              <h1>{t('auth:forgotPassword.title')}</h1>
              <p className="text-medium-brown text-sm">{t('auth:forgotPassword.description')}</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="journal-auth-label">
                  {t('auth:forgotPassword.email')}
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="journal-auth-input"
                  placeholder={t('auth:forgotPassword.emailPlaceholder')}
                  required
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
                {loading ? t('auth:forgotPassword.sending') : t('auth:forgotPassword.submit')}
              </button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-gray-500">
                {t('auth:forgotPassword.rememberPassword')}{' '}
                <Link to="/login" className="journal-auth-link">
                  {t('auth:forgotPassword.loginLink')}
                </Link>
              </p>
            </div>
          </>
        ) : (
          <div className="text-center">
            <Mail className="w-16 h-16 text-periwinkle mx-auto mb-4" />
            <h1>{t('auth:forgotPassword.checkEmail')}</h1>
            <p className="text-medium-brown mb-4">
              {t('auth:forgotPassword.emailSent', { email })}
            </p>
            <p className="text-sm text-gray-500 mb-6">{t('auth:forgotPassword.expiryNotice')}</p>
            <Link to="/login" className="journal-auth-link inline-block">
              {t('auth:forgotPassword.backToLogin')}
            </Link>
          </div>
        )}
      </div>

      <p className="text-center text-sm text-gray-500 mt-6">{t('common:footer')}</p>
    </JournalAuthShell>
  );
};

export default ForgotPasswordPage;
