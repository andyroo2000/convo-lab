import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Logo from '../components/common/Logo';
import { ArrowLeft } from 'lucide-react';

export default function LoginPage() {
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
            Back to Home
          </Link>
        </div>

        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-2">
            <h1 className="text-4xl font-bold text-dark-brown">ConvoLab</h1>
            <Logo size="large" />
          </div>
          <p className="text-medium-brown">Your personal AI language lab</p>
        </div>

        <div className="card">
          <div className="flex space-x-4 mb-6">
            <button
              onClick={() => setIsLogin(true)}
              className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors ${
                isLogin
                  ? 'border-periwinkle text-periwinkle'
                  : 'border-transparent text-medium-brown hover:text-dark-brown'
              }`}
              data-testid="auth-tab-login"
            >
              Login
            </button>
            <button
              onClick={() => setIsLogin(false)}
              className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors ${
                !isLogin
                  ? 'border-periwinkle text-periwinkle'
                  : 'border-transparent text-medium-brown hover:text-dark-brown'
              }`}
              data-testid="auth-tab-signup"
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <>
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-dark-brown mb-1">
                    Name
                  </label>
                  <input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="input"
                    required={!isLogin}
                    data-testid="auth-input-name"
                  />
                </div>

                <div>
                  <label htmlFor="inviteCode" className="block text-sm font-medium text-dark-brown mb-1">
                    Invite Code
                  </label>
                  <input
                    id="inviteCode"
                    type="text"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                    className="input"
                    placeholder="Enter your invite code"
                    required={!isLogin}
                    data-testid="auth-input-invite-code"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    ConvoLab is currently invite-only
                  </p>
                </div>
              </>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-dark-brown mb-1">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                required
                data-testid="auth-input-email"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-dark-brown mb-1">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
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
              {loading ? 'Loading...' : isLogin ? 'Login' : 'Sign Up'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-gray-500 mt-6">
          By Conversational Dynamics Consulting Group
        </p>
      </div>
    </div>
  );
}
