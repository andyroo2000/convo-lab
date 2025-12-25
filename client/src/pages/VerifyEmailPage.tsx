import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, CheckCircle, XCircle, Loader2, Mail } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import Logo from '../components/common/Logo';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const VerifyEmailPage = () => {
  const { t } = useTranslation(['auth', 'common']);
  const { token } = useParams<{ token: string }>();
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();

  const [status, setStatus] = useState<'verifying' | 'success' | 'error' | 'already-verified'>(
    'verifying'
  );
  const [error, setError] = useState('');
  const [resending, setResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      // User is just viewing the page (not coming from email link)
      if (user?.emailVerified) {
        setStatus('already-verified');
      }
      return;
    }

    // Verify the token
    const verifyToken = async () => {
      try {
        const response = await fetch(`${API_URL}/api/verification/${token}`, {
          credentials: 'include',
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Verification failed');
        }

        setStatus('success');

        // Refresh user data to get updated emailVerified status
        await refreshUser();

        // Redirect to app after 3 seconds
        setTimeout(() => {
          navigate('/app/library');
        }, 3000);
      } catch (err) {
        setStatus('error');
        setError(err instanceof Error ? err.message : 'Verification failed');
      }
    };

    verifyToken();
  }, [token, user, navigate, refreshUser]);

  const handleResendEmail = async () => {
    setResending(true);
    setResendSuccess(false);
    setError('');

    try {
      const response = await fetch(`${API_URL}/api/verification/send`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to resend email');
      }

      setResendSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resend email');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="mb-6">
          <Link
            to="/app/library"
            className="inline-flex items-center gap-2 text-medium-brown hover:text-dark-brown transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {t('auth:verifyEmail.backToLibrary')}
          </Link>
        </div>

        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-2">
            <h1 className="text-4xl font-bold text-dark-brown">ConvoLab</h1>
            <Logo size="large" />
          </div>
          <p className="text-medium-brown">{t('auth:verifyEmail.pageTitle')}</p>
        </div>

        <div className="card">
          {status === 'verifying' && (
            <div className="text-center py-8">
              <Loader2 className="w-12 h-12 text-periwinkle animate-spin mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-dark-brown mb-2">
                {t('auth:verifyEmail.verifying')}
              </h2>
              <p className="text-medium-brown">{t('auth:verifyEmail.verifyingDescription')}</p>
            </div>
          )}

          {status === 'success' && (
            <div className="text-center py-8">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-2xl font-semibold text-dark-brown mb-2">
                {t('auth:verifyEmail.success')}
              </h2>
              <p className="text-medium-brown mb-4">{t('auth:verifyEmail.successDescription')}</p>
              <p className="text-sm text-gray-500">{t('auth:verifyEmail.redirecting')}</p>
            </div>
          )}

          {status === 'error' && (
            <div className="text-center py-8">
              <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
              <h2 className="text-2xl font-semibold text-dark-brown mb-2">
                {t('auth:verifyEmail.failed')}
              </h2>
              <p className="text-red-600 mb-4">{error}</p>

              {user && !user.emailVerified && (
                <div className="mt-6">
                  <p className="text-medium-brown mb-4">{t('auth:verifyEmail.needNewLink')}</p>
                  <button
                    onClick={handleResendEmail}
                    disabled={resending}
                    className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {resending ? t('auth:verifyEmail.sending') : t('auth:verifyEmail.resendButton')}
                  </button>

                  {resendSuccess && (
                    <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-600 text-sm">
                      {t('auth:verifyEmail.resendSuccess')}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {status === 'already-verified' && (
            <div className="text-center py-8">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-2xl font-semibold text-dark-brown mb-2">
                {t('auth:verifyEmail.alreadyVerified')}
              </h2>
              <p className="text-medium-brown mb-6">
                {t('auth:verifyEmail.alreadyVerifiedDescription')}
              </p>
              <Link to="/app/library" className="btn-primary inline-block">
                {t('auth:verifyEmail.goToLibrary')}
              </Link>
            </div>
          )}

          {!token && !user?.emailVerified && user && (
            <div className="text-center py-8">
              <Mail className="w-16 h-16 text-periwinkle mx-auto mb-4" />
              <h2 className="text-2xl font-semibold text-dark-brown mb-2">
                {t('auth:verifyEmail.title')}
              </h2>
              <p className="text-medium-brown mb-6">
                {t('auth:verifyEmail.sentTo', { email: user.email })}
              </p>

              <button
                onClick={handleResendEmail}
                disabled={resending}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {resending ? t('auth:verifyEmail.sending') : t('auth:verifyEmail.resendButton')}
              </button>

              {resendSuccess && (
                <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-600 text-sm">
                  {t('auth:verifyEmail.resendSuccess')}
                </div>
              )}

              {error && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                  {error}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VerifyEmailPage;
