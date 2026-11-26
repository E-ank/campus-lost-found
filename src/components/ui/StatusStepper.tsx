'use client';

import { Check, Clock } from 'lucide-react';
import type { ClaimStatus, ItemStatus, ItemType, StorageType } from '@/types';

interface StatusStepperProps {
  itemType: ItemType;
  storageType?: StorageType;
  itemStatus: ItemStatus;
  claimStatus?: ClaimStatus;
  securityPost?: string;
  className?: string;
}

interface Step {
  id: string;
  label: string;
  description: string;
  status: 'completed' | 'current' | 'upcoming';
}

export default function StatusStepper({
  itemType,
  storageType = 'NONE',
  itemStatus,
  claimStatus,
  securityPost,
  className = '',
}: StatusStepperProps) {
  const isFinished = itemStatus === 'Selesai' || claimStatus === 'SELESAI';

  let steps: Step[] = [];

  if (itemType === 'FOUND' && storageType === 'SATPAM') {
    const isAtSatpam =
      itemStatus === 'Di Pos Satpam' ||
      claimStatus === 'APPROVED' ||
      claimStatus === 'SELESAI' ||
      isFinished;
    const isApproved = claimStatus === 'APPROVED' || claimStatus === 'SELESAI' || isFinished;

    steps = [
      {
        id: '1',
        label: 'Laporan Dibuat',
        description: 'Barang temuan dilaporkan',
        status: 'completed',
      },
      {
        id: '2',
        label: 'Di Pos Satpam',
        description: securityPost && securityPost !== '-' ? securityPost : 'Diserahkan ke Pos',
        status: isAtSatpam ? (isApproved ? 'completed' : 'current') : 'current',
      },
      {
        id: '3',
        label: 'Klaim Diverifikasi',
        description: isApproved ? 'Tiket Pengambilan Terbit' : 'Menunggu Approval',
        status: isApproved ? (isFinished ? 'completed' : 'current') : 'upcoming',
      },
      {
        id: '4',
        label: 'Serah Terima',
        description: isFinished ? 'Resmi Diserahkan' : 'Pengambilan di Pos',
        status: isFinished ? 'completed' : 'upcoming',
      },
    ];
  } else if (itemType === 'FOUND' && storageType === 'FINDER') {
    const isApproved = claimStatus === 'APPROVED' || claimStatus === 'SELESAI' || isFinished;

    steps = [
      {
        id: '1',
        label: 'Laporan Dibuat',
        description: 'Disimpan oleh Penemu',
        status: 'completed',
      },
      {
        id: '2',
        label: 'Klaim Diverifikasi',
        description: isApproved ? 'Disetujui Penemu' : 'Menunggu Approval',
        status: isApproved ? (isFinished ? 'completed' : 'current') : 'current',
      },
      {
        id: '3',
        label: 'Serah Terima',
        description: isFinished ? 'Resmi Diserahkan' : 'Penyerahan Langsung',
        status: isFinished ? 'completed' : 'upcoming',
      },
    ];
  } else {
    steps = [
      {
        id: '1',
        label: 'Laporan Kehilangan',
        description: isFinished ? 'Pencarian Selesai' : 'Mencari Penemu',
        status: isFinished ? 'completed' : 'current',
      },
      {
        id: '2',
        label: 'Ditemukan / Selesai',
        description: isFinished ? 'Barang Telah Kembali' : 'Menunggu Kabar',
        status: isFinished ? 'completed' : 'upcoming',
      },
    ];
  }

  return (
    <div className={`bg-white rounded-2xl p-4 border border-slate-200 shadow-sm ${className}`}>
      <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
        <span className="text-[10px] font-black uppercase tracking-wider text-slate-600">
          Progres Laporan
        </span>
        <span
          className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
            isFinished
              ? 'bg-blue-50 text-blue-800'
              : 'bg-emerald-50 text-emerald-800'
          }`}
        >
          {isFinished ? 'Laporan Selesai' : 'Sedang Berjalan'}
        </span>
      </div>

      {/* Desktop & Tablet */}
      <div className="hidden sm:flex items-start justify-between relative">
        <div
          className="absolute top-3.5 left-5 right-5 h-0.5 bg-slate-200 -z-0"
          aria-hidden="true"
        />

        {steps.map((step, index) => {
          const isCompleted = step.status === 'completed';
          const isCurrent = step.status === 'current';

          return (
            <div
              key={step.id}
              className="relative z-10 flex flex-col items-center text-center flex-1 px-1"
            >
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black transition-colors ${
                  isCompleted
                    ? 'bg-emerald-600 text-white shadow-sm ring-4 ring-white'
                    : isCurrent
                      ? 'bg-blue-600 text-white shadow-md ring-4 ring-blue-100'
                      : 'bg-white text-slate-600 border-2 border-slate-300'
                }`}
              >
                {isCompleted ? (
                  <Check className="w-3.5 h-3.5" />
                ) : isCurrent ? (
                  <Clock className="w-3.5 h-3.5" />
                ) : (
                  <span>{index + 1}</span>
                )}
              </div>

              <div className="mt-2">
                <p
                  className={`text-[11px] leading-tight ${
                    isCompleted || isCurrent
                      ? 'font-black text-slate-900'
                      : 'font-semibold text-slate-600'
                  }`}
                >
                  {step.label}
                </p>
                <p className="text-[10px] text-slate-600 mt-0.5 max-w-[100px] mx-auto leading-tight truncate">
                  {step.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Mobile */}
      <div className="sm:hidden space-y-2.5">
        {steps.map((step, index) => {
          const isCompleted = step.status === 'completed';
          const isCurrent = step.status === 'current';

          return (
            <div key={step.id} className="flex items-center gap-3">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 transition-colors ${
                  isCompleted
                    ? 'bg-emerald-600 text-white'
                    : isCurrent
                      ? 'bg-blue-600 text-white ring-2 ring-blue-100'
                      : 'bg-slate-100 text-slate-700 border border-slate-300'
                }`}
              >
                {isCompleted ? (
                  <Check className="w-3 h-3" />
                ) : isCurrent ? (
                  <Clock className="w-3 h-3" />
                ) : (
                  <span>{index + 1}</span>
                )}
              </div>

              <div className="flex-1 min-w-0 flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5">
                <p
                  className={`text-xs truncate ${
                    isCompleted || isCurrent
                      ? 'font-black text-slate-900'
                      : 'font-semibold text-slate-600'
                  }`}
                >
                  {step.label}
                </p>
                <span className="text-[10px] text-slate-600">
                  {step.description}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
