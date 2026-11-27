import { useCallback, useEffect, useId, useState } from 'react';
import UserSearchStatus from './UserSearchStatus';
import UserSearchPagination from './UserSearchPagination';
import { searchUsers, type AccessGroup, type AudienceUser } from './api';
import useAccessResource from './useAccessResource';
import UserResultsTable from './UserResultsTable';

interface Props {
  selected: AudienceUser[];
  onChange: (users: AudienceUser[]) => void;
  groups: AccessGroup[];
  grantedGroups?: string[];
  disabled?: boolean;
}
const UserPicker = ({
  selected,
  onChange,
  groups,
  grantedGroups = [],
  disabled = false,
}: Props) => {
  const id = useId();
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [role, setRole] = useState('');
  const [groupId, setGroup] = useState('');
  const [page, setPage] = useState(1);
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(search);
      setPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);
  const load = useCallback(
    (signal: AbortSignal) =>
      searchUsers({ search: debounced, role, groupId, page: String(page) }, signal),
    [debounced, role, groupId, page]
  );
  const result = useAccessResource(load);
  const pending = result.loading || search !== debounced;
  return (
    <section className="access-user-picker" aria-label="Find users">
      <div className="access-filters">
        <label htmlFor={`${id}-search`}>
          Search users
          <input
            id={`${id}-search`}
            type="search"
            placeholder="Name or email"
            maxLength={200}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <label htmlFor={`${id}-role`}>
          Role
          <select
            id={`${id}-role`}
            value={role}
            onChange={(event) => {
              setRole(event.target.value);
              setPage(1);
            }}
          >
            <option value="">All roles</option>
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
        </label>
        <label htmlFor={`${id}-group`}>
          Group
          <select
            id={`${id}-group`}
            value={groupId}
            onChange={(event) => {
              setGroup(event.target.value);
              setPage(1);
            }}
          >
            <option value="">All groups</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <UserSearchStatus
        error={result.error}
        pending={pending}
        data={result.data}
        reload={result.reload}
      />
      <UserResultsTable
        users={result.data?.users ?? []}
        selected={selected}
        onChange={onChange}
        groups={groups}
        grantedGroups={grantedGroups}
        disabled={disabled || pending || !!result.error}
      />
      <UserSearchPagination
        page={page}
        lastPage={result.data?.lastPage ?? 1}
        pending={pending}
        onPage={setPage}
      />
      <p className="access-hint">
        Selections stay selected across searches and pages. Select-all applies only to this page.
      </p>
    </section>
  );
};
export default UserPicker;
