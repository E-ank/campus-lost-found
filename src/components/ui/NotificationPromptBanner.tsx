'use client';

import { useState, useSyncExternalStore } from 'react';
import { Bell, X } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import {
  getNotificationPermission,
  isNotificationSupported,
  requestNotificationPermission,
} from '@/lib/notifications';

const SESSION_DISMISS_KEY = 'campus_notif_banner_dismissed_v1';
const BANNER_CHANGE_EVENT = 'campus_notif_banner_change';

function subscribeBannerEligibility(callback: () => void) {
  window.addEventListener(BANNER_CHANGE_EVENT, callback);
  window.addEventListener('storage', callback);
  return () => {
    window.removeEventListener(BANNER_CHANGE_EVENT, callback);
    window.removeEventListener('storage', callback);
  };
}

function getBannerSnapshot(): boolean {
  if (!isNotificationSupported()) return false;
  if (getNotificationPermission() !== 'default') return false;
  try {
    return !sessionStorage.getItem(SESSION_DISMISS_KEY);
  } catch {
    return false;
  }
}

function getServerBannerSnapshot(): boolean {
  return false;
}

export default function NotificationPromptBanner() {
  const { currentUser } = useApp();
  const canShow = useSyncExternalStore(
    subscribeBannerEligibility,
    getBannerSnapshot,
    getServerBannerSnapshot
  );
  const [loading, setLoading] = useState(false);

  const notifyBannerChange = () => {
    window.dispatchEvent(new Event(BANNER_CHANGE_EVENT));
  };

  const handleEnable = async () => {
    setLoading(true);
    try {
      const granted = await requestNotificationPermission(currentUser?.id, currentUser?.role);
      if (!granted) {
        try {
          sessionStorage.setItem(SESSION_DISMISS_KEY, 'true');
        } catch {
          // Abaikan storage error pada WebView terbatas
        }
      }
      notifyBannerChange();
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = () => {
    try {
      sessionStorage.setItem(SESSION_DISMISS_KEY, 'true');
    } catch {
      // Abaikan storage error pada WebView terbatas
    }
    notifyBannerChange();
  };

  if (!canShow || !currentUser) return null;

  return (
    <div className="bg-blue-700 text-white px-4 py-2.5 sm:py-3">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center shrink-0">
            <Bell className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-xs font-black tracking-tight leading-tight">
              Aktifkan Push Notifikasi Kampus
            </p>
            <p className="text-[11px] text-blue-50 mt-0.5 leading-snug">
              Dapatkan pemberitahuan seketika saat ada titipan barang di pos atau status klaim Anda diverifikasi.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleEnable}
            disabled={loading}
            className="min-h-11 px-4 py-2 rounded-xl bg-white text-blue-800 hover:bg-blue-50 font-black text-xs shadow-sm transition active:scale-95 disabled:opacity-75 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            {loading ? 'Mengaktifkan...' : 'Izinkan Notifikasi'}
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Tutup pemberitahuan izin"
            className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-xl text-white/90 hover:text-white hover:bg-white/15 transition focus-visible:outline-2 focus-visible:outline-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
