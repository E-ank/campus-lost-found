'use client';

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  url?: string;
  createdAt: string;
  createdAtIso: string;
  isRead: boolean;
  type: 'CLAIM_SUBMITTED' | 'CLAIM_DECIDED' | 'TITIPAN_NEW' | 'HANDOVER_COMPLETED';
}

const STORAGE_KEY = 'campus_lost_found_notifications_v1';
const READ_IDS_KEY = 'campus_lost_found_read_notif_ids_v1';
const EVENT_NAME = 'app_notification_received';

function getReadNotificationIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(READ_IDS_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr.filter((v): v is string => typeof v === 'string')) : new Set();
  } catch {
    return new Set();
  }
}

function addReadNotificationIds(ids: string[]): void {
  if (typeof window === 'undefined' || ids.length === 0) return;
  try {
    const set = getReadNotificationIds();
    for (const id of ids) {
      if (id) set.add(id);
    }
    // Simpan maksimal 500 ID terakhir agar tidak memenuhi localStorage
    const list = Array.from(set).slice(-500);
    localStorage.setItem(READ_IDS_KEY, JSON.stringify(list));
  } catch {
    // Abaikan error storage
  }
}

function markIndexedDBNotificationsRead(targetId?: string): void {
  if (typeof window === 'undefined' || !('indexedDB' in window)) return;
  try {
    const req = indexedDB.open('campus_lost_found_db', 1);
    req.onsuccess = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('notifications')) return;
      const tx = db.transaction('notifications', 'readwrite');
      const store = tx.objectStore('notifications');
      const getAllReq = store.getAll();
      getAllReq.onsuccess = () => {
        const items = (getAllReq.result as AppNotification[]) || [];
        for (const item of items) {
          if (!targetId || item.id === targetId) {
            if (!item.isRead) {
              store.put({ ...item, isRead: true });
            }
          }
        }
      };
    };
  } catch {
    // Abaikan error IndexedDB
  }
}

export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/**
 * Memainkan nada notifikasi (audio chime) ramah & jernih tanpa memerlukan file mp3 eksternal.
 * Bekerja langsung di browser desktop maupun mobile web.
 */
export function playNotificationSound(): void {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      void ctx.resume();
    }
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    // Nada dual tone manis: D5 (587 Hz) naik ke A5 (880 Hz)
    osc.frequency.setValueAtTime(587.33, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12);

    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.005, ctx.currentTime + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch {
    // Abaikan jika browser belum mengizinkan audio sebelum interaksi pengguna
  }
}

export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isNotificationSupported()) return 'unsupported';
  return Notification.permission;
}

import { VAPID_PUBLIC_KEY, urlBase64ToUint8Array } from '@/lib/push-vapid';

export async function registerPushSubscription(
  userId?: string | null,
  role?: string | null
): Promise<boolean> {
  if (
    typeof window === 'undefined' ||
    !('serviceWorker' in navigator) ||
    !('PushManager' in window)
  ) {
    return false;
  }
  try {
    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as unknown as BufferSource,
      });
    }

    if (subscription) {
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: subscription.toJSON(),
          userId: userId || null,
          role: role || 'USER',
        }),
      });
      return true;
    }
  } catch (err) {
    console.warn('Gagal mendaftarkan PushSubscription ke server:', err);
  }
  return false;
}

export async function requestNotificationPermission(
  userId?: string | null,
  role?: string | null
): Promise<boolean> {
  if (!isNotificationSupported()) return false;
  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      void registerPushSubscription(userId, role);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Gagal meminta izin notifikasi:', error);
    return false;
  }
}

export function sendBackgroundWebPush(payload: {
  title: string;
  body: string;
  url?: string;
  targetUserId?: string | null;
  targetRole?: string | null;
}): void {
  if (typeof window === 'undefined') return;
  try {
    void fetch('/api/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    // Abaikan jika offline
  }
}

export async function syncNotificationsFromIndexedDB(): Promise<void> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) return;
  try {
    const list = await new Promise<AppNotification[]>((resolve) => {
      const req = indexedDB.open('campus_lost_found_db', 1);
      req.onupgradeneeded = (e) => {
        const db = (e.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('notifications')) {
          db.createObjectStore('notifications', { keyPath: 'id' });
        }
      };
      req.onsuccess = (e) => {
        const db = (e.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('notifications')) {
          return resolve([]);
        }
        const tx = db.transaction('notifications', 'readonly');
        const getAllReq = tx.objectStore('notifications').getAll();
        getAllReq.onsuccess = () => resolve((getAllReq.result as AppNotification[]) || []);
        getAllReq.onerror = () => resolve([]);
      };
      req.onerror = () => resolve([]);
    });

    if (list && list.length > 0) {
      const current = getStoredNotifications();
      const readIds = getReadNotificationIds();
      let hasNew = false;
      const merged = [...current];
      for (const item of list) {
        if (!merged.some((m) => m.id === item.id)) {
          merged.unshift({
            ...item,
            isRead: item.isRead || readIds.has(item.id),
          });
          hasNew = true;
        }
      }
      if (hasNew) {
        saveStoredNotifications(merged);
        window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: merged }));
      }
    }
  } catch {
    // Abaikan error IndexedDB
  }
}

export function syncActiveNotificationsFromState(
  currentUser: { id: string; role: string } | null,
  items: Array<{ id: string; title: string; type: string; storageType: string; status: string; securityPost?: string; reporterUserId: string; createdAtIso?: string; createdAt?: string }>,
  claims: Array<{ id: string; itemId: string; itemTitle: string; claimantUserId: string; status: string; createdAtIso?: string; createdAt?: string; updatedAt?: string }>
): void {
  if (!currentUser || typeof window === 'undefined') return;
  const current = getStoredNotifications();
  const readIds = getReadNotificationIds();
  const nextList = [...current];
  let changed = false;

  const ensureNotif = (notif: Omit<AppNotification, 'isRead'>) => {
    if (nextList.some((n) => n.id === notif.id)) return;
    // Jika ID ini sudah pernah ditandai dibaca sebelumnya, jangan munculkan lagi sebagai belum dibaca.
    if (readIds.has(notif.id)) return;
    nextList.unshift({ ...notif, isRead: false });
    changed = true;
  };

  // 1. Pelapor / Penemu: notifikasi klaim masuk yang belum diverifikasi (status PENDING)
  const myFoundItems = items.filter(
    (i) => i.reporterUserId === currentUser.id && i.type === 'FOUND' && i.storageType === 'FINDER'
  );
  for (const item of myFoundItems) {
    const itemClaims = claims.filter((c) => c.itemId === item.id && c.status === 'PENDING');
    for (const cl of itemClaims) {
      ensureNotif({
        id: `pending_claim_${cl.id}`,
        title: 'Klaim Baru Masuk',
        body: `Seseorang mengajukan klaim atas barang temuan "${item.title}". Periksa dan verifikasi klaimnya.`,
        url: `/barang/${item.id}`,
        createdAt: 'Baru',
        createdAtIso: cl.createdAtIso || new Date().toISOString(),
        type: 'CLAIM_SUBMITTED',
      });
    }
  }

  // 2. Pengklaim: notifikasi status klaim miliknya (Disetujui / Ditolak / Selesai)
  const myClaims = claims.filter((c) => c.claimantUserId === currentUser.id);
  for (const cl of myClaims) {
    if (cl.status === 'APPROVED') {
      ensureNotif({
        id: `approved_claim_${cl.id}`,
        title: 'Klaim Disetujui!',
        body: `Klaim Anda untuk barang "${cl.itemTitle}" telah disetujui. QR Code dan tiket Anda sudah terbit.`,
        url: '/klaim',
        createdAt: 'Tersedia',
        createdAtIso: cl.updatedAt || cl.createdAtIso || new Date().toISOString(),
        type: 'CLAIM_DECIDED',
      });
    } else if (cl.status === 'REJECTED') {
      ensureNotif({
        id: `rejected_claim_${cl.id}`,
        title: 'Klaim Ditolak',
        body: `Klaim Anda untuk barang "${cl.itemTitle}" tidak disetujui oleh petugas.`,
        url: '/klaim',
        createdAt: 'Selesai',
        createdAtIso: cl.updatedAt || cl.createdAtIso || new Date().toISOString(),
        type: 'CLAIM_DECIDED',
      });
    } else if (cl.status === 'SELESAI') {
      ensureNotif({
        id: `done_claim_${cl.id}`,
        title: 'Serah Terima Selesai',
        body: `Barang "${cl.itemTitle}" telah resmi diserahkan kepada Anda.`,
        url: '/klaim',
        createdAt: 'Selesai',
        createdAtIso: cl.updatedAt || cl.createdAtIso || new Date().toISOString(),
        type: 'HANDOVER_COMPLETED',
      });
    }
  }

  // 3. Satpam: notifikasi barang temuan baru yang akan dititipkan di pos
  if (currentUser.role === 'SATPAM') {
    const pendingItems = items.filter(
      (i) => i.type === 'FOUND' && i.storageType === 'SATPAM' && i.status === 'Menunggu Diserahkan ke Pos'
    );
    for (const item of pendingItems) {
      ensureNotif({
        id: `pending_satpam_${item.id}`,
        title: 'Titipan Barang Baru',
        body: `Ada barang temuan "${item.title}" yang akan dititipkan di ${item.securityPost || 'Pos Satpam'}.`,
        url: '/satpam?tab=TITIPAN',
        createdAt: 'Menunggu',
        createdAtIso: item.createdAtIso || new Date().toISOString(),
        type: 'TITIPAN_NEW',
      });
    }
  }

  if (changed) {
    saveStoredNotifications(nextList);
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: nextList }));
  }
}

export function getStoredNotifications(): AppNotification[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as AppNotification[];
    const readIds = getReadNotificationIds();
    // Deduplikasi berdasarkan ID saja agar item dengan judul/isi sama tidak terhapus lalu dibuat ulang sebagai belum dibaca
    const unique: AppNotification[] = [];
    for (const item of list) {
      if (!unique.some((u) => u.id === item.id)) {
        unique.push({
          ...item,
          isRead: item.isRead || readIds.has(item.id),
        });
      }
    }
    return unique;
  } catch {
    return [];
  }
}

export function saveStoredNotifications(list: AppNotification[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, 50)));
  } catch (error) {
    console.error('Gagal menyimpan riwayat notifikasi:', error);
  }
}

/**
 * Hapus seluruh riwayat notifikasi di sisi client (dipanggil saat logout)
 */
export async function clearStoredNotifications(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(READ_IDS_KEY);

    // Hapus juga dari IndexedDB
    if ('indexedDB' in window) {
      try {
        const req = indexedDB.open('campus_lost_found_db', 1);
        req.onsuccess = (e) => {
          const db = (e.target as IDBOpenDBRequest).result;
          if (db.objectStoreNames.contains('notifications')) {
            const tx = db.transaction('notifications', 'readwrite');
            tx.objectStore('notifications').clear();
          }
        };
      } catch {
        // Abaikan
      }
    }

    // Cabut subscription push di browser dan hapus dari server jika ada
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await fetch('/api/push/subscribe', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint: sub.endpoint }),
          }).catch(() => undefined);
          await sub.unsubscribe();
        }
      } catch {
        // Abaikan
      }
    }

    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: [] }));
  } catch (error) {
    console.error('Gagal membersihkan riwayat notifikasi:', error);
  }
}

export function markNotificationAsRead(id: string): AppNotification[] {
  addReadNotificationIds([id]);
  markIndexedDBNotificationsRead(id);
  const current = getStoredNotifications();
  const updated = current.map((n) => (n.id === id ? { ...n, isRead: true } : n));
  saveStoredNotifications(updated);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: updated }));
  }
  return updated;
}

export function markAllNotificationsAsRead(): AppNotification[] {
  const current = getStoredNotifications();
  addReadNotificationIds(current.map((n) => n.id));
  markIndexedDBNotificationsRead();
  const updated = current.map((n) => ({ ...n, isRead: true }));
  saveStoredNotifications(updated);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: updated }));
  }
  return updated;
}

export async function dispatchPushNotification(payload: {
  id?: string;
  title: string;
  body: string;
  url?: string;
  type?: AppNotification['type'];
  skipSystemPopup?: boolean;
}): Promise<void> {
  const current = getStoredNotifications();
  const notifId = payload.id || `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  // Cegah duplikasi notifikasi: jika ID atau judul & isi yang sama sudah ada, abaikan
  const isDuplicate = current.some((n) => {
    if (payload.id && n.id === payload.id) return true;
    if (n.title === payload.title && n.body === payload.body) {
      const diff = Date.now() - new Date(n.createdAtIso).getTime();
      return Number.isNaN(diff) || diff < 120000;
    }
    return false;
  });
  if (isDuplicate) {
    return;
  }

  const now = new Date();
  const newNotification: AppNotification = {
    id: notifId,
    title: payload.title,
    body: payload.body,
    url: payload.url || '/',
    createdAt: now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
    createdAtIso: now.toISOString(),
    isRead: false,
    type: payload.type || 'CLAIM_DECIDED',
  };

  // Mainkan nada pemberitahuan
  playNotificationSound();

  // Simpan ke riwayat lokal
  const nextList = [newNotification, ...current];
  saveStoredNotifications(nextList);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: nextList }));
    window.dispatchEvent(
      new CustomEvent('app_in_app_banner', {
        detail: {
          title: payload.title,
          body: payload.body,
          url: payload.url || '/',
          type: payload.type || 'CLAIM_DECIDED',
        },
      })
    );
  }

  // Tampilkan notifikasi push sistem / browser hanya bila tab sedang tersembunyi
  // atau skipSystemPopup bernilai false (agar tidak double dengan in-app toast maupun background web push)
  const isTabVisible = typeof document !== 'undefined' && document.visibilityState === 'visible';
  if (!payload.skipSystemPopup && !isTabVisible && isNotificationSupported() && Notification.permission === 'granted') {
    const options: NotificationOptions = {
      body: payload.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: newNotification.id,
      data: { url: payload.url || '/' },
    };

    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready;
        if (registration && 'showNotification' in registration) {
          await registration.showNotification(payload.title, options);
          return;
        }
      }
      // Fallback native Notification
      const notif = new Notification(payload.title, options);
      if (
        payload.url &&
        payload.url.startsWith('/') &&
        !payload.url.startsWith('//') &&
        !payload.url.includes('\\')
      ) {
        const safeUrl = payload.url;
        notif.onclick = () => {
          window.focus();
          window.location.href = safeUrl;
          notif.close();
        };
      }
    } catch (err) {
      console.warn('Gagal menampilkan notifikasi sistem:', err);
    }
  }
}
