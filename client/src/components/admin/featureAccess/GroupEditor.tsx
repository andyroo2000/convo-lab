import { useId, useState } from 'react';
import { saveGroup, type AccessGroup } from './api';
import AccessDialog from './AccessDialog';
import UserPicker from './UserPicker';
import SelectedUsers from './SelectedUsers';
import AccessSaveFooter from './AccessSaveFooter';
import useAccessSave from './useAccessSave';

interface Props {
  group: AccessGroup;
  groups: AccessGroup[];
  onClose: () => void;
  onSaved: (group: AccessGroup) => void;
}
const GroupEditor = ({ group, groups, onClose, onSaved }: Props) => {
  const nameId = useId();
  const [name, setName] = useState(group.name);
  const [users, setUsers] = useState(group.users);
  const save = useAccessSave();
  const valid = name.trim().length > 0 && [...name.trim()].length <= 80 && users.length <= 1000;
  return (
    <AccessDialog
      title={group.id ? 'Manage group members' : 'Create group'}
      busy={save.busy}
      onClose={onClose}
    >
      <div className="access-body">
        <label className="access-name" htmlFor={nameId}>
          Group name
          <input
            id={nameId}
            value={name}
            maxLength={80}
            disabled={save.busy}
            placeholder="For example, Beta testers"
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <p className="access-context">
          {group.features.length
            ? `Membership changes apply immediately to ${group.features.map((feature) => feature.replace('Enabled', '')).join(', ')}. Individual grants remain unchanged.`
            : 'Reusable across features. Creating a group does not grant feature access until you save its audience.'}
        </p>
        <UserPicker selected={users} onChange={setUsers} groups={groups} disabled={save.busy} />
        <SelectedUsers users={users} onChange={setUsers} disabled={save.busy} />
        {users.length > 1000 && <p role="alert">Choose at most 1,000 members.</p>}
        {save.error && <p role="alert">{save.error}</p>}
      </div>
      <AccessSaveFooter
        busy={save.busy}
        valid={valid}
        onClose={onClose}
        onSave={() => save.run(() => saveGroup({ ...group, name: name.trim(), users }), onSaved)}
        label={group.id ? 'Save group' : 'Create group'}
      >
        {users.length} members
      </AccessSaveFooter>
    </AccessDialog>
  );
};
export default GroupEditor;
