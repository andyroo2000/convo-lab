import { BarChart3, Inbox, Settings, Ticket, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { AdminTab, AdminToastType } from '../../hooks/useAdminPageController';
import Toast from '../common/Toast';
import AdminBetaRequestsTab from './AdminBetaRequestsTab';
import AdminAnalyticsTab from './AdminAnalyticsTab';
import AdminInviteCodesTab from './AdminInviteCodesTab';
import AdminSettingsTab from './AdminSettingsTab';
import AdminUsersTab from './AdminUsersTab';
import './admin.css';
import './adminJournal.css';

const ADMIN_TABS = [
  { id: 'users', label: 'Users', Icon: Users },
  { id: 'beta-requests', label: 'Beta requests', Icon: Inbox },
  { id: 'invite-codes', label: 'Invite Codes', Icon: Ticket },
  { id: 'analytics', label: 'Analytics', Icon: BarChart3 },
  { id: 'settings', label: 'Settings', Icon: Settings },
] as const;
interface Props {
  activeTab: AdminTab;
  currentAdminUserId: string;
  setToastVisible: (visible: boolean) => void;
  showToast: (message: string, type?: AdminToastType) => void;
  toastMessage: string;
  toastType: AdminToastType;
  toastVisible: boolean;
}
const ignoreUserFeed = () => {};
const AdminPageContent = ({
  activeTab,
  currentAdminUserId,
  setToastVisible,
  showToast,
  toastMessage,
  toastType,
  toastVisible,
}: Props) => (
  <div className="journal-admin retro-admin-v3-wrap max-w-[80rem] mx-auto">
    <header className="admin-heading">
      <h1>Admin</h1>
      <p>Users, invitations, and Journal activity</p>
    </header>
    <nav className="retro-admin-v3-tabs" aria-label="Admin sections">
      {ADMIN_TABS.map(({ id, label, Icon }) => (
        <Link
          key={id}
          to={`/app/admin/${id}`}
          aria-current={activeTab === id ? 'page' : undefined}
          className={`retro-admin-v3-tab ${activeTab === id ? 'is-active' : ''}`}
        >
          <Icon size={18} />
          {label}
        </Link>
      ))}
    </nav>
    <div className="admin-sheet">
      <AdminUsersTab
        isActive={activeTab === 'users'}
        currentAdminUserId={currentAdminUserId}
        onUserFeedChange={ignoreUserFeed}
        showToast={showToast}
      />
      {activeTab === 'beta-requests' && <AdminBetaRequestsTab />}
      {activeTab === 'invite-codes' && <AdminInviteCodesTab showToast={showToast} />}
      {activeTab === 'analytics' && <AdminAnalyticsTab />}
      {activeTab === 'settings' && <AdminSettingsTab showToast={showToast} />}
    </div>
    <Toast
      message={toastMessage}
      type={toastType}
      isVisible={toastVisible}
      onClose={() => setToastVisible(false)}
    />
  </div>
);
export default AdminPageContent;
