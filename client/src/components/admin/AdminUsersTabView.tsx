import { Eye, Search, Trash2 } from 'lucide-react';
import { type AdminUser } from '../../lib/adminApi';

const getRoleBadgeClass = (role: string): string => {
  const classes: Record<string, string> = {
    admin: 'retro-admin-v3-badge retro-admin-v3-badge-admin',
    moderator: 'retro-admin-v3-badge retro-admin-v3-badge-moderator',
    demo: 'retro-admin-v3-badge retro-admin-v3-badge-demo',
  };
  return classes[role] || 'retro-admin-v3-badge retro-admin-v3-badge-user';
};

const getUserName = (user: AdminUser): string => user.displayName || user.name;
const formatDate = (value: string): string =>
  new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

interface UserRowProps {
  currentAdminUserId: string;
  onDelete: (user: AdminUser) => void;
  onSelect: (id: string) => void;
  onView: (id: string) => void;
  user: AdminUser;
}

const UserRow = ({ currentAdminUserId, onDelete, onSelect, onView, user }: UserRowProps) => (
  <tr className="hover:bg-gray-50 cursor-pointer" onClick={() => onSelect(user.id)}>
    <td className="px-3 sm:px-6 py-4">
      <div className="font-medium text-navy whitespace-nowrap">{getUserName(user)}</div>
      <div className="text-sm text-gray-500 whitespace-nowrap">{user.email}</div>
    </td>
    <td className="px-3 sm:px-6 py-4">
      <span
        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full whitespace-nowrap ${getRoleBadgeClass(user.role)}`}
      >
        {user.role}
      </span>
    </td>
    <td className="px-3 sm:px-6 py-4 text-sm text-gray-500 whitespace-nowrap">
      {user._count.episodes + user._count.courses} items
    </td>
    <td className="px-3 sm:px-6 py-4 text-sm text-gray-500 whitespace-nowrap">
      {formatDate(user.createdAt)}
    </td>
    <td className="px-3 sm:px-6 py-4 text-right" onClick={(event) => event.stopPropagation()}>
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => onView(user.id)}
          className="text-indigo-600 hover:text-indigo-800 transition-colors"
          title={`View as ${getUserName(user)}`}
        >
          <Eye className="w-4 h-4" />
        </button>
        {user.role !== 'admin' && user.id !== currentAdminUserId && (
          <button
            type="button"
            onClick={() => onDelete(user)}
            className="text-red-600 hover:text-red-800 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </td>
  </tr>
);

interface UsersTableProps extends Omit<UserRowProps, 'user'> {
  isLoading: boolean;
  users: AdminUser[];
}

const UsersTable = ({ isLoading, users, ...rowProps }: UsersTableProps) => {
  if (isLoading) return <div className="text-center py-12 text-gray-500">Loading users...</div>;
  return (
    <div className="bg-white rounded-lg shadow overflow-x-auto retro-admin-v3-table-wrap">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {['User', 'Role', 'Content', 'Joined', 'Actions'].map((label) => (
              <th
                key={label}
                className={`px-3 sm:px-6 py-3 text-xs font-medium text-gray-500 uppercase whitespace-nowrap ${label === 'Actions' ? 'text-right' : 'text-left'}`}
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {users.map((user) => (
            <UserRow key={user.id} user={user} {...rowProps} />
          ))}
        </tbody>
      </table>
      {users.length === 0 && <div className="text-center py-12 text-gray-500">No users found</div>}
    </div>
  );
};

interface UserDetailsProps {
  onClose: () => void;
  onView: (id: string) => void;
  user?: AdminUser;
}

const UserDetails = ({ onClose, onView, user }: UserDetailsProps) => {
  if (!user) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-navy">User Details</h2>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-semibold text-navy mb-2">User Information</h3>
            <div className="space-y-1 text-sm">
              <p>
                <span className="font-medium">Name:</span> {getUserName(user)}
              </p>
              <p>
                <span className="font-medium">Email:</span> {user.email}
              </p>
              <p>
                <span className="font-medium">Role:</span> {user.role}
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => onView(user.id)}
              className="btn-secondary flex items-center gap-2"
            >
              <Eye className="w-4 h-4" />
              Impersonate User
            </button>
            <button type="button" onClick={onClose} className="btn-secondary">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export interface AdminUsersTabViewProps {
  currentAdminUserId: string;
  error: string;
  isActive: boolean;
  isLoading: boolean;
  onDelete: (user: AdminUser) => void;
  onSearch: () => void;
  onSearchQueryChange: (value: string) => void;
  onSelect: (id: string) => void;
  onView: (id: string) => void;
  searchQuery: string;
  selectedUser?: AdminUser;
  users: AdminUser[];
}

const AdminUsersTabView = ({
  currentAdminUserId,
  error,
  isActive,
  isLoading,
  onDelete,
  onSearch,
  onSearchQueryChange,
  onSelect,
  onView,
  searchQuery,
  selectedUser,
  users,
}: AdminUsersTabViewProps) => {
  if (!isActive)
    return <UserDetails user={selectedUser} onClose={() => onSelect('')} onView={onView} />;
  return (
    <>
      {error && <div className="retro-admin-v3-alert is-error mb-6">{error}</div>}
      <div className="retro-admin-v3-pane">
        <div className="retro-admin-v3-search-row mb-6">
          <div className="relative flex-1 min-w-[20rem]">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search users by name or email..."
              value={searchQuery}
              onChange={(event) => onSearchQueryChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') onSearch();
              }}
              className="retro-admin-v3-input pl-10"
            />
          </div>
          <button type="button" onClick={onSearch} className="retro-admin-v3-btn-primary shrink-0">
            Search
          </button>
        </div>
        <UsersTable
          users={users}
          isLoading={isLoading}
          currentAdminUserId={currentAdminUserId}
          onDelete={onDelete}
          onSelect={onSelect}
          onView={onView}
        />
      </div>
      <UserDetails user={selectedUser} onClose={() => onSelect('')} onView={onView} />
    </>
  );
};

export default AdminUsersTabView;
