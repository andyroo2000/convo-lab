import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import Logo from '../components/common/Logo';
import { API_URL } from '../config';

const LoginPage = () => {
  const { t } = useTranslation(['auth', 'common']);
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login, signup } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        await login(email, password);
      } else {
        await signup(email, password, name, inviteCode);
      }

      // Redirect to returnUrl if present, otherwise go to /app/library
      const returnUrl = searchParams.get('returnUrl') || '/app/library';
      navigate(returnUrl);
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
            to="/"
            className="inline-flex items-center gap-2 text-medium-brown hover:text-dark-brown transition-colors"
            data-testid="auth-link-back-home"
          >
            <ArrowLeft className="w-4 h-4" />
            {t('common:buttons.backToHome')}
          </Link>
        </div>

        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-2">
            <h1 className="text-4xl font-bold text-dark-brown">ConvoLab</h1>
            <Logo size="large" />
          </div>
          <p className="text-medium-brown">{t('common:tagline')}</p>
        </div>

        <div className="card">
          <div className="flex space-x-4 mb-6">
            <button type="button"
              onClick={() => setIsLogin(true)}
              className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors ${
                isLogin
                  ? 'border-periwinkle text-periwinkle'
                  : 'border-transparent text-medium-brown hover:text-dark-brown'
              }`}
              data-testid="auth-tab-login"
            >
              {t('auth:login.title')}
            </button>
            <button type="button"
              onClick={() => setIsLogin(false)}
              className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors ${
                !isLogin
                  ? 'border-periwinkle text-periwinkle'
                  : 'border-transparent text-medium-brown hover:text-dark-brown'
              }`}
              data-testid="auth-tab-signup"
            >
              {t('auth:signup.title')}
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <>
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-dark-brown mb-1">
                    {t('auth:signup.name')}
                  </label>
                  <input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="input"
                    placeholder={t('auth:signup.namePlaceholder')}
                    required={!isLogin}
                    data-testid="auth-input-name"
                  />
                </div>

                <div>
                  <label
                    htmlFor="inviteCode"
                    className="block text-sm font-medium text-dark-brown mb-1"
                  >
                    {t('auth:signup.inviteCode')}
                  </label>
                  <input
                    id="inviteCode"
                    type="text"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                    className="input"
                    placeholder={t('auth:signup.inviteCodePlaceholder')}
                    required={!isLogin}
                    data-testid="auth-input-invite-code"
                  />
                </div>
              </>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-dark-brown mb-1">
                {isLogin ? t('auth:login.email') : t('auth:signup.email')}
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder={
                  isLogin ? t('auth:login.emailPlaceholder') : t('auth:signup.emailPlaceholder')
                }
                required
                data-testid="auth-input-email"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="password" className="block text-sm font-medium text-dark-brown">
                  {isLogin ? t('auth:login.password') : t('auth:signup.password')}
                </label>
                {isLogin && (
                  <Link
                    to="/forgot-password"
                    className="text-xs text-periwinkle hover:text-dark-periwinkle"
                  >
                    {t('auth:login.forgotPassword')}
                  </Link>
                )}
              </div>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                placeholder={
                  isLogin
                    ? t('auth:login.passwordPlaceholder')
                    : t('auth:signup.passwordPlaceholder')
                }
                required
                data-testid="auth-input-password"
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
              data-testid="auth-submit-button"
            >
              {loading
                ? isLogin
                  ? t('auth:login.submitting')
                  : t('auth:signup.submitting')
                : isLogin
                  ? t('auth:login.submit')
                  : t('auth:signup.submit')}
            </button>
          </form>

          {/* OAuth Divider */}
          <div className="my-6 flex items-center">
            <div className="flex-1 border-t border-gray-300" />
            <span className="px-4 text-sm text-medium-brown">
              {isLogin ? t('auth:login.orContinueWith') : t('auth:signup.orContinueWith')}
            </span>
            <div className="flex-1 border-t border-gray-300" />
          </div>

          {/* Google OAuth Button */}
          <a
            href={`${API_URL}/api/auth/google`}
            className="flex items-center justify-center gap-3 w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-dark-brown font-medium hover:bg-gray-50 transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            {isLogin ? t('auth:login.continueWithGoogle') : t('auth:signup.continueWithGoogle')}
          </a>
        </div>

        <p className="text-center text-sm text-gray-500 mt-6">{t('common:footer')}</p>
      </div>
    </div>
  );
};

export default LoginPage;
