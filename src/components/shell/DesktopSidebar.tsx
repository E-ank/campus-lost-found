'use client';

import { Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { LogIn, LogOut, Settings, Shield } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { NAV_ACCENT_TEXT, useNavItems } from '@/components/shell/useNavItems';

// Sidebar tetap untuk layar 1024px ke atas (latar putih berbatas slate-200 sesuai DESIGN.md).
export default function DesktopSidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[248px] flex-col border-r border-slate-200 bg-white lg:flex">
      <SidebarBrand />

      <Suspense fallback={<div className="flex-1" />}>
        <SidebarNav />
      </Suspense>

      <SidebarAccount />
    </aside>
  );
}

function SidebarBrand() {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => router.push('/')}
      className="flex items-center gap-2.5 px-5 py-6 text-left border-b border-slate-200 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-700"
    >
      <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-sm">
        <Shield className="w-5 h-5 text-white" />
      </div>
      <div>
        <p className="font-black text-sm tracking-tighter leading-none text-slate-900 uppercase">
          LOST &amp; FOUND
        </p>
        <p className="text-[10px] font-bold text-blue-700 mt-1 tracking-wider uppercase">
          Campus Portal
        </p>
      </div>
    </button>
  );
}

function SidebarNav() {
  const items = useNavItems();

  return (
    <nav className="flex-1 px-4 py-6 space-y-1.5" aria-label="Navigasi utama">
      {items.map((item) => {
        const Icon = item.icon;

        return (
          <button
            key={item.key}
            type="button"
            onClick={item.go}
            aria-current={item.isActive ? 'page' : undefined}
            className={`w-full min-h-11 flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13px] font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 ${
              item.isActive
                ? `bg-slate-100 ${NAV_ACCENT_TEXT[item.accent]} ring-1 ring-inset ring-slate-200`
                : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Icon className="w-4 h-4 shrink-0" />
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}

function SidebarAccount() {
  const router = useRouter();
  const { currentUser, logout } = useApp();

  if (!currentUser) {
    return (
      <div className="border-t border-slate-200 p-4">
        <button
          type="button"
          onClick={() => router.push('/login')}
          className="w-full min-h-12 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-xl transition shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
        >
          <LogIn className="w-4 h-4" />
          Masuk
        </button>
      </div>
    );
  }

  return (
    <div className="border-t border-slate-200 p-4 space-y-3">
      <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3 border border-slate-200">
        {currentUser.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={currentUser.avatarUrl}
            alt={`Foto profil ${currentUser.name}`}
            className="w-10 h-10 rounded-xl object-cover shrink-0 border border-slate-200"
          />
        ) : (
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center text-white text-xs font-black shrink-0 ${currentUser.avatarBg}`}
          >
            {currentUser.name.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <p className="text-xs font-black text-slate-900 truncate">{currentUser.name}</p>
          <p className="text-[11px] font-bold text-slate-600 truncate mt-0.5">
            {currentUser.roleLabel}
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => router.push('/akun/pengaturan')}
          className="flex-1 min-h-11 flex items-center justify-center gap-1.5 text-xs font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
        >
          <Settings className="w-3.5 h-3.5" />
          Pengaturan
        </button>
        <button
          type="button"
          onClick={logout}
          title="Keluar dari Akun"
          aria-label="Keluar dari akun"
          className="w-11 h-11 flex items-center justify-center rounded-xl bg-slate-100 text-slate-700 hover:bg-rose-50 hover:text-rose-700 transition border border-slate-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
