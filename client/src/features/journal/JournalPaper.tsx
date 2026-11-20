import type { ReactNode } from 'react';
import { journalTextStyle } from './journalTypography';

interface JournalPaperProps {
  children: ReactNode;
  heading?: ReactNode;
  label?: string;
}

const JournalPaper = ({ children, heading, label = 'Notebook sheet' }: JournalPaperProps) => (
  <article
    aria-label={label}
    style={journalTextStyle}
    lang="ja"
    className={`journal-paper text-xl leading-[2.7] text-navy${heading ? ' journal-paper-with-heading' : ''}`}
  >
    {heading}
    <div className="journal-paper-body whitespace-pre-wrap">{children}</div>
  </article>
);

export default JournalPaper;
