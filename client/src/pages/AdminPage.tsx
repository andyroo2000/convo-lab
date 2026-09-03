import AdminPageContent from '../components/admin/AdminPageContent';
import useAdminPageController from '../hooks/useAdminPageController';

const AdminPage = () => {
  const controller = useAdminPageController();

  if (!controller.user || controller.user.role !== 'admin') return null;

  return <AdminPageContent {...controller} currentAdminUserId={controller.user.id} />;
};

export default AdminPage;
