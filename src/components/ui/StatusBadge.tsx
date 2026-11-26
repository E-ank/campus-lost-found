'use client';

import { CheckCircle2, Clock, Search, ShieldCheck, User } from 'lucide-react';
import type { ItemStatus } from '@/types';

// Badge status barang yang dipakai di beranda, detail, dan dashboard satpam.
export default function StatusBadge({ status }: { status: ItemStatus }) {
  switch (status) {
    case 'Dicari':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-700 border border-rose-200">
          <Search className="w-3 h-3" /> Dicari
        </span>
      );
    case 'Di Pos Satpam':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-100 text-blue-700 border border-blue-200">
          <ShieldCheck className="w-3 h-3" /> Di Pos Satpam
        </span>
      );
    case 'Menunggu Diserahkan ke Pos':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
          <Clock className="w-3 h-3" /> Menunggu ke Pos
        </span>
      );
    case 'Di Penemu':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-100 text-indigo-700 border border-indigo-200">
          <User className="w-3 h-3" /> Di Penemu
        </span>
      );
    case 'Selesai':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="w-3 h-3" /> Selesai
        </span>
      );
    default:
      return null;
  }
}
