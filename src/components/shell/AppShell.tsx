'use client';

import { Suspense, type ReactNode } from 'react';
import AppHeader from '@/components/shell/AppHeader';
import BottomNav from '@/components/shell/BottomNav';
import DesktopSidebar from '@/components/shell/DesktopSidebar';
import DesktopTopBar from '@/components/shell/DesktopTopBar';
import LoginGateModal from '@/components/shell/LoginGateModal';
import ServiceWorkerRegistration from '@/components/pwa/ServiceWorkerRegistration';
import ToastHost from '@/components/shell/ToastHost';
import NotificationPromptBanner from '@/components/ui/NotificationPromptBanner';
import OfflineStatusBar from '@/components/ui/OfflineStatusBar';

// Kerangka aplikasi. Di bawah 1024px tetap berupa kolom mobile-first yang
// ditengahkan di atas latar gelap; mulai 1024px berubah menjadi sidebar tetap,
// bilah atas, dan area konten selebar 1240px.
export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-900 lg:bg-slate-100 font-sans text-slate-800">
      <DesktopSidebar />

      <div className="flex min-h-screen flex-col lg:pl-[248px]">
        <OfflineStatusBar />
        <NotificationPromptBanner />
        <DesktopTopBar />

        <div className="flex flex-1 flex-col items-center py-0 sm:py-4 lg:block lg:py-0">
          <div className="w-full max-w-md lg:mx-auto lg:max-w-[1240px] min-h-[calc(100vh-5rem)] lg:min-h-0 bg-slate-50 lg:bg-transparent pb-24 lg:pb-8 shadow-2xl lg:shadow-none relative flex flex-col sm:rounded-b-2xl lg:rounded-none overflow-x-clip border-x border-b border-slate-300 lg:border-x-0 lg:border-b-0">
            <ServiceWorkerRegistration />
            <ToastHost />

            <AppHeader />

            <div className="flex flex-1 flex-col lg:px-9 lg:py-7">
              <Suspense fallback={null}>{children}</Suspense>
            </div>

            <LoginGateModal />

            <div className="lg:hidden">
              <BottomNav />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
