'use client';

import { AlertTriangle, CheckCircle2, X } from 'lucide-react';
import { useApp } from '@/context/AppContext';

// Notifikasi ringkas yang muncul di bagian atas frame aplikasi.
export default function ToastHost() {
  const { toast, dismissToast } = useApp();

  if (!toast) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-20 left-1/2 -translate-x-1/2 w-[90%] max-w-sm z-50 animate-fadeIn"
    >
      <div
        className={`p-3.5 rounded-xl shadow-xl border flex items-start gap-3 ${
          toast.type === 'error'
            ? 'bg-rose-950 text-white border-rose-700'
            : toast.type === 'info'
              ? 'bg-slate-900 text-white border-slate-700'
              : 'bg-blue-950 text-white border-blue-700'
        }`}
      >
        {toast.type === 'error' ? (
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
        ) : (
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
        )}
        <div className="flex-1 text-xs">
          <p className="font-bold">{toast.title}</p>
          <p className="text-slate-200 mt-0.5 leading-relaxed">{toast.message}</p>
        </div>
        <button
          type="button"
          onClick={dismissToast}
          aria-label="Tutup pemberitahuan"
          className="min-h-11 min-w-11 -my-2 -mr-2 inline-flex items-center justify-center rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition focus-visible:outline-2 focus-visible:outline-white"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
