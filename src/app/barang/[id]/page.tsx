import { Suspense } from 'react';
import DetailView from '@/components/views/DetailView';

export default function BarangDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 text-center">
            <p className="text-sm font-semibold text-slate-600">Memuat detail barang...</p>
          </div>
        </div>
      }
    >
      <DetailView />
    </Suspense>
  );
}
