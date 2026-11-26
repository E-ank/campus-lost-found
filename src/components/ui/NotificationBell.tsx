'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bell,
  CheckCircle2,
  PackageCheck,
  PackagePlus,
  ShieldCheck,
  X,
} from 'lucide-react';
import {
  type AppNotification,
  getNotificationPermission,
  getStoredNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  requestNotificationPermission,
  saveStoredNotifications,
  syncNotificationsFromIndexedDB,
} from '@/lib/notifications';
import { useApp } from '@/context/AppContext';

export default function NotificationBell() {
  const { currentUser } = useApp();
  if (!currentUser) return null;
  return <NotificationBellInner key={currentUser.id} userId={currentUser.id} userRole={currentUser.role} />;
}

function NotificationBellInner({ userId, userRole }: { userId: string; userRole: string }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>(() =>
    getStoredNotifications()
  );
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(() =>
    getNotificationPermission()
  );
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    void syncNotificationsFromIndexedDB().then(() => {
      if (active) setNotifications(getStoredNotifications());
    });

    const handleUpdate = (e: Event) => {
      const custom = e as CustomEvent<AppNotification[]>;
      if (custom.detail) {
        setNotifications(custom.detail);
      } else {
        setNotifications(getStoredNotifications());
      }
    };

    window.addEventListener('app_notification_received', handleUpdate);

    const handleSwMessage = (e: MessageEvent) => {
      if (e.data?.type === 'PUSH_NOTIFICATION_RECEIVED' && e.data.notification) {
        const item = e.data.notification as AppNotification;
        const current = getStoredNotifications();
        if (
          current.some(
            (c) =>
              c.id === item.id ||
              (c.title === item.title && c.body === item.body)
          )
        ) {
          return;
        }
        const next = [item, ...current];
        saveStoredNotifications(next);
        setNotifications(next);
      }
    };

    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleSwMessage);
    }

    return () => {
      active = false;
      window.removeEventListener('app_notification_received', handleUpdate);
      if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleSwMessage);
      }
    };
  }, [userId]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handleRequestPermission = async () => {
    const granted = await requestNotificationPermission(userId, userRole);
    setPermission(granted ? 'granted' : 'denied');
  };

  const handleItemClick = (n: AppNotification) => {
    markNotificationAsRead(n.id);
    setIsOpen(false);
    if (n.url) {
      router.push(n.url);
    }
  };

  const renderIcon = (type: AppNotification['type']) => {
    switch (type) {
      case 'TITIPAN_NEW':
        return <PackagePlus className="w-4 h-4 text-amber-700" />;
      case 'CLAIM_SUBMITTED':
        return <PackageCheck className="w-4 h-4 text-blue-700" />;
      case 'HANDOVER_COMPLETED':
        return <ShieldCheck className="w-4 h-4 text-emerald-700" />;
      case 'CLAIM_DECIDED':
      default:
        return <CheckCircle2 className="w-4 h-4 text-emerald-700" />;
    }
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Pemberitahuan"
        aria-expanded={isOpen}
        className="relative w-11 h-11 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-600 text-white text-[10px] font-black rounded-full flex items-center justify-center ring-2 ring-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-label="Panel notifikasi"
          className="fixed left-3 right-3 top-16 sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-96 bg-white rounded-2xl shadow-xl border border-slate-200 p-4 z-50 animate-fadeIn space-y-3"
        >
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <div className="flex items-center gap-1.5">
              <Bell className="w-4 h-4 text-blue-700" />
              <h3 className="text-xs font-black text-slate-900">Notifikasi</h3>
              {unreadCount > 0 && (
                <span className="text-[10px] font-bold text-blue-800 bg-blue-50 px-2 py-0.5 rounded-full">
                  {unreadCount} baru
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => setNotifications(markAllNotificationsAsRead())}
                  className="min-h-11 px-2 text-[11px] font-bold text-slate-700 hover:text-blue-700 rounded-lg transition focus-visible:outline-2 focus-visible:outline-blue-700"
                >
                  Tandai dibaca
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Tutup panel notifikasi"
                className="min-h-11 min-w-11 -mr-2 rounded-xl text-slate-600 hover:text-slate-900 flex items-center justify-center hover:bg-slate-100 transition focus-visible:outline-2 focus-visible:outline-blue-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {permission === 'default' && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-start gap-2.5">
              <Bell className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs font-bold text-blue-950">Aktifkan Push Notifikasi</p>
                <p className="text-[11px] text-blue-900 mt-0.5 leading-snug">
                  Dapatkan info langsung saat ada titipan baru, klaim masuk, atau status klaim Anda diperbarui.
                </p>
                <button
                  type="button"
                  onClick={handleRequestPermission}
                  className="mt-2 min-h-11 px-3.5 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold transition shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
                >
                  Izinkan Notifikasi
                </button>
              </div>
            </div>
          )}

          <div className="max-h-80 overflow-y-auto space-y-2 no-scrollbar">
            {notifications.length === 0 ? (
              <div className="py-8 text-center text-slate-600 space-y-1">
                <Bell className="w-8 h-8 mx-auto text-slate-400" />
                <p className="text-xs font-bold text-slate-700">Belum ada notifikasi</p>
              </div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => handleItemClick(n)}
                  className={`w-full text-left p-3 rounded-xl border transition flex gap-3 focus-visible:outline-2 focus-visible:outline-blue-700 ${
                    n.isRead
                      ? 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                      : 'bg-white border-blue-200 shadow-sm hover:border-blue-400 ring-1 ring-blue-100'
                  }`}
                >
                  <div className="mt-0.5 shrink-0 p-1.5 rounded-lg bg-slate-100">
                    {renderIcon(n.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-1">
                      <p className={`text-xs truncate ${n.isRead ? 'font-bold text-slate-800' : 'font-black text-slate-900'}`}>
                        {n.title}
                      </p>
                      <span className="text-[10px] text-slate-600 whitespace-nowrap">
                        {n.createdAt}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-700 mt-0.5 leading-relaxed">
                      {n.body}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
