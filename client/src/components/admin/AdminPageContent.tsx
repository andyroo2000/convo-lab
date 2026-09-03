import { BarChart3, Image, Settings, TestTube, Ticket, Users } from 'lucide-react';
import { Link } from 'react-router-dom';

import type { AdminTab, AdminToastType } from '../../hooks/useAdminPageController';
import Toast from '../common/Toast';
import AdminAnalyticsTab from './AdminAnalyticsTab';
import AdminAvatarsTab from './AdminAvatarsTab';
import AdminInviteCodesTab from './AdminInviteCodesTab';
import AdminSettingsTab from './AdminSettingsTab';
import AdminUsersTab, { type AdminUsersFeed } from './AdminUsersTab';
import ScriptLabTab from './scriptLab/ScriptLabTab';

const ADMIN_TABS = [
  { id: 'users', label: 'Users', Icon: Users },
  { id: 'invite-codes', label: 'Invite Codes', Icon: Ticket },
  { id: 'analytics', label: 'Analytics', Icon: BarChart3 },
  { id: 'avatars', label: 'Avatars', Icon: Image },
  { id: 'settings', label: 'Settings', Icon: Settings },
  { id: 'script-lab', label: 'Script Lab', Icon: TestTube },
] as const;

interface AdminPageContentProps {
  activeTab: AdminTab;
  avatarUsersError: string;
  currentAdminUserId: string;
  isAvatarUsersLoading: boolean;
  refreshAvatarUsers: () => Promise<void>;
  setToastVisible: (visible: boolean) => void;
  setUserFeed: (feed: AdminUsersFeed) => void;
  showToast: (message: string, type?: AdminToastType) => void;
  toastMessage: string;
  toastType: AdminToastType;
  toastVisible: boolean;
  userFeed: AdminUsersFeed;
}

const AdminTabs = ({ activeTab }: Pick<AdminPageContentProps, 'activeTab'>) => (
  <div className="retro-admin-v3-tabs-wrap">
    <nav className="retro-admin-v3-tabs">
      {ADMIN_TABS.map(({ id, label, Icon }) => (
        <Link
          key={id}
          to={`/app/admin/${id}`}
          className={`retro-admin-v3-tab ${
            activeTab === id ? 'is-active border-indigo font-semibold' : ''
          }`}
        >
          <Icon className="w-4 h-4" />
          {label}
        </Link>
      ))}
    </nav>
  </div>
);

const AdminTabContent = ({
  activeTab,
  currentAdminUserId,
  isAvatarUsersLoading,
  refreshAvatarUsers,
  setUserFeed,
  showToast,
  userFeed,
}: Pick<
  AdminPageContentProps,
  | 'activeTab'
  | 'currentAdminUserId'
  | 'isAvatarUsersLoading'
  | 'refreshAvatarUsers'
  | 'setUserFeed'
  | 'showToast'
  | 'userFeed'
>) => (
  <>
    <AdminUsersTab
      isActive={activeTab === 'users'}
      currentAdminUserId={currentAdminUserId}
      onUserFeedChange={setUserFeed}
      showToast={showToast}
    />
    {activeTab === 'invite-codes' && <AdminInviteCodesTab showToast={showToast} />}
    {activeTab === 'analytics' && <AdminAnalyticsTab />}
    {activeTab === 'avatars' && (
      <AdminAvatarsTab
        users={userFeed.users}
        isUsersLoading={isAvatarUsersLoading}
        refreshUsers={refreshAvatarUsers}
        showToast={showToast}
      />
    )}
    {activeTab === 'settings' && <AdminSettingsTab showToast={showToast} />}
    {activeTab === 'script-lab' && <ScriptLabTab />}
  </>
);

const AdminPageContent = ({
  activeTab,
  avatarUsersError,
  setToastVisible,
  toastMessage,
  toastType,
  toastVisible,
  ...tabContentProps
}: AdminPageContentProps) => (
  <div className="max-w-[80rem] mx-auto retro-admin-v3-wrap">
    <div className="retro-admin-v3-shell">
      <div className="retro-admin-v3-top">
        <h1 className="retro-admin-v3-title">Admin Dashboard</h1>
        <p className="retro-admin-v3-subtitle">Manage users, invite codes, and view analytics</p>
      </div>

      <div className="retro-admin-v3-main">
        <AdminTabs activeTab={activeTab} />
        {avatarUsersError && (
          <div className="retro-admin-v3-alert is-error mb-6">{avatarUsersError}</div>
        )}
        <AdminTabContent activeTab={activeTab} {...tabContentProps} />
      </div>
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
