import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import JournalAuthShell from '../components/common/JournalAuthShell';
import { authApi } from '../lib/authApi';

const ClaimInvitePage = () => {
  const { t } = useTranslation('auth');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch(authApi.claimInvite, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(authApi.claimInviteBody(inviteCode)),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || errorData.message || 'Failed to claim invite');
      }

      // Successfully claimed invite, reload page to update auth context
      window.location.href = '/app/journal';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <JournalAuthShell invite>
      <h1>{t('claimInvite.title')}</h1>
      <p className="journal-auth-description">{t('claimInvite.description')}</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="inviteCode" className="journal-auth-label">
            {t('claimInvite.codeLabel')}
          </label>
          <input
            id="inviteCode"
            type="text"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            className="journal-auth-input"
            autoCapitalize="none"
            spellCheck={false}
            placeholder={t('claimInvite.codePlaceholder')}
            required
            // eslint-disable-next-line jsx-a11y/no-autofocus -- Intentional: Primary action on page
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
          className="journal-auth-submit disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? t('claimInvite.verifying') : t('claimInvite.continue')}
        </button>
      </form>

      <div className="mt-6 pt-6 border-t border-gray-200">
        <p className="journal-auth-contact">
          {t('claimInvite.noCode')}{' '}
          <a href="mailto:support@convolab.app" className="journal-auth-link">
            {t('claimInvite.contact')}
          </a>
        </p>
      </div>
    </JournalAuthShell>
  );
};

export default ClaimInvitePage;
