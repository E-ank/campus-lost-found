import { Suspense } from 'react';
import RequireAuth from '@/components/shell/RequireAuth';
import SatpamDashboardView from '@/components/views/SatpamDashboardView';

export default function SatpamPage() {
  return (
    <RequireAuth allow={['SATPAM']}>
      <Suspense fallback={<div className="p-8 text-center text-xs font-bold text-slate-600">Memuat dashboard...</div>}>
        <SatpamDashboardView />
      </Suspense>
    </RequireAuth>
  );
}
