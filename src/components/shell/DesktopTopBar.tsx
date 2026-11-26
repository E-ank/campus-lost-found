'use client';

import { type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { PackagePlus, Search, X } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { GATE_MESSAGES, useGuardedNavigate } from '@/components/shell/useNavItems';
import NotificationBell from '@/components/ui/NotificationBell';

// Bilah atas desktop: pencarian global dan aksi utama. Hanya tampil >=1024px.
export default function DesktopTopBar() {
  const router = useRouter();
  const { feedSearch, setFeedSearch } = useApp();
  const guarded = useGuardedNavigate();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    router.push('/');
  };

  return (
    <header className="sticky top-0 z-30 hidden items-center gap-6 border-b border-slate-200 bg-white px-8 py-4 lg:flex">
      <form onSubmit={handleSubmit} className="relative w-full max-w-[560px]">
        <Search className="w-4 h-4 text-slate-600 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={feedSearch}
          onChange={(event) => setFeedSearch(event.target.value)}
          placeholder="Cari barang hilang atau temuan..."
          aria-label="Cari barang hilang atau temuan"
          className="w-full min-h-11 pl-11 pr-12 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-700 focus:bg-white transition-all"
        />
        {feedSearch && (
          <button
            type="button"
            onClick={() => setFeedSearch('')}
            aria-label="Hapus pencarian"
            className="absolute right-0.5 top-1/2 -translate-y-1/2 min-h-11 min-w-11 inline-flex items-center justify-center text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-200 transition focus-visible:outline-2 focus-visible:outline-blue-700"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </form>

      <div className="ml-auto flex items-center gap-3">
        <NotificationBell />
        <button
          type="button"
          onClick={guarded('/lapor', GATE_MESSAGES.upload)}
          className="shrink-0 min-h-11 flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs px-5 rounded-xl transition shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
        >
          <PackagePlus className="w-4 h-4" />
          Lapor Barang
        </button>
      </div>
    </header>
  );
}
