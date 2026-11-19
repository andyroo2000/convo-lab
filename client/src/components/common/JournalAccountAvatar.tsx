import './journalAccountAvatar.css';

const JournalAccountAvatar = ({ name }: { name: string }) => (
  <span className="journal-account-avatar" aria-hidden="true">
    {Array.from(name.trim())[0]?.toUpperCase() || '?'}
  </span>
);

export default JournalAccountAvatar;
