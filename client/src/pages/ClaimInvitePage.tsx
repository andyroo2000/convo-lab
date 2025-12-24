import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Logo from '../components/common/Logo';
import { API_URL } from '../config';

export default function ClaimInvitePage() {
  const { t } = useTranslation('auth');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  useEffect(() => {
    if (!token) {
      // No token provided, redirect to login
      navigate('/login?error=missing_token');
    }
  }, [token, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/auth/claim-invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ inviteCode, token }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || error.message || 'Failed to claim invite');
      }

      // Successfully claimed invite, reload page to update auth context
      window.location.href = '/app/library';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return null;
  }

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-2">
            <h1 className="text-4xl font-bold text-dark-brown">ConvoLab</h1>
            <Logo size="large" />
          </div>
          <p className="text-medium-brown">Your personal AI language lab</p>
        </div>

        <div className="card">
          <h2 className="text-2xl font-bold text-dark-brown mb-2">
            {t('claimInvite.title')}
          </h2>
          <p className="text-medium-brown mb-6">
            {t('claimInvite.description')}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="inviteCode" className="block text-sm font-medium text-dark-brown mb-1">
                {t('claimInvite.codeLabel')}
              </label>
              <input
                id="inviteCode"
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                className="input"
                placeholder={t('claimInvite.codePlaceholder')}
                required
                autoFocus
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
              {loading ? t('claimInvite.verifying') : t('claimInvite.continue')}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-sm text-medium-brown text-center">
              {t('claimInvite.noCode')}{' '}
              <a
                href="mailto:support@convolab.app"
                className="text-periwinkle hover:text-dark-periwinkle"
              >
                {t('claimInvite.contact')}
              </a>
            </p>
          </div>
        </div>

        <p className="text-center text-sm text-gray-500 mt-6">
          By Conversational Dynamics Consulting Group
        </p>
      </div>
    </div>
  );
}
