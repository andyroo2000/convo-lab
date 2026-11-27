import { useState } from 'react';
import { saveAudience, type FeatureAudience, type AccessGroup } from './api';
import AccessDialog from './AccessDialog';
import GroupEditor from './GroupEditor';
import GroupPicker from './GroupPicker';
import { newGroup } from './api';
import SelectedUsers from './SelectedUsers';
import UserPicker from './UserPicker';
import AccessSaveFooter from './AccessSaveFooter';
import useAccessSave from './useAccessSave';

interface Props {
  audience: FeatureAudience;
  groups: AccessGroup[];
  label: string;
  global: boolean;
  onClose: () => void;
  onSaved: (audience: FeatureAudience) => void;
  onGroupSaved: (group: AccessGroup) => void;
}
function useAudienceDraft(props: Pick<Props, 'audience' | 'onGroupSaved'>) {
  const [users, setUsers] = useState(props.audience.users);
  const [groupIds, setGroupIds] = useState(props.audience.groupIds);
  const [tab, setTab] = useState('users');
  const [editing, setEditing] = useState<AccessGroup>();
  const save = useAccessSave();
  const original = new Set(props.audience.users.map((user) => user.id));
  const selected = new Set(users.map((user) => user.id));
  const added = users.filter((user) => !original.has(user.id)).length;
  const removed = props.audience.users.filter((user) => !selected.has(user.id)).length;
  const groupsChanged = [...groupIds].sort().join() !== [...props.audience.groupIds].sort().join();
  const changed = added + removed > 0 || groupsChanged;
  function groupSaved(group: AccessGroup) {
    props.onGroupSaved(group);
    if (!editing?.id) setGroupIds((current) => [...current, group.id]);
    setEditing(undefined);
  }
  return {
    users,
    setUsers,
    groupIds,
    setGroupIds,
    tab,
    setTab,
    editing,
    setEditing,
    save,
    added,
    removed,
    groupsChanged,
    changed,
    groupSaved,
  };
}
function accessReminder(global: boolean) {
  return global
    ? 'Everyone: On. Saved grants will apply if global access is turned off.'
    : 'Everyone: Off. Selected users and group members get access.';
}
const AudienceEditor = (props: Props) => {
  const {
    audience: initialAudience,
    groups,
    label,
    global,
    onClose,
    onSaved,
    onGroupSaved,
  } = props;
  const [audience] = useState(initialAudience);
  const {
    users,
    setUsers,
    groupIds,
    setGroupIds,
    tab,
    setTab,
    editing,
    setEditing,
    save,
    added,
    removed,
    groupsChanged,
    changed,
    groupSaved,
  } = useAudienceDraft({ audience, onGroupSaved });
  return (
    <AccessDialog title={`Edit audience · ${label}`} busy={save.busy} onClose={onClose}>
      <div className="access-body">
        <p className="access-context">{accessReminder(global)} Admins retain access.</p>
        <div className="access-tabs">
          <button type="button" aria-pressed={tab === 'users'} onClick={() => setTab('users')}>
            Users
          </button>
          <button type="button" aria-pressed={tab === 'groups'} onClick={() => setTab('groups')}>
            Groups
          </button>
        </div>
        {tab === 'users' ? (
          <UserPicker
            selected={users}
            onChange={setUsers}
            groups={groups}
            grantedGroups={groupIds}
            disabled={save.busy}
          />
        ) : (
          <GroupPicker
            groups={groups}
            selected={groupIds}
            onChange={setGroupIds}
            onEdit={setEditing}
            disabled={save.busy}
          />
        )}
        <SelectedUsers users={users} onChange={setUsers} disabled={save.busy} />
        <button
          type="button"
          disabled={save.busy || users.length === 0}
          onClick={() => setEditing({ ...newGroup(), users })}
        >
          Create group from selected users
        </button>
        <p>
          Selected groups:{' '}
          {groups
            .filter((group) => groupIds.includes(group.id))
            .map((group) => group.name)
            .join(', ') || 'None'}
        </p>
        <p className="access-hint">
          Removing a direct grant does not remove access through a selected group.
        </p>
        {users.length > 1000 && <p role="alert">Choose at most 1,000 individual users.</p>}
        {save.error && (
          <p role="alert">
            {save.error} Your selections have been kept. For a conflict, cancel and reopen to load
            the latest audience.
          </p>
        )}
      </div>
      <AccessSaveFooter
        busy={save.busy}
        valid={changed && users.length <= 1000}
        onClose={onClose}
        onSave={() => save.run(() => saveAudience({ ...audience, users, groupIds }), onSaved)}
        label="Save audience"
      >
        {added} users to add · {removed} to remove{groupsChanged ? ' · Groups changed' : ''}
      </AccessSaveFooter>
      {editing && (
        <GroupEditor
          group={editing}
          groups={groups}
          onClose={() => setEditing(undefined)}
          onSaved={groupSaved}
        />
      )}
    </AccessDialog>
  );
};
export default AudienceEditor;
