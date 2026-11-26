'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import { INITIAL_CATEGORIES, INITIAL_LOCATIONS } from '@/data/seed';
import { createClient } from '@/lib/supabase/client';
import { toSyntheticEmail } from '@/lib/auth-identifier';
import { COMPLAINT_DESCRIPTION_MIN } from '@/lib/complaints';
import {
  clearStoredNotifications,
  dispatchPushNotification,
  registerPushSubscription,
  sendBackgroundWebPush,
  syncActiveNotificationsFromState,
} from '@/lib/notifications';
import {
  buildHandoverInfo,
  deleteCategory,
  deleteItem,
  deleteLocation,
  fetchCategories,
  fetchClaims,
  fetchComplaints,
  fetchItems,
  fetchLocations,
  insertCategory,
  insertClaim,
  insertComplaint,
  insertFoundReport,
  insertItem,
  insertLocation,
  updateClaimDecision,
  updateComplaintStatus as updateComplaintStatusQuery,
  updateItem,
  updateItemSensitivity,
  updateItemStatus,
} from '@/lib/supabase/queries';
import type {
  Claim,
  ClaimFormState,
  ClaimStatus,
  Complaint,
  ComplaintFormState,
  ComplaintStatus,
  FoundReportFormState,
  HandoverFormState,
  HandoverInfo,
  Item,
  ItemType,
  LoginGateState,
  RedirectIntent,
  ToastMessage,
  ToastType,
  UploadFormState,
  UserProfile,
  UserRole,
} from '@/types';

// Rute yang hanya boleh dibuka setelah login.
const PROTECTED_PATHS = ['/lapor', '/klaim', '/pengaduan', '/satpam', '/admin', '/akun'];

// Pemetaan kategori barang ke tema ilustrasi visual.
const CATEGORY_THEME_MAP: Record<string, string> = {
  'Identitas/KTM': 'ktm',
  Dompet: 'wallet',
  Kunci: 'key',
  Elektronik: 'charger',
  Lainnya: 'tumbler',
};

interface OpenLoginGateOptions {
  redirectPath?: string;
  itemId?: string | null;
  openClaim?: boolean;
}

interface AppContextValue {
  // Autentikasi & peran
  currentUser: UserProfile | null;
  authLoading: boolean;
  signIn: (identifier: string, password: string) => Promise<boolean>;
  refreshProfile: () => Promise<void>;
  updateProfile: (input: {
    password?: string;
    name: string;
    identifier?: string;
    emailPersonal: string;
    phone: string;
    department: string;
    avatarUrl: string;
    ktmUrl?: string;
    ktmVerified?: boolean;
    skipKtmVerifiedUpdate?: boolean;
  }) => Promise<boolean>;
  logout: () => void;

  // Login gate & redirect
  loginGate: LoginGateState;
  openLoginGate: (message: string, options?: OpenLoginGateOptions) => void;
  closeLoginGate: () => void;
  confirmLoginGate: () => void;
  redirectIntent: RedirectIntent | null;
  pendingClaimItemId: string | null;
  clearPendingClaim: () => void;

  // Data reaktif
  dataLoading: boolean;
  dataError: boolean;
  refreshData: () => Promise<void>;
  items: Item[];
  claims: Claim[];
  myReportedItems: Item[];
  myClaims: Claim[];
  locations: string[];
  categories: string[];
  addLocation: (name: string) => Promise<boolean>;
  removeLocation: (name: string) => Promise<boolean>;
  addCategory: (name: string) => Promise<boolean>;
  removeCategory: (name: string) => Promise<boolean>;

  // Pengaduan
  complaints: Complaint[];
  myComplaints: Complaint[];
  complaintsError: boolean;
  submitComplaint: (form: ComplaintFormState) => Promise<boolean>;
  setComplaintStatus: (complaintId: string, status: ComplaintStatus) => Promise<boolean>;

  // Filter beranda
  feedType: ItemType;
  setFeedType: (type: ItemType) => void;
  feedSearch: string;
  setFeedSearch: (value: string) => void;

  // Notifikasi
  toast: ToastMessage | null;
  showToast: (title: string, message: string, type?: ToastType) => void;
  dismissToast: () => void;

  // Aksi bisnis
  reportItem: (form: UploadFormState) => Promise<string | null>;
  updateReport: (itemId: string, form: UploadFormState) => Promise<boolean>;
  deleteReport: (itemId: string) => Promise<boolean>;
  reportSpamItem: (itemId: string) => Promise<boolean>;
  dismissSpamItem: (itemId: string) => Promise<boolean>;
  submitClaim: (item: Item, form: ClaimFormState) => Promise<boolean>;
  submitFoundReport: (item: Item, form: FoundReportFormState) => Promise<boolean>;
  decideClaim: (claimId: string, decision: ClaimStatus) => Promise<void>;
  setItemSensitivity: (itemId: string, isSensitive: boolean) => Promise<boolean>;
  confirmTitipanSatpam: (itemId: string) => Promise<void>;
  completeHandover: (form: HandoverFormState) => Promise<boolean>;
  completeFinderHandover: (claimId: string, photoFile: File | null) => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const router = useRouter();

  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [items, setItems] = useState<Item[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [locations, setLocations] = useState<string[]>(INITIAL_LOCATIONS);
  const [categories, setCategories] = useState<string[]>(INITIAL_CATEGORIES);
  const [feedType, setFeedType] = useState<ItemType>('FOUND');
  const [feedSearch, setFeedSearch] = useState('');
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [complaintsError, setComplaintsError] = useState(false);
  const [dataError, setDataError] = useState(false);

  const [toast, setToast] = useState<ToastMessage | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [loginGate, setLoginGate] = useState<LoginGateState>({ isOpen: false, message: '' });
  const [gateIntent, setGateIntent] = useState<RedirectIntent | null>(null);
  const [redirectIntent, setRedirectIntent] = useState<RedirectIntent | null>(null);
  const [pendingClaimItemId, setPendingClaimItemId] = useState<string | null>(null);

  const dismissToast = useCallback(() => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(null);
  }, []);

  const showToast = useCallback((title: string, message: string, type: ToastType = 'success') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ title, message, type });
    toastTimer.current = setTimeout(() => setToast(null), 3800);
  }, []);

  const clearPendingClaim = useCallback(() => setPendingClaimItemId(null), []);

  // ----- Login Gate -----
  const openLoginGate = useCallback((message: string, options?: OpenLoginGateOptions) => {
    setLoginGate({ isOpen: true, message });
    setGateIntent({
      path: options?.redirectPath ?? '/',
      itemId: options?.itemId ?? null,
      openClaim: options?.openClaim ?? false,
    });
  }, []);

  const closeLoginGate = useCallback(() => {
    setLoginGate({ isOpen: false, message: '' });
    setGateIntent(null);
    setPendingClaimItemId(null);
  }, []);

  const confirmLoginGate = useCallback(() => {
    setRedirectIntent(gateIntent);
    setLoginGate({ isOpen: false, message: '' });
    setGateIntent(null);
    router.push('/login');
  }, [gateIntent, router]);

  // ----- Autentikasi (Supabase) -----
  const supabase = useMemo(() => createClient(), []);

  const prevItemsRef = useRef<Item[]>([]);
  const prevClaimsRef = useRef<Claim[]>([]);
  const isFirstLoadRef = useRef(true);
  const currentUserRef = useRef<UserProfile | null>(currentUser);
  const itemsRef = useRef<Item[]>(items);
  const lastActiveUserIdRef = useRef<string | null>(null);
  const realtimeChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const refreshSeqRef = useRef(0);

  useEffect(() => {
    currentUserRef.current = currentUser;
    itemsRef.current = items;
  }, [currentUser, items]);

  // Kirim broadcast instan ke seluruh tab/perangkat aktif
  const broadcastSync = useCallback(() => {
    try {
      void realtimeChannelRef.current?.send({
        type: 'broadcast',
        event: 'REFRESH_AND_NOTIFY',
        payload: { timestamp: Date.now() },
      });
    } catch {
      // Socket mungkin belum siap
    }
  }, []);

  const refreshData = useCallback(async () => {
    const seq = ++refreshSeqRef.current;
    try {
      const [nextItems, nextClaims, nextLocations, nextCategories] = await Promise.all([
        fetchItems(supabase),
        fetchClaims(supabase),
        fetchLocations(supabase),
        fetchCategories(supabase),
      ]);

      if (seq !== refreshSeqRef.current) return;

      const user = currentUserRef.current;
      const isUserChange = (user?.id ?? null) !== lastActiveUserIdRef.current;

      if (!isFirstLoadRef.current && !isUserChange) {
        const prevClaims = prevClaimsRef.current;
        const prevItems = prevItemsRef.current;

        const addedClaims = nextClaims.filter((nc) => !prevClaims.some((pc) => pc.id === nc.id));
        for (const nc of addedClaims) {
          if (nc.storageType === 'FINDER') {
            const item = nextItems.find((i) => i.id === nc.itemId);
            if (item && item.reporterUserId === user?.id) {
              void dispatchPushNotification({
                id: `claim_pending_${nc.id}`,
                title: 'Klaim Baru Masuk',
                body: `Seseorang mengajukan klaim atas barang temuan "${nc.itemTitle}". Periksa dan verifikasi klaimnya.`,
                url: `/barang/${nc.itemId}`,
                type: 'CLAIM_SUBMITTED',
                skipSystemPopup: true,
              });
            }
          }
        }

        if (user) {
          for (const nc of nextClaims) {
            if (nc.claimantUserId === user.id) {
              const prev = prevClaims.find((pc) => pc.id === nc.id);
              if (prev && prev.status !== nc.status) {
                if (nc.status === 'APPROVED') {
                  void dispatchPushNotification({
                    id: `claim_approved_${nc.id}`,
                    title: 'Klaim Disetujui!',
                    body: `Klaim Anda untuk barang "${nc.itemTitle}" telah disetujui. QR Code dan kode tiket pengambilan Anda sudah terbit.`,
                    url: '/klaim',
                    type: 'CLAIM_DECIDED',
                    skipSystemPopup: true,
                  });
                } else if (nc.status === 'REJECTED') {
                  void dispatchPushNotification({
                    id: `claim_rejected_${nc.id}`,
                    title: 'Klaim Ditolak',
                    body: `Klaim Anda untuk barang "${nc.itemTitle}" tidak disetujui oleh petugas.`,
                    url: '/klaim',
                    type: 'CLAIM_DECIDED',
                    skipSystemPopup: true,
                  });
                } else if (nc.status === 'SELESAI') {
                  void dispatchPushNotification({
                    id: `claim_done_${nc.id}`,
                    title: 'Serah Terima Selesai',
                    body: `Barang "${nc.itemTitle}" telah resmi diserahkan kepada Anda.`,
                    url: '/klaim',
                    type: 'HANDOVER_COMPLETED',
                    skipSystemPopup: true,
                  });
                }
              }
            }
          }
        }

        if (user?.role === 'SATPAM') {
          const addedItems = nextItems.filter((ni) => !prevItems.some((pi) => pi.id === ni.id));
          for (const ni of addedItems) {
            if (ni.type === 'FOUND' && ni.storageType === 'SATPAM') {
              void dispatchPushNotification({
                id: `titipan_new_${ni.id}`,
                title: 'Titipan Barang Baru',
                body: `Ada barang temuan "${ni.title}" yang akan dititipkan di ${ni.securityPost}.`,
                url: '/satpam?tab=TITIPAN',
                type: 'TITIPAN_NEW',
                skipSystemPopup: true,
              });
            }
          }
        }
      }

      isFirstLoadRef.current = false;
      lastActiveUserIdRef.current = user?.id ?? null;
      prevItemsRef.current = nextItems;
      prevClaimsRef.current = nextClaims;

      setItems(nextItems);
      setClaims(nextClaims);

      syncActiveNotificationsFromState(currentUserRef.current, nextItems, nextClaims);
      if (nextLocations !== null) setLocations(nextLocations);
      if (nextCategories !== null) setCategories(nextCategories);
      setDataError(false);
    } catch {
      if (seq === refreshSeqRef.current) {
        setDataError(true);
      }
    }

    try {
      const nextComplaints = await fetchComplaints(supabase);
      if (seq === refreshSeqRef.current) {
        setComplaints(nextComplaints);
        setComplaintsError(false);
      }
    } catch {
      if (seq === refreshSeqRef.current) {
        setComplaintsError(true);
      }
    } finally {
      if (seq === refreshSeqRef.current) {
        setDataLoading(false);
      }
    }
  }, [supabase]);

  // ----- Data master: lokasi & kategori (khusus Superadmin) -----
  const addLocation = useCallback(
    async (name: string): Promise<boolean> => {
      if (currentUser?.role !== 'SUPERADMIN') {
        showToast('Akses Ditolak', 'Hanya Superadmin yang dapat menambah lokasi.', 'error');
        return false;
      }

      const trimmed = name.trim();
      if (!trimmed) {
        showToast('Nama Lokasi Kosong', 'Isi nama lokasi terlebih dahulu.', 'error');
        return false;
      }
      if (locations.some((location) => location.toLowerCase() === trimmed.toLowerCase())) {
        showToast('Lokasi Sudah Ada', `"${trimmed}" sudah tersedia di daftar.`, 'info');
        return false;
      }

      const saved = await insertLocation(supabase, trimmed);
      if (!saved) {
        showToast(
          'Gagal Menyimpan Lokasi',
          'Perubahan tidak tersimpan. Pastikan migrasi admin_panel.sql sudah dijalankan.',
          'error'
        );
        return false;
      }

      await refreshData();
      broadcastSync();
      showToast('Lokasi Ditambahkan', `"${trimmed}" kini tampil di filter dan form laporan.`);
      return true;
    },
    [broadcastSync, currentUser, locations, refreshData, showToast, supabase]
  );

  const removeLocation = useCallback(
    async (name: string): Promise<boolean> => {
      if (currentUser?.role !== 'SUPERADMIN') {
        showToast('Akses Ditolak', 'Hanya Superadmin yang dapat menghapus lokasi.', 'error');
        return false;
      }
      if (locations.length <= 1) {
        showToast(
          'Lokasi Terakhir',
          'Minimal satu lokasi harus tersedia agar form laporan tetap bisa dipakai.',
          'error'
        );
        return false;
      }

      const saved = await deleteLocation(supabase, name);
      if (!saved) {
        showToast(
          'Gagal Menghapus Lokasi',
          'Perubahan tidak tersimpan. Periksa koneksi Anda lalu coba lagi.',
          'error'
        );
        return false;
      }

      await refreshData();
      broadcastSync();
      showToast(
        'Lokasi Dihapus',
        `"${name}" tidak lagi muncul di filter. Laporan lama tetap menyimpan nama lokasi ini.`
      );
      return true;
    },
    [broadcastSync, currentUser, locations.length, refreshData, showToast, supabase]
  );

  const addCategory = useCallback(
    async (name: string): Promise<boolean> => {
      if (currentUser?.role !== 'SUPERADMIN') {
        showToast('Akses Ditolak', 'Hanya Superadmin yang dapat menambah kategori.', 'error');
        return false;
      }

      const trimmed = name.trim();
      if (!trimmed) {
        showToast('Nama Kategori Kosong', 'Isi nama kategori terlebih dahulu.', 'error');
        return false;
      }
      if (categories.some((category) => category.toLowerCase() === trimmed.toLowerCase())) {
        showToast('Kategori Sudah Ada', `"${trimmed}" sudah tersedia di daftar.`, 'info');
        return false;
      }

      const saved = await insertCategory(supabase, trimmed);
      if (!saved) {
        showToast(
          'Gagal Menyimpan Kategori',
          'Perubahan tidak tersimpan. Pastikan migrasi admin_panel.sql sudah dijalankan.',
          'error'
        );
        return false;
      }

      await refreshData();
      broadcastSync();
      showToast('Kategori Ditambahkan', `"${trimmed}" kini tampil di filter dan form laporan.`);
      return true;
    },
    [broadcastSync, categories, currentUser, refreshData, showToast, supabase]
  );

  const removeCategory = useCallback(
    async (name: string): Promise<boolean> => {
      if (currentUser?.role !== 'SUPERADMIN') {
        showToast('Akses Ditolak', 'Hanya Superadmin yang dapat menghapus kategori.', 'error');
        return false;
      }
      if (categories.length <= 1) {
        showToast(
          'Kategori Terakhir',
          'Minimal satu kategori harus tersedia agar form laporan tetap bisa dipakai.',
          'error'
        );
        return false;
      }

      const saved = await deleteCategory(supabase, name);
      if (!saved) {
        showToast(
          'Gagal Menghapus Kategori',
          'Perubahan tidak tersimpan. Periksa koneksi Anda lalu coba lagi.',
          'error'
        );
        return false;
      }

      await refreshData();
      broadcastSync();
      showToast(
        'Kategori Dihapus',
        `"${name}" tidak lagi muncul di filter. Laporan lama tetap menyimpan nama kategori ini.`
      );
      return true;
    },
    [broadcastSync, categories.length, currentUser, refreshData, showToast, supabase]
  );

  // Muat data awal saat halaman pertama dibuka
  useEffect(() => {
    let active = true;
    const loadInitialData = async () => {
      if (active) await refreshData();
    };
    void loadInitialData();
    return () => {
      active = false;
    };
  }, [refreshData]);

  // Polling sinkronisasi data latar belakang setiap 8 detik saat tab aktif
  useEffect(() => {
    const timer = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        void refreshData();
      }
    }, 8000);
    return () => clearInterval(timer);
  }, [refreshData]);

  // Tampilkan toast in-app seketika saat ada push notifikasi
  useEffect(() => {
    const handleInApp = (e: Event) => {
      const custom = e as CustomEvent<{ title: string; body: string }>;
      if (custom.detail) {
        showToast(custom.detail.title, custom.detail.body, 'info');
      }
    };
    window.addEventListener('app_in_app_banner', handleInApp);
    return () => window.removeEventListener('app_in_app_banner', handleInApp);
  }, [showToast]);

  const currentUserId = currentUser?.id ?? null;
  const currentUserRole = currentUser?.role ?? null;

  // Daftarkan langganan background push sekali saat akun/peran aktif berubah.
  useEffect(() => {
    if (
      currentUserId &&
      typeof window !== 'undefined' &&
      'Notification' in window &&
      Notification.permission === 'granted'
    ) {
      void registerPushSubscription();
    }
  }, [currentUserId, currentUserRole]);

  // Sinkronkan ringkasan notifikasi in-app saat state barang atau klaim diperbarui.
  useEffect(() => {
    if (currentUser) {
      syncActiveNotificationsFromState(currentUser, items, claims);
    }
  }, [currentUser, items, claims]);

  // Realtime: sinkronisasi instan via Supabase Broadcast & Postgres Changes
  useEffect(() => {
    const channel = supabase.channel('app_realtime_events', {
      config: {
        broadcast: { ack: true },
      },
    });
    realtimeChannelRef.current = channel;

    channel
      .on('broadcast', { event: 'REFRESH_AND_NOTIFY' }, () => {
        void refreshData();
      })
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'complaints' },
        () => {
          void refreshData();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'items' },
        () => {
          void refreshData();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'claims' },
        () => {
          void refreshData();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, refreshData]);

  const fetchProfile = useCallback(
    async (userId: string): Promise<UserProfile | null> => {
      const { data: initialProfile, error: profileErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      let data = initialProfile;

      if (profileErr || !data) {
        const { data: authData } = await supabase.auth.getUser();
        if (authData.user && authData.user.id === userId) {
          const userMeta = authData.user.user_metadata || {};
          const fallbackName =
            userMeta.full_name ||
            userMeta.name ||
            authData.user.email?.split('@')[0] ||
            'Mahasiswa';
          const avatarUrl = userMeta.avatar_url || userMeta.picture || null;
          const email = authData.user.email ?? '';

          const defaultProfile = {
            id: userId,
            role: 'MAHASISWA',
            role_label: 'Mahasiswa',
            name: fallbackName,
            identifier: '-',
            id_type: 'NIM',
            department: 'Belum diisi',
            phone: '-',
            avatar_bg: 'bg-blue-600',
            avatar_url: avatarUrl,
            email_personal: email,
            must_change_password: false,
            profile_completed: false,
            is_active: true,
          };

          const { data: inserted, error: insertError } = await supabase
            .from('profiles')
            .upsert(defaultProfile, { onConflict: 'id' })
            .select('*')
            .single();

          if (!insertError && inserted) {
            data = inserted;
          }
        }
      }

      if (!data) return null;

      const isCompleted =
        Boolean(data.profile_completed) &&
        data.identifier !== '-' &&
        data.department !== 'Belum diisi';

      const authUser = (await supabase.auth.getUser()).data.user;
      const userMeta =
        authUser?.id === userId ? (authUser.user_metadata as Record<string, unknown> | undefined) : null;

      let ktmUrl = (data.ktm_url as string | undefined) || null;
      let ktmVerified = Boolean(data.ktm_verified);
      let ktmRejected = Boolean(userMeta?.ktm_rejected);

      try {
        const ktmStatusRes = await fetch('/api/auth/ktm-status');
        if (ktmStatusRes.ok) {
          const ktmStatus = await ktmStatusRes.json();
          if (ktmStatus.userId === userId) {
            ktmVerified = Boolean(ktmStatus.ktmVerified);
            if (ktmStatus.ktmUrl) ktmUrl = ktmStatus.ktmUrl;
            ktmRejected = Boolean(ktmStatus.ktmRejected);
          }
        }
      } catch {
        // Fallback jika API sedang tidak terjangkau
      }

      if (!ktmUrl && !ktmRejected) {
        try {
          const { data: cardFiles } = await supabase.storage.from('ktm-cards').list(userId, {
            limit: 20,
            sortBy: { column: 'name', order: 'desc' },
          });
          if (cardFiles && cardFiles.length > 0) {
            ktmUrl = supabase.storage.from('ktm-cards').getPublicUrl(`${userId}/${cardFiles[0].name}`).data.publicUrl;
          } else {
            const { data: storageFiles } = await supabase.storage.from('avatars').list(userId, {
              limit: 50,
              sortBy: { column: 'name', order: 'desc' },
            });
            const ktmFile = storageFiles?.find((f) => f.name.startsWith('ktm-'));
            if (ktmFile) {
              ktmUrl = supabase.storage.from('avatars').getPublicUrl(`${userId}/${ktmFile.name}`).data.publicUrl;
            }
          }
        } catch {
          // ignore
        }
      }

      return {
        id: data.id,
        role: data.role as UserRole,
        roleLabel: data.role_label,
        name: data.name,
        identifier: data.identifier,
        idType: data.id_type,
        department: data.department ?? '-',
        phone: data.phone ?? '-',
        avatarBg: data.avatar_bg ?? 'bg-blue-600',
        avatarUrl: data.avatar_url ?? null,
        emailPersonal: data.email_personal ?? '',
        mustChangePassword: Boolean(data.must_change_password),
        profileCompleted: isCompleted,
        isActive: data.is_active !== false,
        ktmUrl,
        ktmVerified,
        ktmRejected,
      };
    },
    [supabase]
  );

  const routeAfterAuth = useCallback(
    (role: UserRole) => {
      if (role === 'SATPAM') router.push('/satpam');
      else if (role === 'SUPERADMIN') router.push('/admin');
      else router.push('/');
    },
    [router]
  );

  useEffect(() => {
    let active = true;

    const restore = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session?.user) {
        const profile = await fetchProfile(data.session.user.id);

        if (profile && !profile.isActive) {
          await supabase.auth.signOut();
          if (active) {
            setCurrentUser(null);
            showToast(
              'Akun Dinonaktifkan',
              'Akses akun ini sedang dibekukan. Hubungi Superadmin kampus.',
              'error'
            );
          }
        } else if (active && profile) {
          setCurrentUser(profile);
        }

        await refreshData();
      }
      if (active) setAuthLoading(false);
    };
    void restore();

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session?.user) {
        setCurrentUser(null);
        setPendingClaimItemId(null);
        return;
      }
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        const uid = session.user.id;
        if (currentUserRef.current?.id === uid && event === 'SIGNED_IN') return;
        void fetchProfile(uid).then((profile) => {
          if (active && profile && profile.isActive) {
            setCurrentUser(profile);
          }
        });
      }
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [supabase, fetchProfile, refreshData, showToast]);

  const signIn = useCallback(
    async (identifier: string, password: string): Promise<boolean> => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: toSyntheticEmail(identifier),
        password,
      });

      if (error || !data.user) {
        const reason = error?.message.toLowerCase() ?? '';
        if (reason.includes('banned') || reason.includes('disabled')) {
          showToast(
            'Akun Dinonaktifkan',
            'Akses akun ini sedang dibekukan. Hubungi Superadmin kampus.',
            'error'
          );
          return false;
        }

        showToast(
          'Login Gagal',
          'NIM / NIDN / ID Petugas atau kata sandi tidak sesuai. Silakan periksa kembali.',
          'error'
        );
        return false;
      }

      const profile = await fetchProfile(data.user.id);
      if (!profile) {
        await supabase.auth.signOut();
        showToast(
          'Profil Tidak Ditemukan',
          'Akun terautentikasi, namun data profil belum terdaftar. Hubungi admin kampus.',
          'error'
        );
        return false;
      }

      if (!profile.isActive) {
        await supabase.auth.signOut();
        showToast(
          'Akun Dinonaktifkan',
          'Akses akun ini sedang dibekukan. Hubungi Superadmin kampus.',
          'error'
        );
        return false;
      }

      currentUserRef.current = profile;
      lastActiveUserIdRef.current = profile.id;
      isFirstLoadRef.current = true;
      setCurrentUser(profile);
      await refreshData();

      if (profile.mustChangePassword || !profile.profileCompleted) {
        router.push('/akun/pengaturan');
        showToast(
          'Lengkapi Akun Anda',
          'Ganti kata sandi bawaan dan isi biodata sebelum menggunakan layanan.',
          'info'
        );
        return true;
      }

      if (redirectIntent) {
        const targetPath = redirectIntent.path || '/';
        if (redirectIntent.openClaim) {
          const matchedId =
            redirectIntent.itemId ?? targetPath.match(/^\/barang\/([^/?#]+)/)?.[1] ?? null;
          setPendingClaimItemId(matchedId);
        }
        setRedirectIntent(null);
        router.push(targetPath);
        showToast('Login Berhasil!', `Selamat datang, ${profile.name}.`);
        return true;
      }

      routeAfterAuth(profile.role);
      showToast('Login Berhasil!', `Selamat datang, ${profile.name} (${profile.roleLabel}).`);
      return true;
    },
    [fetchProfile, redirectIntent, refreshData, routeAfterAuth, router, showToast, supabase]
  );

  const refreshProfile = useCallback(async () => {
    try {
      await supabase.auth.refreshSession();
    } catch {
      // ignore
    }
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const profile = await fetchProfile(userData.user.id);

    if (profile && !profile.isActive) {
      await supabase.auth.signOut();
      setCurrentUser(null);
      showToast(
        'Akun Dinonaktifkan',
        'Akses akun ini sedang dibekukan. Hubungi Superadmin kampus.',
        'error'
      );
      return;
    }

    if (profile) setCurrentUser(profile);
  }, [supabase, fetchProfile, showToast]);

  const updateProfile = useCallback(
    async (input: {
      password?: string;
      name: string;
      identifier?: string;
      emailPersonal: string;
      phone: string;
      department: string;
      avatarUrl: string;
      ktmUrl?: string;
      ktmVerified?: boolean;
      skipKtmVerifiedUpdate?: boolean;
    }): Promise<boolean> => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        showToast('Sesi Berakhir', 'Silakan masuk kembali.', 'error');
        return false;
      }

      if (input.password) {
        const { error: passwordError } = await supabase.auth.updateUser({
          password: input.password,
        });
        if (passwordError) {
          showToast('Gagal Ganti Kata Sandi', passwordError.message, 'error');
          return false;
        }
      }

      const updateData: Record<string, unknown> = {
        name: input.name.trim(),
        email_personal: input.emailPersonal,
        phone: input.phone,
        department: input.department,
        avatar_url: input.avatarUrl,
        must_change_password: false,
        profile_completed: true,
        updated_at: new Date().toISOString(),
      };

      if (input.identifier && input.identifier !== '-') {
        updateData.identifier = input.identifier.trim();
      }
      if (!input.skipKtmVerifiedUpdate && input.ktmUrl !== undefined) {
        updateData.ktm_url = input.ktmUrl;
      }

      let { error: profileError } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', userData.user.id);

      if (profileError && profileError.message.includes('ktm_')) {
        delete updateData.ktm_url;
        const retry = await supabase
          .from('profiles')
          .update(updateData)
          .eq('id', userData.user.id);
        profileError = retry.error;
      }

      if (profileError) {
        showToast('Gagal Menyimpan Profil', profileError.message, 'error');
        return false;
      }

      if (!input.skipKtmVerifiedUpdate && input.ktmUrl !== undefined) {
        try {
          await supabase.auth.updateUser({
            data: { ktm_url: input.ktmUrl, ktm_rejected: false },
          });
        } catch (metaErr) {
          console.warn('updateUser metadata warning:', metaErr);
        }
      }

      await refreshProfile();
      showToast('Profil Tersimpan', 'Akun Anda kini lengkap dan siap digunakan.');
      return true;
    },
    [refreshProfile, showToast, supabase]
  );

  const logout = useCallback(() => {
    const currentPath = window.location.pathname;
    currentUserRef.current = null;
    lastActiveUserIdRef.current = null;
    isFirstLoadRef.current = true;
    setPendingClaimItemId(null);
    void clearStoredNotifications();
    supabase.auth.signOut().finally(async () => {
      setCurrentUser(null);
      await refreshData();
      if (PROTECTED_PATHS.some((path) => currentPath.startsWith(path))) {
        router.push('/');
      }
      showToast('Anda Telah Keluar', 'Sesi kampus berhasil diakhiri.', 'info');
    });
  }, [refreshData, router, showToast, supabase]);

  // ----- Aksi Bisnis: Lapor Barang -----
  const reportItem = useCallback(
    async (form: UploadFormState): Promise<string | null> => {
      if (!currentUser) return null;

      if (!form.title.trim()) {
        showToast('Data Belum Lengkap', 'Harap isi nama barang terlebih dahulu.', 'error');
        return null;
      }
      if (form.type === 'FOUND' && !form.secretQuestion.trim()) {
        showToast(
          'Pertanyaan Verifikasi Wajib',
          'Untuk barang temuan, wajib mengisi Pertanyaan Verifikasi Rahasia (Anti-False Claim).',
          'error'
        );
        return null;
      }

      const isReportedBySatpam = currentUser.role === 'SATPAM';
      let computedStatus: Item['status'] = 'Dicari';
      if (form.type === 'FOUND') {
        if (form.storageType === 'FINDER') {
          computedStatus = 'Di Penemu';
        } else {
          computedStatus = isReportedBySatpam ? 'Di Pos Satpam' : 'Menunggu Diserahkan ke Pos';
        }
      }

      const isSensitive =
        form.type === 'FOUND' &&
        (form.category === 'Identitas/KTM' || form.category === 'Dompet' || form.isSensitive);

      const newItemId = await insertItem(supabase, {
        form,
        status: computedStatus,
        isSensitive,
        visualTheme: CATEGORY_THEME_MAP[form.category] || 'tumbler',
        lockerCode: '-',
        reporter: {
          userId: currentUser.id,
          name: currentUser.name,
          roleLabel: currentUser.roleLabel,
          identifier: currentUser.identifier,
          phone: currentUser.phone,
        },
      });

      if (!newItemId) {
        showToast(
          'Gagal Menyimpan Laporan',
          'Laporan tidak dapat dikirim ke server. Periksa koneksi Anda lalu coba lagi.',
          'error'
        );
        return null;
      }

      await refreshData();
      broadcastSync();
      setFeedType(form.type);

      if (form.type === 'FOUND' && form.storageType === 'SATPAM') {
        sendBackgroundWebPush({
          title: 'Titipan Barang Baru',
          body: `Ada barang temuan "${form.title}" yang akan dititipkan di ${form.securityPost}.`,
          url: '/satpam?tab=TITIPAN',
          targetRole: 'SATPAM',
        });
      }

      showToast(
        'Laporan Berhasil Dipublikasikan!',
        form.type === 'FOUND' && form.storageType === 'SATPAM' && !isReportedBySatpam
          ? 'Silakan serahkan barang fisik ke ' + form.securityPost + '.'
          : 'Laporan tampil di beranda selama 30 hari, lalu dipindahkan ke riwayat Anda.'
      );

      return newItemId;
    },
    [broadcastSync, currentUser, refreshData, showToast, supabase]
  );

  // ----- Aksi Bisnis: Sunting Laporan Milik Sendiri -----
  const updateReport = useCallback(
    async (itemId: string, form: UploadFormState): Promise<boolean> => {
      const existing = items.find((item) => item.id === itemId);
      if (!existing || !currentUser) return false;

      const isStaff = currentUser.role === 'SATPAM' || currentUser.role === 'SUPERADMIN';
      if (existing.reporterUserId !== currentUser.id && !isStaff) {
        showToast('Tidak Diizinkan', 'Anda hanya dapat menyunting laporan milik sendiri.', 'error');
        return false;
      }

      if (!form.title.trim()) {
        showToast('Data Belum Lengkap', 'Harap isi nama barang terlebih dahulu.', 'error');
        return false;
      }

      if (existing.status === 'Selesai') {
        showToast('Laporan Terkunci', 'Laporan yang sudah selesai diserahkan tidak dapat disunting.', 'error');
        return false;
      }

      const isFound = existing.type === 'FOUND';
      if (isFound && !form.secretQuestion.trim()) {
        showToast(
          'Pertanyaan Verifikasi Wajib',
          'Untuk barang temuan, wajib mengisi Pertanyaan Verifikasi Rahasia (Anti-False Claim).',
          'error'
        );
        return false;
      }

      const isSensitive =
        isFound && (form.category === 'Identitas/KTM' || form.category === 'Dompet' || form.isSensitive);

      let nextStatus: Item['status'] | undefined;
      if (isFound && form.storageType !== existing.storageType) {
        if (form.storageType === 'FINDER') {
          nextStatus = 'Di Penemu';
        } else {
          nextStatus = currentUser.role === 'SATPAM' ? 'Di Pos Satpam' : 'Menunggu Diserahkan ke Pos';
        }
      }

      const saved = await updateItem(supabase, itemId, currentUser.id, {
        title: form.title,
        category: form.category,
        location: form.location,
        itemDate: form.datetime,
        description: form.description,
        isSensitive,
        storageType: isFound ? form.storageType : 'NONE',
        securityPost: isFound && form.storageType === 'SATPAM' ? form.securityPost : '-',
        ...(nextStatus ? { status: nextStatus } : {}),
        secretQuestion: isFound ? form.secretQuestion : '',
        secretAnswerHint: isFound ? form.secretAnswerHint || 'Sesuai ciri fisik barang' : '',
        visualTheme: CATEGORY_THEME_MAP[form.category] || existing.visualTheme,
        photoFile: form.photoFile,
      });

      if (!saved) {
        showToast(
          'Gagal Menyimpan Perubahan',
          'Perubahan laporan tidak tersimpan. Periksa koneksi Anda lalu coba lagi.',
          'error'
        );
        return false;
      }

      await refreshData();
      broadcastSync();
      showToast('Perubahan Tersimpan', `Laporan "${form.title}" berhasil diperbarui.`);
      return true;
    },
    [broadcastSync, currentUser, items, refreshData, showToast, supabase]
  );

  // ----- Aksi Bisnis: Hapus Laporan Milik Sendiri -----
  const deleteReport = useCallback(
    async (itemId: string): Promise<boolean> => {
      const existing = items.find((item) => item.id === itemId);
      if (!existing || !currentUser) return false;

      const isStaff = currentUser.role === 'SATPAM' || currentUser.role === 'SUPERADMIN';
      if (existing.reporterUserId !== currentUser.id && !isStaff) {
        showToast('Tidak Diizinkan', 'Anda hanya dapat menghapus laporan milik sendiri.', 'error');
        return false;
      }

      if (existing.status === 'Selesai' && currentUser.role !== 'SUPERADMIN') {
        showToast('Tidak Diizinkan', 'Laporan yang sudah selesai diserahkan tidak dapat dihapus.', 'error');
        return false;
      }

      const removed = await deleteItem(supabase, itemId, existing.photoUrl);
      if (!removed) {
        showToast(
          'Gagal Menghapus Laporan',
          'Laporan tidak dapat dihapus. Periksa koneksi Anda lalu coba lagi.',
          'error'
        );
        return false;
      }

      await refreshData();
      broadcastSync();
      showToast('Laporan Dihapus', 'Laporan berhasil dihapus dari daftar.');
      return true;
    },
    [broadcastSync, currentUser, items, refreshData, showToast, supabase]
  );

  // ----- Aksi Bisnis: Laporkan & Abaikan Spam (terhubung DB) -----
  const reportSpamItem = useCallback(
    async (itemId: string): Promise<boolean> => {
      if (!currentUser) return false;
      try {
        const res = await fetch(`/api/items/${itemId}/spam`, { method: 'POST' });
        const payload = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
        if (!res.ok) {
          showToast('Gagal Melaporkan', payload.error ?? 'Tidak dapat meneruskan laporan spam.', 'error');
          return false;
        }
        await refreshData();
        broadcastSync();
        showToast('Laporan Diteruskan', payload.message ?? 'Laporan ditandai untuk ditinjau Admin.');
        return true;
      } catch {
        showToast('Gagal Melaporkan', 'Tidak dapat menghubungi server.', 'error');
        return false;
      }
    },
    [broadcastSync, currentUser, refreshData, showToast]
  );

  const dismissSpamItem = useCallback(
    async (itemId: string): Promise<boolean> => {
      if (!currentUser || (currentUser.role !== 'SUPERADMIN' && currentUser.role !== 'SATPAM')) {
        return false;
      }
      try {
        const res = await fetch(`/api/items/${itemId}/spam`, { method: 'DELETE' });
        const payload = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
        if (!res.ok) {
          showToast('Aksi Gagal', payload.error ?? 'Gagal menghapus tanda spam.', 'error');
          return false;
        }
        await refreshData();
        broadcastSync();
        showToast('Laporan Spam Diabaikan', payload.message ?? 'Tanda spam dihapus.');
        return true;
      } catch {
        showToast('Aksi Gagal', 'Tidak dapat menghubungi server.', 'error');
        return false;
      }
    },
    [broadcastSync, currentUser, refreshData, showToast]
  );

  // ----- Aksi Bisnis: Ajukan Klaim -----
  const submitClaim = useCallback(
    async (item: Item, form: ClaimFormState): Promise<boolean> => {
      if (!currentUser) return false;

      if (!form.answer.trim()) {
        showToast(
          'Jawaban Wajib Diisi',
          'Harap jawab Pertanyaan Verifikasi Rahasia dari penemu.',
          'error'
        );
        return false;
      }

      const result = await insertClaim(supabase, {
        item,
        answer: form.answer,
        additionalNotes: form.additionalNotes,
        proofPhotoFile: form.proofPhotoFile,
        claimant: {
          userId: currentUser.id,
          name: currentUser.name,
          identifier: currentUser.identifier,
          roleLabel: currentUser.roleLabel,
          department: currentUser.department,
        },
      });

      if (!result.ok) {
        showToast(
          'Klaim Gagal Dikirim',
          result.error || 'Pengajuan klaim tidak tersimpan. Periksa koneksi Anda lalu coba lagi.',
          'error'
        );
        return false;
      }

      await refreshData();
      broadcastSync();

      if (item.storageType === 'FINDER') {
        sendBackgroundWebPush({
          title: 'Klaim Baru Masuk',
          body: `Seseorang mengajukan klaim atas barang temuan "${item.title}". Periksa dan verifikasi klaimnya.`,
          url: `/barang/${item.id}`,
          targetUserId: item.reporterUserId,
        });
      } else {
        sendBackgroundWebPush({
          title: 'Klaim Baru Masuk di Pos Satpam',
          body: `Pengajuan klaim baru untuk barang "${item.title}". Silakan periksa di dashboard verifikasi.`,
          url: `/barang/${item.id}`,
          targetRole: 'SATPAM',
        });
      }

      showToast(
        'Pengajuan Klaim Terkirim!',
        'Identitas & jawaban Anda sedang diverifikasi oleh Penemu / Petugas Satpam.'
      );
      return true;
    },
    [broadcastSync, currentUser, refreshData, showToast, supabase]
  );

  // ----- Aksi Bisnis: Kirim Laporan Penemuan untuk Barang Hilang (LOST) -----
  const submitFoundReport = useCallback(
    async (item: Item, form: FoundReportFormState): Promise<boolean> => {
      if (!currentUser) return false;

      if (!form.proofPhotoFile) {
        showToast(
          'Foto Bukti Wajib Diunggah',
          'Unggah foto fisik barang yang Anda temukan agar pemilik dapat memverifikasinya.',
          'error'
        );
        return false;
      }

      if (!form.foundLocation.trim()) {
        showToast(
          'Lokasi Ditemukan Wajib Diisi',
          'Tuliskan lokasi dan kondisi saat Anda menemukan barang tersebut.',
          'error'
        );
        return false;
      }

      const result = await insertFoundReport(supabase, {
        item,
        form,
        finder: {
          userId: currentUser.id,
          name: currentUser.name,
          identifier: currentUser.identifier,
          roleLabel: currentUser.roleLabel,
          department: currentUser.department,
          phone: currentUser.phone,
        },
      });

      if (!result.ok) {
        showToast(
          'Laporan Penemuan Gagal Dikirim',
          result.error || 'Terjadi kendala saat menyimpan laporan. Periksa koneksi Anda lalu coba lagi.',
          'error'
        );
        return false;
      }

      await refreshData();
      broadcastSync();

      sendBackgroundWebPush({
        title: 'Ada Kabar Temuan Barang Anda!',
        body: `${currentUser.name} melaporkan menemukan "${item.title}". Periksa foto bukti untuk mengonfirmasi.`,
        url: `/barang/${item.id}`,
        targetUserId: item.reporterUserId,
      });

      showToast(
        'Laporan Penemuan Terkirim!',
        'Pemilik barang akan meninjau foto bukti Anda. Kontak/tiket serah terima dibuka setelah pemilik mengonfirmasi.'
      );
      return true;
    },
    [broadcastSync, currentUser, refreshData, showToast, supabase]
  );

  // ----- Aksi Bisnis: Setujui / Tolak Klaim -----
  const decideClaim = useCallback(
    async (claimId: string, decision: ClaimStatus) => {
      if (!currentUser) return;
      const targetClaim = claims.find((c) => c.id === claimId);
      const targetItem = items.find((i) => i.id === targetClaim?.itemId);
      if (!targetClaim || !targetItem) {
        showToast('Klaim Tidak Ditemukan', 'Data klaim atau barang terkait tidak tersedia.', 'error');
        return;
      }

      const isStaff = currentUser.role === 'SATPAM' || currentUser.role === 'SUPERADMIN';
      if (targetItem.type === 'FOUND' && targetItem.storageType === 'SATPAM') {
        if (!isStaff) {
          showToast(
            'Akses Ditolak',
            'Klaim barang titipan Pos Satpam hanya dapat diputuskan oleh petugas.',
            'error'
          );
          return;
        }
      } else if (targetItem.reporterUserId !== currentUser.id && currentUser.role !== 'SUPERADMIN') {
        showToast(
          'Akses Ditolak',
          'Hanya pelapor barang terkait yang dapat memutuskan pengajuan ini.',
          'error'
        );
        return;
      }

      if (
        decision === 'APPROVED' &&
        claims.some((c) => c.itemId === targetClaim.itemId && c.id !== claimId && c.status === 'APPROVED')
      ) {
        showToast(
          'Sudah Ada Klaim Disetujui',
          'Barang ini sudah memiliki pengajuan yang disetujui. Selesaikan atau tolak pengajuan tersebut lebih dulu.',
          'error'
        );
        return;
      }

      const generateUniqueTicket = () => {
        const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        const existingCodes = new Set(claims.map((c) => c.ticketCode).filter(Boolean));
        for (let attempt = 0; attempt < 8; attempt += 1) {
          const bytes = new Uint8Array(6);
          window.crypto.getRandomValues(bytes);
          const suffix = Array.from(bytes, (b) => charset[b % charset.length]).join('');
          const candidate = `#KLAIM-${suffix}`;
          if (!existingCodes.has(candidate)) return candidate;
        }
        return `#KLAIM-${Date.now().toString(36).slice(-6).toUpperCase()}`;
      };

      const generatedTicket = decision === 'APPROVED' ? generateUniqueTicket() : null;

      const saved = await updateClaimDecision(supabase, claimId, decision, generatedTicket);
      if (!saved) {
        showToast(
          'Gagal Memperbarui Klaim',
          'Keputusan klaim tidak tersimpan. Periksa koneksi Anda lalu coba lagi.',
          'error'
        );
        return;
      }

      await refreshData();
      broadcastSync();

      if (decision === 'APPROVED') {
        sendBackgroundWebPush({
          title: 'Klaim Disetujui!',
          body: `Klaim Anda untuk barang "${targetClaim.itemTitle}" telah disetujui. QR Code dan kode tiket pengambilan Anda sudah terbit.`,
          url: '/klaim',
          targetUserId: targetClaim.claimantUserId,
        });
      } else if (decision === 'REJECTED') {
        sendBackgroundWebPush({
          title: 'Klaim Ditolak',
          body: `Klaim Anda untuk barang "${targetClaim.itemTitle}" tidak disetujui oleh petugas.`,
          url: '/klaim',
          targetUserId: targetClaim.claimantUserId,
        });
      }

      if (decision === 'APPROVED') {
        showToast(
          'Klaim Disetujui!',
          `Kode Tiket ${generatedTicket} / Kontak terkait telah dibuka.`
        );
      } else {
        showToast(
          'Klaim Ditolak',
          'Pengajuan klaim ditolak dan dicatat ke log pengawasan Anti-False Claim.',
          'error'
        );
      }
    },
    [broadcastSync, claims, currentUser, items, refreshData, showToast, supabase]
  );

  // ----- Aksi Bisnis: Kirim Pengaduan -----
  const submitComplaint = useCallback(
    async (form: ComplaintFormState): Promise<boolean> => {
      if (!currentUser) {
        showToast(
          'Sesi Berakhir',
          'Silakan masuk kembali sebelum mengirim pengaduan.',
          'error'
        );
        return false;
      }

      if (!form.category) {
        showToast('Kategori Wajib Dipilih', 'Pilih kategori yang paling sesuai.', 'error');
        return false;
      }

      const incident = new Date(`${form.incidentDate}T00:00:00`);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (!form.incidentDate || Number.isNaN(incident.getTime())) {
        showToast('Tanggal Wajib Diisi', 'Pilih tanggal kejadian pengaduan.', 'error');
        return false;
      }
      if (incident.getTime() > today.getTime()) {
        showToast(
          'Tanggal Tidak Valid',
          'Tanggal kejadian tidak boleh melewati hari ini.',
          'error'
        );
        return false;
      }

      const description = form.description.trim();
      if (description.length < COMPLAINT_DESCRIPTION_MIN) {
        showToast(
          'Deskripsi Terlalu Pendek',
          `Jelaskan kejadian minimal ${COMPLAINT_DESCRIPTION_MIN} karakter agar petugas memahami masalahnya.`,
          'error'
        );
        return false;
      }

      const saved = await insertComplaint(supabase, {
        form: { ...form, description },
        reporter: {
          userId: currentUser.id,
          name: currentUser.name,
          identifier: currentUser.identifier,
        },
      });

      if (!saved) {
        showToast(
          'Pengaduan Gagal Dikirim',
          'Laporan tidak tersimpan. Periksa koneksi Anda lalu coba lagi.',
          'error'
        );
        return false;
      }

      await refreshData();
      broadcastSync();
      showToast(
        'Pengaduan Terkirim',
        'Laporan Anda masuk ke antrean Admin dan Satpam.'
      );
      return true;
    },
    [broadcastSync, currentUser, refreshData, showToast, supabase]
  );

  // ----- Aksi Bisnis: Ubah Status Pengaduan (Admin/Satpam) -----
  const setComplaintStatus = useCallback(
    async (complaintId: string, status: ComplaintStatus): Promise<boolean> => {
      if (
        !currentUser ||
        (currentUser.role !== 'SUPERADMIN' && currentUser.role !== 'SATPAM')
      ) {
        showToast(
          'Akses Ditolak',
          'Hanya Admin dan Satpam yang dapat mengubah status pengaduan.',
          'error'
        );
        return false;
      }

      const saved = await updateComplaintStatusQuery(supabase, complaintId, status);
      if (!saved) {
        showToast(
          'Status Gagal Disimpan',
          'Perubahan status tidak tersimpan. Periksa koneksi Anda lalu coba lagi.',
          'error'
        );
        return false;
      }

      await refreshData();
      broadcastSync();
      showToast('Status Diperbarui', `Pengaduan kini berstatus "${status}".`);
      return true;
    },
    [broadcastSync, currentUser, refreshData, showToast, supabase]
  );

  // ----- Aksi Bisnis: Sensor / Buka Sensor Barang (Admin & Satpam) -----
  const setItemSensitivity = useCallback(
    async (itemId: string, isSensitive: boolean): Promise<boolean> => {
      if (
        !currentUser ||
        (currentUser.role !== 'SUPERADMIN' && currentUser.role !== 'SATPAM')
      ) {
        showToast(
          'Akses Ditolak',
          'Hanya Admin dan Satpam yang dapat mengubah sensor barang.',
          'error'
        );
        return false;
      }

      const saved = await updateItemSensitivity(supabase, itemId, isSensitive);
      if (!saved) {
        showToast(
          'Gagal Menyimpan Sensor',
          'Perubahan sensor tidak tersimpan. Periksa koneksi Anda lalu coba lagi.',
          'error'
        );
        return false;
      }

      await refreshData();
      broadcastSync();
      showToast(
        isSensitive ? 'Barang Disensor' : 'Sensor Dibuka',
        isSensitive
          ? 'Foto barang disembunyikan dari tampilan publik.'
          : 'Foto barang kembali tampil untuk publik.'
      );
      return true;
    },
    [broadcastSync, currentUser, refreshData, showToast, supabase]
  );

  // ----- Aksi Bisnis: Satpam Konfirmasi Titipan -----
  const confirmTitipanSatpam = useCallback(
    async (itemId: string) => {
      if (currentUser?.role !== 'SATPAM' && currentUser?.role !== 'SUPERADMIN') {
        showToast('Akses Ditolak', 'Hanya petugas Satpam yang dapat menerima titipan pos.', 'error');
        return;
      }

      const saved = await updateItemStatus(supabase, itemId, {
        status: 'Di Pos Satpam',
        lockerCode: '-',
      });

      if (!saved) {
        showToast(
          'Gagal Memperbarui Barang',
          'Konfirmasi titipan tidak tersimpan. Periksa koneksi Anda lalu coba lagi.',
          'error'
        );
        return;
      }

      await refreshData();
      broadcastSync();
      showToast(
        'Barang Diterima di Pos!',
        'Status barang kini "Di Pos Satpam" dan siap diserahterimakan saat ada klaim valid.'
      );
    },
    [broadcastSync, currentUser, refreshData, showToast, supabase]
  );

  // ----- Aksi Bisnis: Serah Terima Fisik -----
  const completeHandover = useCallback(
    async (form: HandoverFormState): Promise<boolean> => {
      if (currentUser?.role !== 'SATPAM' && currentUser?.role !== 'SUPERADMIN') {
        showToast('Akses Ditolak', 'Hanya petugas Satpam yang dapat menyelesaikan serah terima pos.', 'error');
        return false;
      }

      const matchedClaim = claims.find(
        (c) =>
          c.ticketCode?.toUpperCase() === form.ticketCode.trim().toUpperCase() &&
          c.status === 'APPROVED' &&
          c.storageType === 'SATPAM'
      );

      if (!matchedClaim) {
        showToast(
          'Kode Tiket Tidak Ditemukan',
          'Pastikan kode tiket klaim Pos Satpam sesuai dan berstatus Disetujui.',
          'error'
        );
        return false;
      }

      const matchedItem = items.find((i) => i.id === matchedClaim.itemId);
      if (!form.ktmVerified) {
        showToast('Verifikasi KTM Wajib', 'Harap centang ceklis kesesuaian KTM fisik pengambil.', 'error');
        return false;
      }
      if (!form.photoFile) {
        showToast('Foto Serah Terima Wajib', 'Harap unggah foto dokumentasi serah terima barang.', 'error');
        return false;
      }

      const extension = form.photoFile.name.split('.').pop()?.toLowerCase() ?? 'jpg';
      const photoPath = `satpam/${matchedClaim.itemId}/${Date.now()}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from('handover')
        .upload(photoPath, form.photoFile, { upsert: true, cacheControl: '3600' });

      if (uploadError) {
        showToast('Gagal Mengunggah Foto', uploadError.message, 'error');
        return false;
      }
      const photoUrl = supabase.storage.from('handover').getPublicUrl(photoPath).data.publicUrl;

      const isLostItem = matchedItem?.type === 'LOST';
      const recipientDisplay = isLostItem
        ? `${matchedItem.reporterName} (${matchedItem.reporterId})`
        : `${matchedClaim.claimantName} (${matchedClaim.claimantId})`;

      const saved = await updateItemStatus(supabase, matchedClaim.itemId, {
        status: 'Selesai',
        handoverInfo: buildHandoverInfo(
          matchedClaim,
          form,
          currentUser?.name || 'Petugas Satpam',
          photoUrl,
          recipientDisplay
        ),
      });

      if (!saved) {
        await supabase.storage.from('handover').remove([photoPath]).catch(() => undefined);
        showToast(
          'Gagal Menyimpan Serah Terima',
          'Data serah terima tidak tersimpan. Periksa koneksi Anda lalu coba lagi.',
          'error'
        );
        return false;
      }

      const { error: claimUpdateErr } = await supabase
        .from('claims')
        .update({ status: 'SELESAI' })
        .eq('id', matchedClaim.id);

      if (claimUpdateErr) {
        console.error('completeHandover claim status warning:', claimUpdateErr.message);
      }

      await refreshData();
      broadcastSync();

      sendBackgroundWebPush({
        title: 'Serah Terima Selesai',
        body: `Barang "${matchedClaim.itemTitle}" telah resmi diserahkan melalui Pos Satpam.`,
        url: '/klaim',
        targetUserId: isLostItem && matchedItem ? matchedItem.reporterUserId : matchedClaim.claimantUserId,
      });

      showToast(
        'Serah Terima Selesai!',
        `Barang "${matchedClaim.itemTitle}" resmi diserahkan kepada ${recipientDisplay}.`
      );
      return true;
    },
    [broadcastSync, claims, currentUser, items, refreshData, showToast, supabase]
  );

  // ----- Aksi Bisnis: Penyerahan Langsung oleh Penemu / Penerimaan Pemilik -----
  const completeFinderHandover = useCallback(
    async (claimId: string, photoFile: File | null) => {
      const claim = claims.find((c) => c.id === claimId);
      const item = items.find((i) => i.id === claim?.itemId);
      if (!claim || !item || !currentUser) return;

      if (item.reporterUserId !== currentUser.id) {
        showToast('Akses Ditolak', 'Hanya pelapor barang yang dapat melakukan tindakan ini.', 'error');
        return;
      }
      if (item.type === 'FOUND' && item.storageType !== 'FINDER') {
        showToast(
          'Tidak Berlaku',
          'Barang yang tersimpan di Pos Satpam wajib diserahterimakan lewat form Satpam (tab Serah Terima).',
          'error'
        );
        return;
      }
      if (claim.status !== 'APPROVED') {
        showToast(
          item.type === 'LOST' ? 'Laporan Belum Dikonfirmasi' : 'Klaim Belum Disetujui',
          item.type === 'LOST'
            ? 'Konfirmasi laporan penemuan terlebih dahulu sebelum menyatakan barang sudah diterima.'
            : 'Setujui klaim terlebih dahulu sebelum menyatakan barang sudah diserahkan.',
          'error'
        );
        return;
      }
      if (!photoFile) {
        showToast(
          'Foto Dokumentasi Wajib',
          'Harap unggah foto dokumentasi serah terima sebelum menyelesaikan laporan.',
          'error'
        );
        return;
      }

      const confirmText =
        item.type === 'LOST'
          ? `Konfirmasi Penerimaan Barang:\n\n` +
            `Barang "${item.title}" sudah Anda terima kembali dari ${claim.claimantName} (${claim.claimantId})?\n\n` +
            `Status laporan akan diubah menjadi "Selesai" dan diarsipkan. Tindakan ini tidak dapat dibatalkan.`
          : `Konfirmasi Serah Terima:\n\n` +
            `Barang "${item.title}" sudah diserahkan langsung kepada ${claim.claimantName} (${claim.claimantId})?\n\n` +
            `Status laporan akan diubah menjadi "Selesai" dan diarsipkan. Tindakan ini tidak dapat dibatalkan.`;

      const confirmed = window.confirm(confirmText);
      if (!confirmed) return;

      const extension = photoFile.name.split('.').pop()?.toLowerCase() ?? 'jpg';
      const photoPath = `finder/${item.id}/${Date.now()}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from('handover')
        .upload(photoPath, photoFile, { upsert: true, cacheControl: '3600' });

      if (uploadError) {
        showToast('Gagal Mengunggah Foto', uploadError.message, 'error');
        return;
      }
      const photoUrl = supabase.storage.from('handover').getPublicUrl(photoPath).data.publicUrl;

      const handoverInfo: HandoverInfo = {
        claimedBy:
          item.type === 'LOST'
            ? `${currentUser.name} (${currentUser.identifier})`
            : `${claim.claimantName} (${claim.claimantId})`,
        ticketCode: claim.ticketCode ?? '-',
        handoverTime: new Date().toLocaleString('id-ID', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
        verifiedBy:
          item.type === 'LOST'
            ? `${currentUser.name} (Pemilik)`
            : `${currentUser.name} (Penemu)`,
        photoUrl,
      };

      const saved = await updateItemStatus(supabase, item.id, {
        status: 'Selesai',
        handoverInfo,
      });

      if (!saved) {
        await supabase.storage.from('handover').remove([photoPath]).catch(() => undefined);
        showToast(
          'Gagal Menyelesaikan Laporan',
          'Perubahan status tidak tersimpan. Periksa koneksi Anda lalu coba lagi.',
          'error'
        );
        return;
      }

      const { error: claimUpdateErr } = await supabase
        .from('claims')
        .update({ status: 'SELESAI' })
        .eq('id', claim.id);

      if (claimUpdateErr) {
        console.error('completeFinderHandover claim status warning:', claimUpdateErr.message);
      }

      await refreshData();
      broadcastSync();

      sendBackgroundWebPush({
        title: 'Serah Terima Selesai',
        body: `Barang "${item.title}" telah selesai diserahterimakan.`,
        url: '/klaim',
        targetUserId: claim.claimantUserId,
      });

      showToast(
        'Laporan Diselesaikan!',
        item.type === 'LOST'
          ? `Barang "${item.title}" telah dikonfirmasi diterima kembali dari ${claim.claimantName}.`
          : `Barang "${item.title}" telah diserahkan langsung kepada ${claim.claimantName}.`
      );
    },
    [broadcastSync, claims, items, currentUser, refreshData, showToast, supabase]
  );

  const myReportedItems = useMemo(() => {
    if (!currentUser) return [];
    return items.filter((item) => item.reporterUserId === currentUser.id);
  }, [currentUser, items]);

  const myClaims = useMemo(() => {
    if (!currentUser) return [];
    return claims.filter((claim) => claim.claimantUserId === currentUser.id);
  }, [currentUser, claims]);

  const myComplaints = useMemo(() => {
    if (!currentUser) return [];
    return complaints.filter((complaint) => complaint.reporterId === currentUser.id);
  }, [currentUser, complaints]);

  const value = useMemo<AppContextValue>(
    () => ({
      currentUser,
      authLoading,
      signIn,
      refreshProfile,
      updateProfile,
      logout,
      loginGate,
      openLoginGate,
      closeLoginGate,
      confirmLoginGate,
      redirectIntent,
      pendingClaimItemId,
      clearPendingClaim,
      dataLoading,
      dataError,
      refreshData,
      items,
      claims,
      myReportedItems,
      myClaims,
      locations,
      categories,
      addLocation,
      removeLocation,
      addCategory,
      removeCategory,
      complaints,
      myComplaints,
      complaintsError,
      submitComplaint,
      setComplaintStatus,
      feedType,
      setFeedType,
      feedSearch,
      setFeedSearch,
      toast,
      showToast,
      dismissToast,
      reportItem,
      updateReport,
      deleteReport,
      reportSpamItem,
      dismissSpamItem,
      submitClaim,
      submitFoundReport,
      decideClaim,
      setItemSensitivity,
      confirmTitipanSatpam,
      completeHandover,
      completeFinderHandover,
    }),
    [
      currentUser,
      authLoading,
      signIn,
      refreshProfile,
      updateProfile,
      logout,
      loginGate,
      openLoginGate,
      closeLoginGate,
      confirmLoginGate,
      redirectIntent,
      pendingClaimItemId,
      clearPendingClaim,
      dataLoading,
      dataError,
      refreshData,
      items,
      claims,
      myReportedItems,
      myClaims,
      locations,
      categories,
      addLocation,
      removeLocation,
      addCategory,
      removeCategory,
      complaints,
      myComplaints,
      complaintsError,
      submitComplaint,
      setComplaintStatus,
      feedType,
      feedSearch,
      toast,
      showToast,
      dismissToast,
      reportItem,
      updateReport,
      deleteReport,
      reportSpamItem,
      dismissSpamItem,
      submitClaim,
      submitFoundReport,
      decideClaim,
      setItemSensitivity,
      confirmTitipanSatpam,
      completeHandover,
      completeFinderHandover,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useApp harus dipakai di dalam <AppProvider>.');
  }
  return ctx;
}
