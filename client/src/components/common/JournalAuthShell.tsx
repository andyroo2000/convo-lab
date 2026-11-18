import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import JournalBrand from './JournalBrand';

const JournalAuthShell = ({
  children,
  invite = false,
}: {
  children: ReactNode;
  invite?: boolean;
}) => {
  const { t } = useTranslation('common');
  return (
    <main className={`journal-auth${invite ? ' journal-auth-invite' : ''}`}>
      <div className="journal-auth-inner">
        <Link
          to="/"
          className="journal-auth-brand"
          data-testid="auth-link-back-home"
          aria-label={t('journalBrand.home')}
        >
          <JournalBrand />
        </Link>
        <section className="journal-auth-panel">{children}</section>
      </div>
    </main>
  );
};

export default JournalAuthShell;
