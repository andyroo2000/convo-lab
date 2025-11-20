import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Users, Ticket, BarChart3, Search, Trash2, Copy, Plus, Check } from 'lucide-react';
import { API_URL } from '../config';

type Tab = 'users' | 'invites' | 'analytics';

interface UserData {
  id: string;
  email: string;
  name: string;
  displayName?: string;
  role: string;
  createdAt: string;
  _count: {
    episodes: number;
    courses: number;
    narrowListeningPacks: number;
    chunkPacks: number;
  };
}

interface InviteCode {
  id: string;
  code: string;
  usedBy: string | null;
  usedAt: string | null;
  createdAt: string;
  user?: {
    id: string;
    email: string;
    name: string;
  };
}

interface Stats {
  users: number;
  episodes: number;
  courses: number;
  narrowListeningPacks: number;
  chunkPacks: number;
  inviteCodes: {
    total: number;
    used: number;
    available: number;
  };
}

export default function AdminPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('users');
  const [users, setUsers] = useState<UserData[]>([]);
  const [inviteCodes, setInviteCodes] = useState<InviteCode[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Redirect if not admin
  useEffect(() => {
    if (user && user.role !== 'admin') {
      navigate('/app/library');
    }
  }, [user, navigate]);

  // Fetch data based on active tab
  useEffect(() => {
    if (activeTab === 'users') {
      fetchUsers();
    } else if (activeTab === 'invites') {
      fetchInviteCodes();
    } else if (activeTab === 'analytics') {
      fetchStats();
    }
  }, [activeTab]);

  const fetchUsers = async () => {
    setIsLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_URL}/api/admin/users?search=${searchQuery}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch users');
      const data = await response.json();
      setUsers(data.users);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch users');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchInviteCodes = async () => {
    setIsLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_URL}/api/admin/invite-codes`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch invite codes');
      const data = await response.json();
      setInviteCodes(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch invite codes');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStats = async () => {
    setIsLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_URL}/api/admin/stats`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch stats');
      const data = await response.json();
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch stats');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteUser = async (userId: string, userEmail: string) => {
    if (!confirm(`Are you sure you want to delete user ${userEmail}? This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/admin/users/${userId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to delete user');
      }
      fetchUsers();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete user');
    }
  };

  const handleCreateInviteCode = async () => {
    try {
      const response = await fetch(`${API_URL}/api/admin/invite-codes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({}),
      });
      if (!response.ok) throw new Error('Failed to create invite code');
      fetchInviteCodes();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create invite code');
    }
  };

  const handleDeleteInviteCode = async (codeId: string, code: string) => {
    if (!confirm(`Are you sure you want to delete invite code ${code}?`)) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/admin/invite-codes/${codeId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to delete invite code');
      }
      fetchInviteCodes();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete invite code');
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (!user || user.role !== 'admin') {
    return null;
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-navy mb-2">Admin Dashboard</h1>
        <p className="text-gray-600">Manage users, invite codes, and view analytics</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-4">
          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
              activeTab === 'users'
                ? 'border-indigo text-indigo font-semibold'
                : 'border-transparent text-gray-600 hover:text-navy'
            }`}
          >
            <Users className="w-4 h-4" />
            Users
          </button>
          <button
            onClick={() => setActiveTab('invites')}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
              activeTab === 'invites'
                ? 'border-indigo text-indigo font-semibold'
                : 'border-transparent text-gray-600 hover:text-navy'
            }`}
          >
            <Ticket className="w-4 h-4" />
            Invite Codes
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
              activeTab === 'analytics'
                ? 'border-indigo text-indigo font-semibold'
                : 'border-transparent text-gray-600 hover:text-navy'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Analytics
          </button>
        </nav>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div>
          <div className="flex items-center gap-4 mb-6">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search users by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchUsers()}
                className="input pl-10"
              />
            </div>
            <button onClick={fetchUsers} className="btn-primary">
              Search
            </button>
          </div>

          {isLoading ? (
            <div className="text-center py-12 text-gray-500">Loading users...</div>
          ) : (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Role
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Content
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Joined
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div>
                          <div className="font-medium text-navy">
                            {u.displayName || u.name}
                          </div>
                          <div className="text-sm text-gray-500">{u.email}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            u.role === 'admin'
                              ? 'bg-purple-100 text-purple-800'
                              : u.role === 'moderator'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {u._count.episodes + u._count.courses + u._count.narrowListeningPacks + u._count.chunkPacks} items
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {formatDate(u.createdAt)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {u.role !== 'admin' && u.id !== user.id && (
                          <button
                            onClick={() => handleDeleteUser(u.id, u.email)}
                            className="text-red-600 hover:text-red-800 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {users.length === 0 && (
                <div className="text-center py-12 text-gray-500">No users found</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Invite Codes Tab */}
      {activeTab === 'invites' && (
        <div>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold text-navy">Invite Codes</h2>
              <p className="text-sm text-gray-600 mt-1">
                Create and manage invite codes for new users
              </p>
            </div>
            <button onClick={handleCreateInviteCode} className="btn-primary flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Create Code
            </button>
          </div>

          {isLoading ? (
            <div className="text-center py-12 text-gray-500">Loading invite codes...</div>
          ) : (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Code
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Used By
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Created
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {inviteCodes.map((code) => (
                    <tr key={code.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <code className="font-mono font-semibold text-navy">
                            {code.code}
                          </code>
                          <button
                            onClick={() => handleCopyCode(code.code)}
                            className="text-gray-400 hover:text-indigo transition-colors"
                            title="Copy code"
                          >
                            {copiedCode === code.code ? (
                              <Check className="w-4 h-4 text-green-600" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            code.usedBy
                              ? 'bg-gray-100 text-gray-800'
                              : 'bg-green-100 text-green-800'
                          }`}
                        >
                          {code.usedBy ? 'Used' : 'Available'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {code.user ? (
                          <div>
                            <div className="font-medium">{code.user.name}</div>
                            <div className="text-xs text-gray-400">{code.user.email}</div>
                          </div>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {formatDate(code.createdAt)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {!code.usedBy && (
                          <button
                            onClick={() => handleDeleteInviteCode(code.id, code.code)}
                            className="text-red-600 hover:text-red-800 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {inviteCodes.length === 0 && (
                <div className="text-center py-12 text-gray-500">No invite codes found</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && (
        <div>
          <h2 className="text-xl font-semibold text-navy mb-6">Platform Analytics</h2>

          {isLoading ? (
            <div className="text-center py-12 text-gray-500">Loading stats...</div>
          ) : stats ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Users */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-600">Total Users</h3>
                  <Users className="w-5 h-5 text-indigo" />
                </div>
                <p className="text-3xl font-bold text-navy">{stats.users}</p>
              </div>

              {/* Episodes */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-600">Episodes</h3>
                  <BarChart3 className="w-5 h-5 text-indigo" />
                </div>
                <p className="text-3xl font-bold text-navy">{stats.episodes}</p>
              </div>

              {/* Courses */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-600">Courses</h3>
                  <BarChart3 className="w-5 h-5 text-indigo" />
                </div>
                <p className="text-3xl font-bold text-navy">{stats.courses}</p>
              </div>

              {/* Narrow Listening Packs */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-600">Listening Packs</h3>
                  <BarChart3 className="w-5 h-5 text-indigo" />
                </div>
                <p className="text-3xl font-bold text-navy">{stats.narrowListeningPacks}</p>
              </div>

              {/* Chunk Packs */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-600">Chunk Packs</h3>
                  <BarChart3 className="w-5 h-5 text-indigo" />
                </div>
                <p className="text-3xl font-bold text-navy">{stats.chunkPacks}</p>
              </div>

              {/* Invite Codes */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-600">Invite Codes</h3>
                  <Ticket className="w-5 h-5 text-indigo" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-gray-600">
                    Total: <span className="font-semibold text-navy">{stats.inviteCodes.total}</span>
                  </p>
                  <p className="text-sm text-gray-600">
                    Used: <span className="font-semibold text-navy">{stats.inviteCodes.used}</span>
                  </p>
                  <p className="text-sm text-green-600">
                    Available: <span className="font-semibold">{stats.inviteCodes.available}</span>
                  </p>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
