import { Suspense } from 'react';
import EditBarangView from '@/components/views/EditBarangView';

export default function EditBarangPage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 text-center">
            <p className="text-sm font-semibold text-slate-600">Memuat form sunting...</p>
          </div>
        </div>
      }
    >
      <EditBarangView />
    </Suspense>
  );
}
