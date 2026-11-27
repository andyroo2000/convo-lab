import { useCallback, useState } from 'react';
import {
  getAudience,
  getGroups,
  type AccessGroup,
  type FeatureAudience,
} from './featureAccess/api';
import useAccessResource from './featureAccess/useAccessResource';
import FeatureAudienceControls from './featureAccess/FeatureAudienceControls';
import GroupDirectory from './featureAccess/GroupDirectory';
import './featureAccess/featureAccess.css';
import type { AdminFeatureFlagKey, AdminFeatureFlags } from '../../lib/adminApi';

const SECTIONS = [
  {
    key: 'learnEnabled',
    label: 'Learn',
    description: 'Guided textbook lessons and tutor practice.',
    aria: 'Toggle Learn',
  },
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

function useFeatureAccess() {
  const [manageGroups, setManageGroups] = useState(false);
  const load = useCallback(async (signal: AbortSignal) => {
    const [groups, ...audiences] = await Promise.all([
      getGroups(signal),
      ...SECTIONS.map((section) => getAudience(section.key, signal)),
    ]);
    return { groups: groups.groups, audiences };
  }, []);
  const resource = useAccessResource(load);
  const groups = resource.data?.groups ?? [];
  function groupSaved(group: AccessGroup) {
    resource.setData(
      (current) =>
        current && {
          ...current,
          groups: [...current.groups.filter((item) => item.id !== group.id), group].sort((a, b) =>
            a.name.localeCompare(b.name)
          ),
        }
    );
  }
  function audienceSaved(audience: FeatureAudience) {
    resource.setData(
      (current) =>
        current && {
          ...current,
          audiences: current.audiences.map((item) =>
            item.feature === audience.feature ? audience : item
          ),
        }
    );
    resource.reload();
  }
  return { manageGroups, setManageGroups, resource, groups, groupSaved, audienceSaved };
}
const AdminFeatureSwitches = ({ flags, saving, onChange }: Props) => {
  const { manageGroups, setManageGroups, resource, groups, groupSaved, audienceSaved } =
    useFeatureAccess();
  return (
    <div className="admin-feature-switches">
      <div className="access-group-heading">
        <p>Choose global access or a selected audience.</p>
        <button
          type="button"
          disabled={!resource.data}
          onClick={(event) => {
            event.currentTarget.focus();
            setManageGroups(true);
          }}
        >
          Manage groups
        </button>
      </div>
      {resource.loading && <p role="status">Loading audiences…</p>}
      {resource.error && (
        <p role="alert">
          {resource.error}{' '}
          <button type="button" onClick={resource.reload}>
            Retry audiences
          </button>
        </p>
      )}
      <div className="admin-feature-row">
        <div>
          <h3>Journal</h3>
          <p>Writing, corrections, narration, and follow-ups.</p>
        </div>
        <span>Always on</span>
      </div>
      {SECTIONS.map(({ key, label, description, aria }) => (
        <section className="feature-access-section" key={key}>
          <div className="admin-feature-row">
            <div>
              <h3>{label}</h3>
              <p>{description}</p>
            </div>
            <label className="access-global" htmlFor={`admin-feature-${key}`}>
              Everyone
              <input
                id={`admin-feature-${key}`}
                type="checkbox"
                role="switch"
                aria-label={aria}
                checked={flags[key] === true}
                disabled={saving.has(key)}
                onChange={(event) => onChange(key, event.target.checked)}
              />
              <span>{flags[key] ? 'On' : 'Off'}</span>
            </label>
          </div>
          <FeatureAudienceControls
            audience={resource.data?.audiences.find((item) => item.feature === key)}
            groups={groups}
            label={label}
            global={flags[key] === true}
            onSaved={audienceSaved}
            onGroupSaved={groupSaved}
          />
        </section>
      ))}
      {manageGroups && (
        <GroupDirectory
          groups={groups}
          onClose={() => setManageGroups(false)}
          onSaved={groupSaved}
        />
      )}
    </div>
  );
};
export default AdminFeatureSwitches;
