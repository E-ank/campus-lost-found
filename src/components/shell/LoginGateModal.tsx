'use client';

import { useEffect } from 'react';
import { LogIn, Lock, X } from 'lucide-react';
import { useApp } from '@/context/AppContext';

// Modal pembatas akses publik: mengarahkan pengunjung ke halaman login.
export default function LoginGateModal() {
  const { loginGate, closeLoginGate, confirmLoginGate } = useApp();

  // Aksesibilitas keyboard: modal tertutup dengan Escape (R-32).
  useEffect(() => {
    if (!loginGate.isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLoginGate();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [loginGate.isOpen, closeLoginGate]);

  if (!loginGate.isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-gate-title"
      className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={closeLoginGate}
    >
      <div
        className="bg-white w-full max-w-sm rounded-2xl p-5 shadow-2xl border border-slate-200 space-y-4 animate-fadeIn relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={closeLoginGate}
          aria-label="Tutup dialog"
          className="absolute right-3 top-3 w-11 h-11 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 flex items-center justify-center transition focus-visible:outline-2 focus-visible:outline-blue-700"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center mx-auto">
          <Lock className="w-6 h-6" />
        </div>

        <div className="text-center space-y-1">
          <h3 id="login-gate-title" className="text-sm font-extrabold text-slate-900">
            Perlu Masuk
          </h3>
          <p className="text-xs text-slate-600">{loginGate.message}</p>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            type="button"
            onClick={closeLoginGate}
            className="min-h-11 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100 transition focus-visible:outline-2 focus-visible:outline-blue-700"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={confirmLoginGate}
            className="min-h-11 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-xs font-bold text-white shadow-sm transition flex items-center justify-center gap-1.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          >
            <LogIn className="w-4 h-4" /> Masuk
          </button>
        </div>
      </div>
    </div>
  );
}
