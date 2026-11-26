'use client';

import { Suspense } from 'react';
import { NAV_ACCENT_TEXT, useNavItems, type NavItem } from '@/components/shell/useNavItems';

// Navigasi bawah mobile-first. Digantikan sidebar mulai layar 1024px.
export default function BottomNav() {
  return (
    <Suspense fallback={<BottomNavBar items={[]} />}>
      <BottomNavWithRoute />
    </Suspense>
  );
}

function BottomNavWithRoute() {
  const items = useNavItems();
  return <BottomNavBar items={items} />;
}

function BottomNavBar({ items }: { items: NavItem[] }) {
  return (
    <nav
      aria-label="Navigasi bawah"
      className="fixed bottom-0 sm:bottom-4 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-slate-200 px-6 py-2.5 flex items-center justify-between z-40 shadow-[0_-8px_30px_rgb(0,0,0,0.04)] sm:rounded-3xl sm:border sm:mb-2"
    >
      {items.map((item) => {
        const Icon = item.icon;
        const isUpload = item.key === 'upload';

        return (
          <button
            key={item.key}
            type="button"
            onClick={item.go}
            aria-current={item.isActive ? 'page' : undefined}
            className={`flex flex-col items-center justify-center min-h-11 min-w-11 px-2 gap-1 rounded-xl transition-all active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 ${
              item.isActive ? NAV_ACCENT_TEXT[item.accent] : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {isUpload ? (
              <div
                className={`p-2 rounded-2xl ${
                  item.isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-700'
                }`}
              >
                <Icon className="w-5 h-5" />
              </div>
            ) : (
              <Icon className={`w-5 h-5 ${item.isActive ? 'fill-blue-600/10' : ''}`} />
            )}
            <span className={`text-[10px] font-black uppercase tracking-tighter ${isUpload ? 'mt-0.5' : ''}`}>
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
