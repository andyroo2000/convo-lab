import { useEffect, useRef, useState } from 'react';
import { Check, Copy, Plus, Trash2 } from 'lucide-react';
import {
  adminApi,
  getAdminInviteCodes,
  type AdminInviteCode,
  type AdminReadRequestInit,
} from '../../lib/adminApi';
import ConfirmModal from '../common/ConfirmModal';

interface AdminInviteCodesTabProps {
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const isAbortError = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError';

const formatDate = (dateString: string) =>
  new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

const AdminInviteCodesTab = ({ showToast }: AdminInviteCodesTabProps) => {
  const [inviteCodes, setInviteCodes] = useState<AdminInviteCode[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [confirmCode, setConfirmCode] = useState<{ id: string; code: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const readControllerRef = useRef<AbortController | null>(null);

  const fetchInviteCodes = async (init?: AdminReadRequestInit): Promise<void> => {
    setIsLoading(true);
    setError('');
    try {
      setInviteCodes(await getAdminInviteCodes(init));
    } catch (err) {
      if (isAbortError(err)) return;
      setError(err instanceof Error ? err.message : 'Failed to fetch invite codes');
    } finally {
      if (!init?.signal?.aborted) setIsLoading(false);
    }
  };

  const refreshInviteCodes = (): Promise<void> => {
    readControllerRef.current?.abort();
    const controller = new AbortController();
    readControllerRef.current = controller;

    return fetchInviteCodes({ signal: controller.signal }).finally(() => {
      if (readControllerRef.current === controller) {
        readControllerRef.current = null;
      }
    });
  };

  const handleCreateInviteCode = async () => {
    try {
      const response = await fetch(adminApi.inviteCodes, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({}),
      });
      if (!response.ok) throw new Error('Failed to create invite code');
      refreshInviteCodes();
      showToast('Invite code created successfully', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to create invite code', 'error');
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleDeleteInviteCode = async () => {
    if (!confirmCode) return;

    setIsDeleting(true);
    try {
      const response = await fetch(adminApi.inviteCode(confirmCode.id), {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to delete invite code');
      }
      refreshInviteCodes();
      showToast('Invite code deleted successfully', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete invite code', 'error');
    } finally {
      setIsDeleting(false);
      setConfirmCode(null);
    }
  };

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    refreshInviteCodes();

    return () => {
      readControllerRef.current?.abort();
      readControllerRef.current = null;
    };
  }, []);
  /* eslint-enable react-hooks/exhaustive-deps */

  return (
    <>
      {error && <div className="retro-admin-v3-alert is-error mb-6">{error}</div>}

      <div className="retro-admin-v3-pane">
        <div className="retro-admin-v3-pane-header mb-6">
          <div>
            <h2 className="text-xl font-semibold text-navy">Invite Codes</h2>
            <p className="text-sm text-gray-600 mt-1">
              Create and manage invite codes for new users
            </p>
          </div>
          <button
            type="button"
            onClick={handleCreateInviteCode}
            className="retro-admin-v3-btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Create Code
          </button>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-gray-500">Loading invite codes...</div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-x-auto retro-admin-v3-table-wrap">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                    Code
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                    Status
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                    Used By
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                    Created
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {inviteCodes.map((inviteCode) => (
                  <tr key={inviteCode.id} className="hover:bg-gray-50">
                    <td className="px-3 sm:px-6 py-4">
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        <code className="font-mono font-semibold text-navy">{inviteCode.code}</code>
                        <button
                          type="button"
                          onClick={() => handleCopyCode(inviteCode.code)}
                          className="text-gray-400 hover:text-indigo transition-colors"
                          title="Copy code"
                        >
                          {copiedCode === inviteCode.code ? (
                            <Check className="w-4 h-4 text-green-600" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </td>
                    <td className="px-3 sm:px-6 py-4">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full whitespace-nowrap ${
                          inviteCode.usedBy
                            ? 'bg-gray-100 text-gray-800'
                            : 'bg-green-100 text-green-800'
                        }`}
                      >
                        {inviteCode.usedBy ? 'Used' : 'Available'}
                      </span>
                    </td>
                    <td className="px-3 sm:px-6 py-4 text-sm text-gray-500">
                      {inviteCode.user ? (
                        <div className="whitespace-nowrap">
                          <div className="font-medium">{inviteCode.user.name}</div>
                          <div className="text-xs text-gray-400">{inviteCode.user.email}</div>
                        </div>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-3 sm:px-6 py-4 text-sm text-gray-500 whitespace-nowrap">
                      {formatDate(inviteCode.createdAt)}
                    </td>
                    <td className="px-3 sm:px-6 py-4 text-right">
                      {!inviteCode.usedBy && (
                        <button
                          type="button"
                          onClick={() =>
                            setConfirmCode({ id: inviteCode.id, code: inviteCode.code })
                          }
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

      <ConfirmModal
        isOpen={!!confirmCode}
        title="Delete Invite Code"
        message={`Are you sure you want to delete invite code ${confirmCode?.code ?? ''}?`}
        confirmLabel="Delete Code"
        onConfirm={handleDeleteInviteCode}
        onCancel={() => setConfirmCode(null)}
        isLoading={isDeleting}
        variant="danger"
      />
    </>
  );
};

export default AdminInviteCodesTab;
