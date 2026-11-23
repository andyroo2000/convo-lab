import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export type AdminTab = 'users' | 'beta-requests' | 'invite-codes' | 'analytics' | 'settings';
export type AdminToastType = 'success' | 'error' | 'info';
const tabs: readonly string[] = ['users', 'beta-requests', 'invite-codes', 'analytics', 'settings'];

const useAdminPageController = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { tab } = useParams<{ tab?: string }>();
  const activeTab: AdminTab = tabs.includes(tab ?? '') ? (tab as AdminTab) : 'users';
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<AdminToastType>('success');
  const showToast = (message: string, type: AdminToastType = 'success') => {
    setToastMessage(message);
    setToastType(type);
    setToastVisible(true);
  };
  useEffect(() => {
    if (user && user.role !== 'admin') navigate('/app/journal', { replace: true });
    else if (tab && !tabs.includes(tab)) navigate('/app/admin/users', { replace: true });
  }, [user, tab, navigate]);
  return { activeTab, user, setToastVisible, showToast, toastMessage, toastType, toastVisible };
};
export default useAdminPageController;
