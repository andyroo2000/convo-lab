import type { ReactNode } from 'react';
import { journalTextStyle } from './journalTypography';

const JournalPaper = ({ children, heading }: { children: ReactNode; heading?: ReactNode }) => (
  <article
    aria-label="Notebook sheet"
    style={journalTextStyle}
    lang="ja"
    className={`journal-paper text-xl leading-[2.7] text-navy${heading ? ' journal-paper-with-heading' : ''}`}
  >
    {heading}
    <div className="journal-paper-body whitespace-pre-wrap">{children}</div>
  </article>
);

export default JournalPaper;
