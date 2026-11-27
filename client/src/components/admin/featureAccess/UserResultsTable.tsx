import type { AccessGroup, AudienceUser } from './api';

interface Props {
  users: AudienceUser[];
  selected: AudienceUser[];
  onChange: (users: AudienceUser[]) => void;
  groups: AccessGroup[];
  grantedGroups: string[];
  disabled: boolean;
}
const UserRow = ({
  user,
  checked,
  disabled,
  groups,
  grantedGroups,
  onToggle,
}: {
  user: AudienceUser;
  checked: boolean;
  disabled: boolean;
  groups: AccessGroup[];
  grantedGroups: string[];
  onToggle: (user: AudienceUser, checked: boolean) => void;
}) => (
  <tr key={user.id} className={checked ? 'is-selected' : ''}>
    <td>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        aria-label={`Select ${user.name || user.email}`}
        onChange={(event) => onToggle(user, event.target.checked)}
      />
    </td>
    <td>
      <strong>{user.name}</strong>
      <small>{user.email}</small>
    </td>
    <td>{user.role === 'admin' ? 'Admin' : 'User'}</td>
    <td>
      {groups
        .filter(
          (group) =>
            grantedGroups.includes(group.id) && group.users.some((member) => member.id === user.id)
        )
        .map((group) => group.name)
        .join(', ') || '—'}
    </td>
  </tr>
);
const UserResultsTable = ({
  users,
  selected,
  onChange,
  groups,
  grantedGroups,
  disabled,
}: Props) => {
  const ids = new Set(selected.map((user) => user.id));
  const all = users.length > 0 && users.every((user) => ids.has(user.id));
  const toggle = (user: AudienceUser, checked: boolean) =>
    onChange(checked ? [...selected, user] : selected.filter((item) => item.id !== user.id));
  function selectPage(checked: boolean) {
    const pageIds = new Set(users.map((user) => user.id));
    onChange(
      checked
        ? [...selected, ...users.filter((user) => !ids.has(user.id))]
        : selected.filter((user) => !pageIds.has(user.id))
    );
  }
  return (
    <div className="access-table-scroll">
      <table>
        <thead>
          <tr>
            <th>
              <input
                type="checkbox"
                aria-label="Select users on this page"
                checked={all}
                disabled={disabled || !users.length}
                ref={(element) => {
                  const checkbox = element;
                  if (checkbox)
                    checkbox.indeterminate = !all && users.some((user) => ids.has(user.id));
                }}
                onChange={(event) => selectPage(event.target.checked)}
              />
            </th>
            <th>User</th>
            <th>Role</th>
            <th>Group access</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <UserRow
              key={user.id}
              user={user}
              checked={ids.has(user.id)}
              disabled={disabled}
              groups={groups}
              grantedGroups={grantedGroups}
              onToggle={toggle}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
};
export default UserResultsTable;
