import type { AdminFeatureFlagKey, AdminFeatureFlags } from '../../lib/adminApi';

const SECTIONS = [
  {
    key: 'flashcardsEnabled',
    label: 'Study / Flashcards',
    description: 'Flashcards, imports, and study pages.',
    aria: 'Toggle Study and Flashcards',
  },
  {
    key: 'readingsEnabled',
    label: 'Readings',
    description: 'Reading library and reader.',
    aria: 'Toggle Readings',
  },
  {
    key: 'studyTimeEnabled',
    label: 'Study time',
    description: 'Timers, calendar, and study history.',
    aria: 'Toggle Study time',
  },
] as const;

interface Props {
  flags: AdminFeatureFlags;
  saving: ReadonlySet<AdminFeatureFlagKey>;
  onChange: (key: AdminFeatureFlagKey, value: boolean) => void;
}

const AdminFeatureSwitches = ({ flags, saving, onChange }: Props) => (
    <div className="admin-feature-switches">
      <div className="admin-feature-row">
        <div>
          <h3>Journal</h3>
          <p>Writing, corrections, narration, and follow-ups.</p>
        </div>
        <span>Always on</span>
      </div>
      {SECTIONS.map(({ key, label, description, aria }) => (
        <label htmlFor={`admin-feature-${key}`} key={key} className="admin-feature-row">
          <span>
            <strong>{label}</strong>
            <p>{description}</p>
          </span>
          <input
            id={`admin-feature-${key}`}
            type="checkbox"
            role="switch"
            aria-label={aria}
            checked={flags[key] === true}
            disabled={saving.has(key)}
            onChange={(event) => onChange(key, event.target.checked)}
          />
        </label>
      ))}
    </div>
  );

export default AdminFeatureSwitches;
