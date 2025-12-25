import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, CheckCircle, XCircle, Loader2, Lock } from 'lucide-react';
import Logo from '../components/common/Logo';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const ResetPasswordPage = () => {
  const { t } = useTranslation(['auth', 'common']);
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();

  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      setValidating(false);
      setError('Invalid reset link');
      return;
    }

    // Validate the token
    const validateToken = async () => {
      try {
        const response = await fetch(`${API_URL}/api/password-reset/${token}`, {
          credentials: 'include',
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Invalid or expired token');
        }

        const data = await response.json();
        setEmail(data.email);
        setTokenValid(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Invalid or expired token');
        setTokenValid(false);
      } finally {
        setValidating(false);
      }
    };

    validateToken();
  }, [token]);

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
      const response = await fetch(`${API_URL}/api/password-reset/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          token,
          newPassword,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to reset password');
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
    <div className="min-h-screen bg-cream flex items-center justify-center px-4">
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
          {validating && (
            <div className="text-center py-8">
              <Loader2 className="w-12 h-12 text-periwinkle animate-spin mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-dark-brown mb-2">
                {t('auth:resetPassword.validating.title')}
              </h2>
              <p className="text-medium-brown">{t('auth:resetPassword.validating.description')}</p>
            </div>
          )}

          {!validating && !tokenValid && (
            <div className="text-center py-8">
              <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
              <h2 className="text-2xl font-semibold text-dark-brown mb-2">
                {t('auth:resetPassword.invalid.title')}
              </h2>
              <p className="text-red-600 mb-6">{error}</p>
              <p className="text-medium-brown mb-6">
                {t('auth:resetPassword.invalid.description')}
              </p>
              <Link to="/forgot-password" className="btn-primary inline-block">
                {t('auth:resetPassword.invalid.requestNewLink')}
              </Link>
            </div>
          )}

          {!validating && tokenValid && !success && (
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
