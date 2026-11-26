'use client';

import { useRouter } from 'next/navigation';
import { LogIn, LogOut, Settings, Shield } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import NotificationBell from '@/components/ui/NotificationBell';

// Header aplikasi kampus: identitas sistem, notifikasi, pengaturan, dan keluar.
export default function AppHeader() {
  const router = useRouter();
  const { currentUser, logout } = useApp();

  return (
    <header className="lg:hidden bg-white px-4 py-3 border-b border-slate-200 shadow-sm sticky top-0 z-30">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => router.push('/')}
          className="flex items-center gap-2 min-h-11 text-left transition active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 rounded-xl"
        >
          <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center shadow-sm">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="font-black text-xs tracking-tighter leading-none text-slate-900 uppercase">
              LOST &amp; FOUND
            </h1>
            <p className="text-[10px] font-bold text-blue-700 mt-0.5 tracking-wider uppercase">
              Campus Portal
            </p>
          </div>
        </button>

        <div className="flex items-center gap-1.5">
          <NotificationBell />
          {!currentUser ? (
            <button
              type="button"
              onClick={() => router.push('/login')}
              className="min-h-11 bg-slate-900 text-white hover:bg-slate-800 font-bold text-xs px-4 rounded-xl shadow-sm flex items-center gap-1.5 transition active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
            >
              <LogIn className="w-3.5 h-3.5" />
              Masuk
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <div className="text-right hidden sm:block mr-1">
                <p className="text-[11px] font-black leading-tight truncate max-w-[100px] text-slate-900">
                  {currentUser.name.split(' ')[0]}
                </p>
              </div>
              <button
                type="button"
                onClick={() => router.push('/akun/pengaturan')}
                title="Pengaturan Akun"
                aria-label="Pengaturan Akun"
                className="w-11 h-11 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
              >
                <Settings className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={logout}
                title="Keluar dari Akun"
                aria-label="Keluar dari akun"
                className="w-11 h-11 rounded-xl bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-700 flex items-center justify-center transition active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
