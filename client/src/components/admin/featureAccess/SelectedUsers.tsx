import type { AudienceUser } from './api';

interface Props {
  users: AudienceUser[];
  onChange: (users: AudienceUser[]) => void;
  disabled?: boolean;
}
const SelectedUsers = ({ users, onChange, disabled }: Props) => (
  <section className="access-selection" aria-label="Selected users">
    <h3>{users.length} selected users</h3>
    {users.length === 0 && <p>No individual users selected.</p>}
    <ul>
      {users.map((user) => (
        <li key={user.id}>
          <span>{user.name || user.email}</span>
          <button
            type="button"
            disabled={disabled}
            aria-label={`Remove ${user.name || user.email}`}
            onClick={() => onChange(users.filter((item) => item.id !== user.id))}
          >
            ×
          </button>
        </li>
      ))}
    </ul>
  </section>
);
export default SelectedUsers;
