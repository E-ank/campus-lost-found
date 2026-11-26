'use client';

import { CheckCircle2, Clock, PackageCheck, XCircle } from 'lucide-react';
import type { ClaimStatus } from '@/types';

interface ClaimStatusBadgeProps {
  status: ClaimStatus;
  /** Label khusus untuk laporan barang hilang (LOST) saat penemu melapor. */
  isLostFoundReport?: boolean;
}

export default function ClaimStatusBadge({
  status,
  isLostFoundReport = false,
}: ClaimStatusBadgeProps) {
  switch (status) {
    case 'PENDING':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200 shrink-0">
          <Clock className="w-3 h-3" />
          {isLostFoundReport ? 'Menunggu Konfirmasi' : 'Menunggu Verifikasi'}
        </span>
      );
    case 'APPROVED':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-200 shrink-0">
          <CheckCircle2 className="w-3 h-3" />
          {isLostFoundReport ? 'Dikonfirmasi' : 'Disetujui'}
        </span>
      );
    case 'REJECTED':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-900 border border-rose-200 shrink-0">
          <XCircle className="w-3 h-3" />
          {isLostFoundReport ? 'Bukan Barang Pemilik' : 'Ditolak'}
        </span>
      );
    case 'SELESAI':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-900 border border-blue-200 shrink-0">
          <PackageCheck className="w-3 h-3" />
          Selesai
        </span>
      );
    default:
      return null;
  }
}
