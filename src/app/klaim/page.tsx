import RequireAuth from '@/components/shell/RequireAuth';
import MyClaimsView from '@/components/views/MyClaimsView';

export default function KlaimPage() {
  return (
    <RequireAuth>
      <MyClaimsView />
    </RequireAuth>
  );
}
