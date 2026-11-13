type Version = 'draft' | 'final';

const JournalVersionPicker = ({
  value,
  onChange,
}: {
  value: Version;
  onChange: (value: Version) => void;
}) => (
  <div
    role="group"
    aria-label="Entry version"
    className="inline-flex rounded-full bg-slate-100 p-1"
  >
    {(['draft', 'final'] as const).map((version) => (
      <button
        key={version}
        type="button"
        aria-pressed={value === version}
        onClick={() => onChange(version)}
        className={`min-h-11 min-w-24 rounded-full px-5 text-sm font-medium transition-colors ${
          value === version ? 'bg-white text-navy shadow-sm' : 'text-gray-500 hover:text-navy'
        }`}
      >
        {version === 'draft' ? 'Draft' : 'Final'}
      </button>
    ))}
  </div>
);
export default JournalVersionPicker;
