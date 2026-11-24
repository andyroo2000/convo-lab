import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { inviteFromSearch, rememberBetaInvite, clearBetaInvite } from '../lib/betaInvite';
import JournalAuthShell from '../components/common/JournalAuthShell';
import { useAuth } from '../contexts/AuthContext';
import { authApi } from '../lib/authApi';

interface AuthModeProps {
  isLogin: boolean;
}

interface AuthModeTabsProps extends AuthModeProps {
  onChange: (isLogin: boolean) => void;
}

interface SignupFieldsProps extends AuthModeProps {
  name: string;
  inviteCode: string;
  onNameChange: (name: string) => void;
  onInviteCodeChange: (inviteCode: string) => void;
}

interface CredentialsFieldsProps extends AuthModeProps {
  email: string;
  password: string;
  onEmailChange: (email: string) => void;
  onPasswordChange: (password: string) => void;
}

interface SubmitButtonProps extends AuthModeProps {
  loading: boolean;
}

const NETWORK_SIGNUP_ERROR =
  'Network error during signup. Your account may have been created. ' +
  'Try logging in with your credentials, or wait a moment and try again.';
const EXISTING_ACCOUNT_ERROR =
  'This email is already registered. If you just signed up, try logging in instead.';

const getErrorMessage = (error: unknown, isLogin: boolean) => {
  const message = error instanceof Error ? error.message : 'An error occurred';
  if (isLogin) return message;

  const normalizedMessage = message.toLowerCase();
  if (normalizedMessage.includes('fetch')) return NETWORK_SIGNUP_ERROR;
  if (normalizedMessage.includes('already exists')) return EXISTING_ACCOUNT_ERROR;
  return message;
};

const AuthModeTabs = ({ isLogin, onChange }: AuthModeTabsProps) => {
  const { t } = useTranslation(['auth']);
  return (
    <header className="journal-auth-heading">
      <h1 data-testid={isLogin ? 'auth-tab-login' : 'auth-tab-signup'}>
        {t(isLogin ? 'auth:login.title' : 'auth:signup.title')}
      </h1>
      <p>
        {t(isLogin ? 'auth:login.noAccount' : 'auth:signup.hasAccount')}{' '}
        <button
          type="button"
          onClick={() => onChange(!isLogin)}
          data-testid={isLogin ? 'auth-tab-signup' : 'auth-tab-login'}
        >
          {t(isLogin ? 'auth:login.signup' : 'auth:signup.login')}
        </button>
      </p>
    </header>
  );
};

const SignupFields = ({
  isLogin,
  name,
  inviteCode,
  onNameChange,
  onInviteCodeChange,
}: SignupFieldsProps) => {
  const { t } = useTranslation(['auth']);
  if (isLogin) return null;

  return (
    <>
      <div>
        <label htmlFor="name" className="journal-auth-label">
          {t('auth:signup.name')}
        </label>
        <input
          id="name"
          type="text"
          autoComplete="name"
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          className="journal-auth-input"
          placeholder={t('auth:signup.namePlaceholder')}
          required
          data-testid="auth-input-name"
        />
      </div>
      <div>
        <label htmlFor="inviteCode" className="journal-auth-label">
          {t('auth:signup.inviteCode')}
        </label>
        <input
          id="inviteCode"
          type="text"
          value={inviteCode}
          onChange={(event) => onInviteCodeChange(event.target.value)}
          className="journal-auth-input"
          placeholder={t('auth:signup.inviteCodePlaceholder')}
          required
          data-testid="auth-input-invite-code"
        />
      </div>
    </>
  );
};

const CredentialsFields = ({
  isLogin,
  email,
  password,
  onEmailChange,
  onPasswordChange,
}: CredentialsFieldsProps) => {
  const { t } = useTranslation(['auth']);
  const mode = isLogin ? 'login' : 'signup';

  const passwordAttributes = isLogin
    ? { autoComplete: 'current-password', placeholder: t('auth:login.passwordPlaceholder') }
    : {
        autoComplete: 'new-password',
        pattern: '.{8,}',
        title: t('auth:signup.passwordHelp'),
        'aria-describedby': 'signup-password-help',
      };

  return (
    <>
      <div>
        <label htmlFor="email" className="journal-auth-label">
          {t(`auth:${mode}.email`)}
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => onEmailChange(event.target.value)}
          className="journal-auth-input"
          placeholder={t(`auth:${mode}.emailPlaceholder`)}
          required
          data-testid="auth-input-email"
        />
      </div>
      <div>
        <div className="flex items-center justify-between mb-1">
          <label htmlFor="password" className="journal-auth-label">
            {t(`auth:${mode}.password`)}
          </label>
          {isLogin && (
            <Link to="/forgot-password" className="journal-auth-forgot">
              {t('auth:login.forgotPassword')}
            </Link>
          )}
        </div>
        <input
          id="password"
          type="password"
          {...passwordAttributes}
          value={password}
          onChange={(event) => onPasswordChange(event.target.value)}
          className="journal-auth-input"
          required
          data-testid="auth-input-password"
        />
        {!isLogin && (
          <p id="signup-password-help" className="mt-1 text-sm text-gray-600">
            {t('auth:signup.passwordHelp')}
          </p>
        )}
      </div>
    </>
  );
};

const SubmitButton = ({ isLogin, loading }: SubmitButtonProps) => {
  const { t } = useTranslation(['auth']);
  const mode = isLogin ? 'login' : 'signup';
  const action = loading ? 'submitting' : 'submit';

  return (
    <button
      type="submit"
      disabled={loading}
      className="journal-auth-submit disabled:opacity-50 disabled:cursor-not-allowed"
      data-testid="auth-submit-button"
    >
      {t(`auth:${mode}.${action}`)}
    </button>
  );
};

const GoogleAuth = ({ isLogin, inviteCode }: AuthModeProps & { inviteCode: string }) => {
  const { t } = useTranslation(['auth']);
  const mode = isLogin ? 'login' : 'signup';

  return (
    <>
      <div className="journal-auth-divider">
        <div className="journal-auth-divider-line" />
        <span className="journal-auth-divider-text">{t(`auth:${mode}.orContinueWith`)}</span>
        <div className="journal-auth-divider-line" />
      </div>
      <a
        href={authApi.googleStart}
        onClick={() => rememberBetaInvite(inviteCode)}
        className="journal-auth-google-btn"
        data-testid="auth-google-link"
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
        {t(`auth:${mode}.continueWithGoogle`)}
      </a>
    </>
  );
};

const LoginPage = () => {
  const [searchParams] = useSearchParams();
  const [isLogin, setIsLogin] = useState(() => !inviteFromSearch(searchParams));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [inviteCode, setInviteCode] = useState(() => inviteFromSearch(searchParams));
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, signup } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) await login(email, password);
      else await signup(email, password, name, inviteCode);

      clearBetaInvite();
      navigate(searchParams.get('returnUrl') || '/app/journal');
    } catch (caughtError) {
      setError(getErrorMessage(caughtError, isLogin));
    } finally {
      setLoading(false);
    }
  };

  return (
    <JournalAuthShell>
      <AuthModeTabs isLogin={isLogin} onChange={setIsLogin} />
      <form onSubmit={handleSubmit} className="space-y-4">
        <SignupFields
          isLogin={isLogin}
          name={name}
          inviteCode={inviteCode}
          onNameChange={setName}
          onInviteCodeChange={setInviteCode}
        />
        <CredentialsFields
          isLogin={isLogin}
          email={email}
          password={password}
          onEmailChange={setEmail}
          onPasswordChange={setPassword}
        />
        {error && (
          <div role="alert" className="journal-auth-error">
            {error}
          </div>
        )}
        <SubmitButton isLogin={isLogin} loading={loading} />
      </form>
      <GoogleAuth isLogin={isLogin} inviteCode={inviteCode} />
    </JournalAuthShell>
  );
};

export default LoginPage;
