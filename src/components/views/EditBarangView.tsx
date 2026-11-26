'use client';

import { useParams } from 'next/navigation';
import RequireAuth from '@/components/shell/RequireAuth';
import UploadView from '@/components/views/UploadView';

// Halaman sunting laporan: mengambil id barang dari URL lalu menyerahkannya
// ke form UploadView dalam mode sunting.
export default function EditBarangView() {
  const params = useParams<{ id: string }>();

  return (
    <RequireAuth requireVerified>
      <UploadView editItemId={params.id} />
    </RequireAuth>
  );
}
