import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Mail } from 'lucide-react';
import Logo from '../components/common/Logo';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function ForgotPasswordPage() {
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
      const response = await fetch(`${API_URL}/api/password-reset/request`, {
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
    <div className="min-h-screen bg-cream flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="mb-6">
          <Link
            to="/login"
            className="inline-flex items-center gap-2 text-medium-brown hover:text-dark-brown transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {t('auth:forgotPassword.backToLogin')}
          </Link>
        </div>

        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-2">
            <h1 className="text-4xl font-bold text-dark-brown">ConvoLab</h1>
            <Logo size="large" />
          </div>
          <p className="text-medium-brown">{t('auth:forgotPassword.subtitle')}</p>
        </div>

        <div className="card">
          {!success ? (
            <>
              <div className="text-center mb-6">
                <h2 className="text-2xl font-semibold text-dark-brown mb-2">
                  {t('auth:forgotPassword.title')}
                </h2>
                <p className="text-medium-brown text-sm">
                  {t('auth:forgotPassword.description')}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-dark-brown mb-1">
                    {t('auth:forgotPassword.email')}
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input"
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
                  className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? t('auth:forgotPassword.sending') : t('auth:forgotPassword.submit')}
                </button>
              </form>

              <div className="mt-6 text-center">
                <p className="text-sm text-gray-500">
                  {t('auth:forgotPassword.rememberPassword')}{' '}
                  <Link to="/login" className="text-periwinkle hover:text-dark-periwinkle font-medium">
                    {t('auth:forgotPassword.loginLink')}
                  </Link>
                </p>
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <Mail className="w-16 h-16 text-periwinkle mx-auto mb-4" />
              <h2 className="text-2xl font-semibold text-dark-brown mb-2">
                {t('auth:forgotPassword.checkEmail')}
              </h2>
              <p className="text-medium-brown mb-4">
                {t('auth:forgotPassword.emailSent', { email })}
              </p>
              <p className="text-sm text-gray-500 mb-6">
                {t('auth:forgotPassword.expiryNotice')}
              </p>
              <Link to="/login" className="btn-primary inline-block">
                {t('auth:forgotPassword.backToLogin')}
              </Link>
            </div>
          )}
        </div>

        <p className="text-center text-sm text-gray-500 mt-6">
          {t('common:footer')}
        </p>
      </div>
    </div>
  );
}
