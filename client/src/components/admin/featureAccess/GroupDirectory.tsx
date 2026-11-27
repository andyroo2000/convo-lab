import { useState } from 'react';
import type { AccessGroup } from './api';
import AccessDialog from './AccessDialog';
import GroupEditor from './GroupEditor';
import { newGroup } from './api';

interface Props {
  groups: AccessGroup[];
  onClose: () => void;
  onSaved: (group: AccessGroup) => void;
}
const GroupDirectory = ({ groups, onClose, onSaved }: Props) => {
  const [editing, setEditing] = useState<AccessGroup>();
  return (
    <AccessDialog title="User groups" onClose={onClose}>
      <div className="access-body">
        <p>Create groups once, then use them across feature audiences.</p>
        <button type="button" onClick={() => setEditing(newGroup())}>
          Create group
        </button>
        {groups.length === 0 && <p>No groups yet.</p>}
        {groups.map((group) => (
          <div className="access-group" key={group.id}>
            <div>
              <strong>{group.name}</strong>
              <small>
                {group.users.length} members · Used by {group.features.length} features
              </small>
            </div>
            <button type="button" onClick={() => setEditing(group)}>
              Manage {group.name}
            </button>
          </div>
        ))}
      </div>
      <footer>
        <button type="button" onClick={onClose}>
          Done
        </button>
      </footer>
      {editing && (
        <GroupEditor
          group={editing}
          groups={groups}
          onClose={() => setEditing(undefined)}
          onSaved={(group) => {
            onSaved(group);
            setEditing(undefined);
          }}
        />
      )}
    </AccessDialog>
  );
};
export default GroupDirectory;
