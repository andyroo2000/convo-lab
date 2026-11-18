import './journalBrand.css';

const JournalBrand = ({ compact = false }: { compact?: boolean }) => (
  <span
    className={`journal-brand${compact ? ' journal-brand-compact' : ''}`}
    aria-label="ConvoLab Journal"
  >
    <span className="journal-brand-name">CONVO-LAB</span>
    <span className="journal-brand-kana" lang="ja">
      コンボ・ラボ
    </span>
    {!compact && (
      <span className="journal-brand-section">
        <span className="journal-brand-title">JOURNAL</span>
        <span className="journal-brand-reading" lang="ja">
          ジャーナル
        </span>
      </span>
    )}
  </span>
);

export default JournalBrand;
