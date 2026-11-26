import RequireAuth from '@/components/shell/RequireAuth';
import AdminDashboardView from '@/components/views/AdminDashboardView';

export default function AdminPage() {
  return (
    <RequireAuth allow={['SUPERADMIN']}>
      <AdminDashboardView />
    </RequireAuth>
  );
}
