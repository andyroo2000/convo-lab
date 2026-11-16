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
    {(['draft', 'final'] as const).map((version, index) => (
      <button
        key={version}
        type="button"
        aria-pressed={value === version}
        onClick={() => onChange(version)}
        className="journal-version-button"
      >
        <span className="journal-version-number" aria-hidden="true">
          {index + 1}
        </span>
        {version === 'draft' ? 'Draft' : 'Final'}
      </button>
    ))}
  </div>
);
export default JournalVersionPicker;
