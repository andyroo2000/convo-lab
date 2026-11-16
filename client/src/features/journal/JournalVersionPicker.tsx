import './journalVersionPicker.css';

type Version = 'draft' | 'final';

const JournalVersionPicker = ({
  value,
  onChange,
}: {
  value: Version;
  onChange: (value: Version) => void;
}) => (
  <div role="group" aria-label="Entry version" className="journal-version-picker">
    {(['draft', 'final'] as const).map((version) => (
      <button
        key={version}
        type="button"
        aria-pressed={value === version}
        onClick={() => onChange(version)}
        className="journal-version-button"
      >
        {version === 'draft' ? 'Draft' : 'Final'}
      </button>
    ))}
  </div>
);
export default JournalVersionPicker;
