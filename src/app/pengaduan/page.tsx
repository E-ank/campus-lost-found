import RequireAuth from '@/components/shell/RequireAuth';
import PengaduanView from '@/components/views/PengaduanView';

export default function PengaduanPage() {
  return (
    <RequireAuth requireVerified>
      <PengaduanView />
    </RequireAuth>
  );
}
