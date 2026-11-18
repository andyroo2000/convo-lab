import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import JournalBrand from './JournalBrand';

const JournalAuthShell = ({
  children,
  invite = false,
}: {
  children: ReactNode;
  invite?: boolean;
}) => (
  <main className={`journal-auth${invite ? ' journal-auth-invite' : ''}`}>
    <div className="journal-auth-inner">
      <Link
        to="/"
        className="journal-auth-brand"
        data-testid="auth-link-back-home"
        aria-label="ConvoLab Journal home"
      >
        <JournalBrand />
      </Link>
      <section className="journal-auth-panel">{children}</section>
    </div>
  </main>
);

export default JournalAuthShell;
