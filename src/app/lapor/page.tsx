import RequireAuth from '@/components/shell/RequireAuth';
import UploadView from '@/components/views/UploadView';

export default function LaporPage() {
  return (
    <RequireAuth requireVerified>
      <UploadView />
    </RequireAuth>
  );
}
