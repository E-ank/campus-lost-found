'use client';

import { CheckCircle2, Clock, PlayCircle, XCircle } from 'lucide-react';
import type { ComplaintStatus } from '@/types';

// Badge status pengaduan, dipakai di riwayat pelapor dan antrean petugas.
export default function ComplaintStatusBadge({ status }: { status: ComplaintStatus }) {
  switch (status) {
    case 'Menunggu':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
          <Clock className="w-3 h-3" /> Menunggu
        </span>
      );
    case 'Diproses':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-100 text-blue-800 border border-blue-200">
          <PlayCircle className="w-3 h-3" /> Diproses
        </span>
      );
    case 'Selesai':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
          <CheckCircle2 className="w-3 h-3" /> Selesai
        </span>
      );
    case 'Ditolak':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-800 border border-rose-200">
          <XCircle className="w-3 h-3" /> Ditolak
        </span>
      );
  }
}
