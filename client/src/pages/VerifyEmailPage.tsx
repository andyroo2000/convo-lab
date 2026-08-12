import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, CheckCircle, XCircle, Loader2, Mail } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import Logo from '../components/common/Logo';
import { authApi } from '../lib/authApi';

const VerifyEmailPage = () => {
  const { t } = useTranslation(['auth', 'common']);
  const { token } = useParams<{ token: string }>();
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();

  const [verification, setVerification] = useState<{
    token: string;
    status: 'verifying' | 'success' | 'error';
    error: string;
  } | null>(token ? { token, status: 'verifying', error: '' } : null);
  const [resending, setResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [resendError, setResendError] = useState('');
  const verificationGenerationRef = useRef(0);
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigateRef = useRef(navigate);
  const refreshUserRef = useRef(refreshUser);

  navigateRef.current = navigate;
  refreshUserRef.current = refreshUser;

  let status: 'verifying' | 'success' | 'error' | 'already-verified' | 'idle';
  if (token) {
    status = verification?.token === token ? verification.status : 'verifying';
  } else {
    status = user?.emailVerified ? 'already-verified' : 'idle';
  }
  const error = resendError || (token && verification?.token === token ? verification.error : '');

  useEffect(() => {
    verificationGenerationRef.current += 1;
    const generation = verificationGenerationRef.current;
    const controller = new AbortController();

    if (redirectTimerRef.current !== null) {
      clearTimeout(redirectTimerRef.current);
      redirectTimerRef.current = null;
    }

    setResendError('');
    setResendSuccess(false);

    if (!token) {
      return () => controller.abort();
    }

    setVerification({ token, status: 'verifying', error: '' });

    const ownsVerification = () =>
      verificationGenerationRef.current === generation && !controller.signal.aborted;

    const verifyToken = async () => {
      if (!ownsVerification()) return;

      try {
        const request = authApi.verifyEmail(token);
        const response = await fetch(request.url, {
          ...request.init,
          signal: controller.signal,
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(
            data.error?.message || data.error || data.message || 'Verification failed'
          );
        }

        if (!ownsVerification()) return;

        setVerification({ token, status: 'success', error: '' });

        redirectTimerRef.current = setTimeout(() => {
          if (!ownsVerification()) return;
          redirectTimerRef.current = null;
          navigateRef.current('/app/library');
        }, 3000);

        // Verification already succeeded. Refreshing the session is secondary and
        // must never turn that success into an error or start another token POST.
        try {
          await refreshUserRef.current();
        } catch {
          // The destination will refresh account state again after navigation.
        }
      } catch (err) {
        if (!ownsVerification()) return;

        setVerification({
          token,
          status: 'error',
          error: err instanceof Error ? err.message : 'Verification failed',
        });
      }
    };

    // Deferring one microtask lets React's development effect replay retire its
    // first generation before any single-use token request is sent.
    Promise.resolve().then(verifyToken);

    return () => {
      controller.abort();
      if (redirectTimerRef.current !== null) {
        clearTimeout(redirectTimerRef.current);
        redirectTimerRef.current = null;
      }
    };
  }, [token]);

  const handleResendEmail = async () => {
    setResending(true);
    setResendSuccess(false);
    setResendError('');

    try {
      const response = await fetch(authApi.resendVerification, {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(
          data.error?.message || data.error || data.message || 'Failed to resend email'
        );
      }

      setResendSuccess(true);
    } catch (err) {
      setResendError(err instanceof Error ? err.message : 'Failed to resend email');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-cream flex items-start sm:items-center justify-center px-4 py-8">
      <div className="max-w-md w-full">
        <div className="mb-6">
          <Link
            to={user ? '/app/library' : '/login'}
            className="inline-flex items-center gap-2 text-medium-brown hover:text-dark-brown transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {user ? t('auth:verifyEmail.backToLibrary') : t('auth:forgotPassword.backToLogin')}
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
                    type="button"
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

          {status === 'idle' && !user?.emailVerified && user && (
            <div className="text-center py-8">
              <Mail className="w-16 h-16 text-periwinkle mx-auto mb-4" />
              <h2 className="text-2xl font-semibold text-dark-brown mb-2">
                {t('auth:verifyEmail.title')}
              </h2>
              <p className="text-medium-brown mb-6">
                {t('auth:verifyEmail.sentTo', { email: user.email })}
              </p>

              <button
                type="button"
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

          {status === 'idle' && !user && (
            <div className="text-center py-8">
              <Mail className="w-16 h-16 text-periwinkle mx-auto mb-4" />
              <h2 className="text-2xl font-semibold text-dark-brown mb-2">Verify your email</h2>
              <p className="text-medium-brown mb-6">
                Sign in to view your verification status or request a new verification email.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link to="/login" className="btn-primary inline-block">
                  Go to Login
                </Link>
                <Link to="/" className="btn-outline inline-block">
                  Back Home
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VerifyEmailPage;
