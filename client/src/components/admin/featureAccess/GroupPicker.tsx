import { useId } from 'react';
import { newGroup } from './api';
import type { AccessGroup } from './api';

interface Props {
  groups: AccessGroup[];
  selected: string[];
  onChange: (ids: string[]) => void;
  onEdit: (group: AccessGroup) => void;
  disabled: boolean;
}
const GroupPicker = ({ groups, selected, onChange, onEdit, disabled }: Props) => {
  const id = useId();
  return (
    <section aria-label="Select groups">
      <div className="access-group-heading">
        <h3>Reusable groups</h3>
        <button type="button" disabled={disabled} onClick={() => onEdit(newGroup())}>
          Create group
        </button>
      </div>
      <p>Current and future members inherit access from selected groups.</p>
      {groups.length === 0 && <p>No groups yet. Create one and choose its members.</p>}
      {groups.map((group) => (
        <div className="access-group" key={group.id}>
          <label htmlFor={`${id}-${group.id}`}>
            <input
              id={`${id}-${group.id}`}
              type="checkbox"
              checked={selected.includes(group.id)}
              disabled={disabled}
              onChange={(event) =>
                onChange(
                  event.target.checked
                    ? [...selected, group.id]
                    : selected.filter((groupId) => groupId !== group.id)
                )
              }
            />
            <span>
              <strong>{group.name}</strong>
              <small>
                {group.users.length} members · Used by {group.features.length} features
              </small>
            </span>
          </label>
          <button
            type="button"
            disabled={disabled}
            aria-label={`Manage members of ${group.name}`}
            onClick={() => onEdit(group)}
          >
            Manage members
          </button>
        </div>
      ))}
    </section>
  );
};
export default GroupPicker;
