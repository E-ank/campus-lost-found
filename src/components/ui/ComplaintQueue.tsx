'use client';

import { useState } from 'react';
import { AlertCircle, ClipboardList, ImageOff, RefreshCw } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import ComplaintStatusBadge from '@/components/ui/ComplaintStatusBadge';
import { COMPLAINT_STATUSES } from '@/lib/complaints';
import type { ComplaintStatus } from '@/types';

// Antrean pengaduan untuk Admin dan Satpam. Keduanya memakai komponen yang
// sama agar aturan status dan tampilan data tidak berbeda antar dashboard.
export default function ComplaintQueue() {
  const { complaints, complaintsError, refreshData, setComplaintStatus } = useApp();
  const [savingIds, setSavingIds] = useState<Record<string, boolean>>({});

  const handleStatusChange = async (complaintId: string, status: ComplaintStatus) => {
    setSavingIds((prev) => ({ ...prev, [complaintId]: true }));
    await setComplaintStatus(complaintId, status);
    setSavingIds((prev) => ({ ...prev, [complaintId]: false }));
  };

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
        <div className="flex items-center gap-1.5 text-xs font-black text-slate-900">
          <ClipboardList className="w-4 h-4 text-blue-700" />
          <span>Antrean Pengaduan</span>
        </div>
      </div>

      {complaintsError ? (
        <div className="bg-white rounded-2xl p-6 border border-rose-200 shadow-sm text-center space-y-3">
          <AlertCircle className="w-9 h-9 text-rose-500 mx-auto" />
          <div>
            <p className="text-sm font-bold text-slate-900">Pengaduan belum bisa dimuat</p>
          </div>
          <button
            type="button"
            onClick={() => void refreshData()}
            className="min-h-11 w-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          >
            <RefreshCw className="w-4 h-4" /> Coba Lagi
          </button>
        </div>
      ) : complaints.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 border border-slate-100 shadow-sm text-center">
          <ClipboardList className="w-10 h-10 text-slate-200 mx-auto mb-2" />
          <p className="text-sm font-bold text-slate-800">Belum ada pengaduan</p>
        </div>
      ) : (
        complaints.map((complaint) => (
          <article
            key={complaint.id}
            className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                  {complaint.category}
                </span>
                <p className="text-[10px] text-slate-600 mt-1">
                  {complaint.createdAt} • Kejadian {complaint.incidentDateLabel}
                </p>
              </div>
              <ComplaintStatusBadge status={complaint.status} />
            </div>

            <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100">
              <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                Pelapor
              </p>
              <p className="text-xs font-bold text-slate-900">
                {complaint.reporterName}
              </p>
              <p className="text-[11px] text-slate-600 font-mono">
                {complaint.reporterIdentifier}
              </p>
            </div>

            <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line">
              {complaint.description}
            </p>

            {complaint.photoUrl ? (
              <a
                href={complaint.photoUrl}
                target="_blank"
                rel="noreferrer"
                className="block rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={complaint.photoUrl}
                  alt={`Foto bukti pengaduan ${complaint.category}`}
                  className="w-full max-w-[280px] aspect-video object-cover rounded-xl border border-slate-200 hover:opacity-90"
                />
                <span className="inline-block text-[10px] font-bold text-blue-700 mt-1">
                  Buka foto ukuran penuh
                </span>
              </a>
            ) : complaint.photoPath ? (
              <p className="flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-2.5">
                <ImageOff className="w-3.5 h-3.5" /> Foto bukti tidak dapat dimuat saat ini.
              </p>
            ) : (
              <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-2.5">
                Pelapor tidak melampirkan foto bukti.
              </p>
            )}

            <div>
              <label
                htmlFor={`status-${complaint.id}`}
                className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1"
              >
                Status Penanganan
              </label>
              <select
                id={`status-${complaint.id}`}
                value={complaint.status}
                disabled={Boolean(savingIds[complaint.id])}
                onChange={(e) =>
                  void handleStatusChange(complaint.id, e.target.value as ComplaintStatus)
                }
                className="w-full min-h-11 px-3 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:opacity-60"
              >
                {COMPLAINT_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
              {savingIds[complaint.id] && (
                <p className="text-xs text-slate-600 mt-1">Menyimpan status...</p>
              )}
            </div>
          </article>
        ))
      )}
    </div>
  );
}
