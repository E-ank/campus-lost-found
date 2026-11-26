'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  Camera,
  Check,
  CheckCircle2,
  CloudOff,
  ExternalLink,
  Eye,
  FileUp,
  GraduationCap,
  Loader2,
  Phone,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Tag,
  Trash2,
  UserCog,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import ComplaintQueue from '@/components/ui/ComplaintQueue';
import ReportQueue from '@/components/ui/ReportQueue';
import { DEFAULT_ACCOUNT_PASSWORD } from '@/lib/accounts';
import { ROLE_LABELS, USER_ROLES } from '@/lib/roles';
import { createClient } from '@/lib/supabase/client';
import { fetchRegisteredAccounts } from '@/lib/supabase/queries';
import { whatsAppHref } from '@/lib/whatsapp';
import type { BulkAccountRow, RegisteredAccount, UserRole } from '@/types';

function accountRoleBadgeClass(role: UserRole): string {
  switch (role) {
    case 'SUPERADMIN':
      return 'bg-purple-100 text-purple-900';
    case 'SATPAM':
      return 'bg-emerald-100 text-emerald-900';
    case 'DOSEN':
      return 'bg-blue-100 text-blue-900';
    default:
      return 'bg-slate-100 text-slate-800';
  }
}

export default function AdminDashboardView() {
  const {
    currentUser,
    items,
    locations,
    addLocation,
    removeLocation,
    categories,
    addCategory,
    removeCategory,
    claims,
    complaints,
    dataError,
    refreshData,
    dismissSpamItem,
    showToast,
  } = useApp();

  const [adminSubTab, setAdminSubTab] = useState<
    'MASTER' | 'VERIFIKASI_KTM' | 'AKUN' | 'IMPOR' | 'LAPORAN' | 'MODERASI' | 'DOKUMEN' | 'PENGADUAN'
  >('MASTER');
  const [newLocationName, setNewLocationName] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [masterBusy, setMasterBusy] = useState<'LOCATION' | 'CATEGORY' | null>(null);
  const doneHandoverItems = items.filter((i) => i.status === 'Selesai');

  const supabase = useMemo(() => createClient(), []);
  const [accounts, setAccounts] = useState<RegisteredAccount[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [accountsError, setAccountsError] = useState(false);
  const [accountSearch, setAccountSearch] = useState('');
  const [accountRole, setAccountRole] = useState<'SEMUA' | UserRole>('SEMUA');
  const [accountStatus, setAccountStatus] = useState<'SEMUA' | 'AKTIF' | 'NONAKTIF'>('SEMUA');
  const [managingId, setManagingId] = useState<string | null>(null);
  const [roleDraft, setRoleDraft] = useState<UserRole>('MAHASISWA');
  const [accountBusy, setAccountBusy] = useState<string | null>(null);
  const [spamBusyId, setSpamBusyId] = useState<string | null>(null);

  const [ktmStatusFilter, setKtmStatusFilter] = useState<'PENDING' | 'VERIFIED' | 'SEMUA'>('PENDING');
  const [ktmSearch, setKtmSearch] = useState('');
  const [viewingKtmAccount, setViewingKtmAccount] = useState<RegisteredAccount | null>(null);

  const loadAccounts = useCallback(
    async (silent = false) => {
      if (!silent) setAccountsLoading(true);
      try {
        const rows = await fetchRegisteredAccounts(supabase);
        setAccounts(rows);
        setAccountsError(false);
      } catch (err) {
        console.error('Failed to load accounts:', err);
        setAccountsError(true);
      } finally {
        setAccountsLoading(false);
      }
    },
    [supabase]
  );

  useEffect(() => {
    let active = true;
    fetchRegisteredAccounts(supabase)
      .then((rows) => {
        if (active) {
          setAccounts(rows);
          setAccountsError(false);
        }
      })
      .catch((err) => {
        console.error('Failed to load accounts:', err);
        if (active) setAccountsError(true);
      })
      .finally(() => {
        if (active) setAccountsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [supabase]);

  useEffect(() => {
    if (!viewingKtmAccount) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setViewingKtmAccount(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewingKtmAccount]);

  const ktmPendingCount = useMemo(
    () => accounts.filter((a) => a.ktmUrl && !a.ktmVerified).length,
    [accounts]
  );
  const ktmApprovedCount = useMemo(
    () => accounts.filter((a) => a.ktmUrl && a.ktmVerified).length,
    [accounts]
  );
  const totalKtmCount = useMemo(
    () => accounts.filter((a) => Boolean(a.ktmUrl)).length,
    [accounts]
  );

  const ktmFilteredSubmissions = useMemo(() => {
    const query = ktmSearch.trim().toLowerCase();
    return accounts
      .filter((account) => Boolean(account.ktmUrl))
      .filter((account) => {
        if (ktmStatusFilter === 'PENDING') return !account.ktmVerified;
        if (ktmStatusFilter === 'VERIFIED') return Boolean(account.ktmVerified);
        return true;
      })
      .filter((account) => {
        if (!query) return true;
        return [account.name, account.identifier, account.department, account.emailPersonal, account.phone]
          .join(' ')
          .toLowerCase()
          .includes(query);
      });
  }, [accounts, ktmSearch, ktmStatusFilter]);

  const filteredAccounts = useMemo(() => {
    const query = accountSearch.trim().toLowerCase();
    return accounts.filter((account) => {
      const matchesRole = accountRole === 'SEMUA' || account.role === accountRole;
      const matchesStatus =
        accountStatus === 'SEMUA' ||
        (accountStatus === 'AKTIF' ? account.isActive : !account.isActive);
      const matchesQuery =
        query.length === 0 ||
        [account.name, account.identifier, account.department, account.emailPersonal, account.phone]
          .join(' ')
          .toLowerCase()
          .includes(query);
      return matchesRole && matchesStatus && matchesQuery;
    });
  }, [accountRole, accountSearch, accountStatus, accounts]);

  // Data moderasi nyata dari klaim ditolak berulang & laporan spam di database.
  const suspiciousAccounts = useMemo(() => {
    const grouped = new Map<
      string,
      {
        userId: string;
        name: string;
        identifier: string;
        department: string;
        rejectedCount: number;
        lastItemTitle: string;
        isActive: boolean;
      }
    >();

    for (const clm of claims) {
      if (clm.status !== 'REJECTED') continue;
      const existing = grouped.get(clm.claimantUserId);
      const matchedAccount = accounts.find((a) => a.id === clm.claimantUserId);
      if (existing) {
        existing.rejectedCount += 1;
      } else {
        grouped.set(clm.claimantUserId, {
          userId: clm.claimantUserId,
          name: matchedAccount?.name || clm.claimantName,
          identifier: matchedAccount?.identifier || clm.claimantId,
          department: matchedAccount?.department || clm.claimantDept,
          rejectedCount: 1,
          lastItemTitle: clm.itemTitle,
          isActive: matchedAccount ? matchedAccount.isActive : true,
        });
      }
    }

    return Array.from(grouped.values())
      .filter((entry) => entry.rejectedCount >= 2)
      .sort((a, b) => b.rejectedCount - a.rejectedCount);
  }, [accounts, claims]);

  const spamItems = useMemo(
    () => items.filter((item) => item.isSpamReported),
    [items]
  );

  const toggleAccountPanel = (account: RegisteredAccount) => {
    if (managingId === account.id) {
      setManagingId(null);
      return;
    }
    setManagingId(account.id);
    setRoleDraft(account.role);
  };

  const patchAccount = useCallback(
    async (id: string, body: Record<string, unknown>, busyKey: string, title: string) => {
      setAccountBusy(busyKey);
      try {
        const response = await fetch(`/api/admin/accounts/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
          message?: string;
        };

        if (!response.ok) {
          showToast(
            'Aksi Gagal',
            payload.error ?? 'Terjadi kesalahan pada server.',
            'error'
          );
          return false;
        }

        showToast(title, payload.message ?? 'Perubahan tersimpan.');
        await loadAccounts(true);
        return true;
      } catch {
        showToast('Aksi Gagal', 'Tidak dapat menghubungi server.', 'error');
        return false;
      } finally {
        setAccountBusy(null);
      }
    },
    [loadAccounts, showToast]
  );

  const handleRoleSave = async (account: RegisteredAccount) => {
    if (roleDraft === account.role || accountBusy !== null) return;
    await patchAccount(
      account.id,
      { action: 'role', role: roleDraft },
      `${account.id}:role`,
      'Peran Diperbarui'
    );
  };

  const handleResetPassword = async (account: RegisteredAccount) => {
    if (accountBusy !== null) return;
    const confirmed = window.confirm(
      `Reset kata sandi ${account.name} (${account.identifier}) menjadi ${DEFAULT_ACCOUNT_PASSWORD}? Pengguna wajib menggantinya saat login.`
    );
    if (!confirmed) return;

    await patchAccount(
      account.id,
      { action: 'reset-password' },
      `${account.id}:reset`,
      'Kata Sandi Direset'
    );
  };

  const handleAccountStatus = async (account: RegisteredAccount) => {
    if (accountBusy !== null) return;
    const nextActive = !account.isActive;
    const confirmed = window.confirm(
      nextActive
        ? `Aktifkan kembali akun ${account.name} (${account.identifier})?`
        : `Nonaktifkan akun ${account.name} (${account.identifier})? Pengguna tidak dapat login sampai akun diaktifkan lagi.`
    );
    if (!confirmed) return;

    await patchAccount(
      account.id,
      { action: 'status', isActive: nextActive },
      `${account.id}:status`,
      nextActive ? 'Akun Diaktifkan' : 'Akun Dinonaktifkan'
    );
  };

  const handleVerifyKtm = async (
    account: RegisteredAccount,
    approved: boolean,
    clearDocument = false
  ) => {
    if (accountBusy !== null) return;
    if (clearDocument) {
      const ok = window.confirm(
        `Tolak berkas KTM milik ${account.name} (${account.identifier}) dan keluarkan dari antrean? Mahasiswa harus mengunggah ulang foto yang jelas.`
      );
      if (!ok) return;
    } else if (!approved) {
      const ok = window.confirm(
        `Batalkan status verifikasi KTM milik ${account.name} (${account.identifier}) dan kembalikan ke antrean tinjau?`
      );
      if (!ok) return;
    }

    const success = await patchAccount(
      account.id,
      { action: 'verify-ktm', approved, clearDocument },
      `${account.id}:ktm`,
      approved ? 'KTM Disetujui' : clearDocument ? 'KTM Ditolak' : 'Verifikasi Dibatalkan'
    );
    if (success) {
      setAccounts((prev) =>
        prev.map((acc) =>
          acc.id === account.id
            ? {
                ...acc,
                ktmVerified: approved,
                ktmUrl: clearDocument ? null : acc.ktmUrl,
                profileCompleted: approved ? true : acc.profileCompleted,
              }
            : acc
        )
      );
      if (viewingKtmAccount?.id === account.id) {
        if (clearDocument) {
          setViewingKtmAccount(null);
        } else {
          setViewingKtmAccount((prev) => (prev ? { ...prev, ktmVerified: approved } : null));
        }
      }
    }
  };

  const handleDeleteSpamItem = async (itemId: string, title: string) => {
    if (spamBusyId) return;
    const confirmed = window.confirm(
      `Hapus laporan spam "${title}" beserta klaim dan fotonya secara permanen?`
    );
    if (!confirmed) return;

    setSpamBusyId(itemId);
    try {
      const response = await fetch(`/api/admin/items/${itemId}`, { method: 'DELETE' });
      const payload = (await response.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!response.ok) {
        showToast('Gagal Menghapus', payload.error ?? 'Terjadi kesalahan pada server.', 'error');
        return;
      }
      showToast('Laporan Dihapus', payload.message ?? 'Laporan spam berhasil dihapus.');
      await refreshData();
    } catch {
      showToast('Gagal Menghapus', 'Tidak dapat menghubungi server.', 'error');
    } finally {
      setSpamBusyId(null);
    }
  };

  const handleDismissSpam = async (itemId: string) => {
    if (spamBusyId) return;
    setSpamBusyId(itemId);
    try {
      await dismissSpamItem(itemId);
    } finally {
      setSpamBusyId(null);
    }
  };

  const handleAddLocation = async () => {
    const name = newLocationName.trim();
    if (!name || masterBusy) return;

    setMasterBusy('LOCATION');
    const saved = await addLocation(name);
    setMasterBusy(null);
    if (saved) setNewLocationName('');
  };

  const handleRemoveLocation = async (name: string) => {
    if (masterBusy) return;
    const confirmed = window.confirm(
      `Hapus lokasi "${name}" dari daftar pilihan baru? Laporan lama tetap menyimpan nama lokasi ini.`
    );
    if (!confirmed) return;
    setMasterBusy('LOCATION');
    await removeLocation(name);
    setMasterBusy(null);
  };

  const handleAddCategory = async () => {
    const name = newCategoryName.trim();
    if (!name || masterBusy) return;

    setMasterBusy('CATEGORY');
    const saved = await addCategory(name);
    setMasterBusy(null);
    if (saved) setNewCategoryName('');
  };

  const handleRemoveCategory = async (name: string) => {
    if (masterBusy) return;
    const confirmed = window.confirm(
      `Hapus kategori "${name}" dari daftar pilihan baru? Laporan lama tetap menyimpan nama kategori ini.`
    );
    if (!confirmed) return;
    setMasterBusy('CATEGORY');
    await removeCategory(name);
    setMasterBusy(null);
  };

  const [bulkInput, setBulkInput] = useState('');
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [bulkResult, setBulkResult] = useState<{
    created: string[];
    failed: { identifier: string; reason: string }[];
    defaultPassword: string;
  } | null>(null);

  const handleBulkImport = async () => {
    const rows: BulkAccountRow[] = bulkInput
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => {
        const [identifier = '', name = '', department = ''] = line
          .split(',')
          .map((part) => part.trim());
        return { identifier, name, department };
      })
      .filter((row) => row.identifier && row.name);

    if (rows.length === 0) {
      showToast(
        'Data Belum Valid',
        'Gunakan format NIM,Nama,Prodi pada setiap baris.',
        'error'
      );
      return;
    }

    setBulkSubmitting(true);
    setBulkResult(null);

    try {
      const response = await fetch('/api/admin/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
      });
      const payload = await response.json();

      if (!response.ok) {
        showToast('Impor Gagal', payload.error ?? 'Terjadi kesalahan pada server.', 'error');
        return;
      }

      setBulkResult(payload);
      setBulkInput('');
      void loadAccounts();
      showToast(
        'Impor Selesai',
        `${payload.created.length} akun berhasil dibuat, ${payload.failed.length} gagal.`,
        payload.failed.length > 0 ? 'info' : 'success'
      );
    } catch {
      showToast('Impor Gagal', 'Tidak dapat menghubungi server.', 'error');
    } finally {
      setBulkSubmitting(false);
    }
  };

  return (
    <div className="flex-1 p-4 lg:p-8 space-y-6 lg:mx-auto lg:max-w-[1240px]">
      {/* Header & Ringkasan Statistik (warna solid purple-900 sesuai rasio AA) */}
      <div className="bg-purple-900 rounded-3xl p-6 lg:p-8 text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="max-w-md">
            <h2 className="text-xl lg:text-2xl font-black tracking-tight">Panel Admin</h2>
          </div>

          <div className="grid grid-cols-3 gap-3 shrink-0">
            <div className="bg-purple-950/60 rounded-2xl p-4 border border-purple-700/60 min-w-[95px] lg:min-w-[140px]">
              <p className="text-[10px] font-bold text-purple-200 uppercase tracking-widest">
                Total laporan
              </p>
              <p className="text-2xl lg:text-3xl font-black mt-1 text-white">{items.length}</p>
            </div>
            <div className="bg-purple-950/60 rounded-2xl p-4 border border-purple-700/60 min-w-[95px] lg:min-w-[140px]">
              <p className="text-[10px] font-bold text-emerald-200 uppercase tracking-widest">
                Barang kembali
              </p>
              <p className="text-2xl lg:text-3xl font-black mt-1 text-emerald-300">
                {items.filter((i) => i.status === 'Selesai').length}
              </p>
            </div>
            <div className="bg-purple-950/60 rounded-2xl p-4 border border-purple-700/60 min-w-[95px] lg:min-w-[140px]">
              <p className="text-[10px] font-bold text-rose-200 uppercase tracking-widest">
                Klaim ditolak
              </p>
              <p className="text-2xl lg:text-3xl font-black mt-1 text-rose-300">
                {claims.filter((c) => c.status === 'REJECTED').length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {dataError && (
        <div className="bg-white rounded-2xl p-4 border border-rose-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-rose-900 font-semibold">
            <CloudOff className="w-4 h-4 text-rose-700 shrink-0" />
            <span>Sebagian data laporan gagal dimuat. Periksa koneksi lalu muat ulang.</span>
          </div>
          <button
            type="button"
            onClick={() => void refreshData()}
            className="min-h-11 px-3.5 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold shrink-0"
          >
            Coba Lagi
          </button>
        </div>
      )}

      {/* Sub-Tab Navigasi Superadmin */}
      <div className="flex flex-wrap gap-2 lg:gap-3 p-1.5 bg-slate-200 rounded-2xl border border-slate-300">
        {[
          { id: 'MASTER', label: 'Data master', count: 0 },
          { id: 'VERIFIKASI_KTM', label: 'Verifikasi KTM', count: ktmPendingCount },
          { id: 'AKUN', label: 'Akun terdaftar', count: 0 },
          { id: 'IMPOR', label: 'Impor akun', count: 0 },
          { id: 'LAPORAN', label: 'Laporan', count: 0 },
          { id: 'MODERASI', label: 'Moderasi', count: spamItems.length + suspiciousAccounts.length },
          { id: 'DOKUMEN', label: 'Dokumentasi', count: 0 },
          { id: 'PENGADUAN', label: 'Pengaduan', count: complaints.filter((c) => c.status === 'Menunggu').length },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              setAdminSubTab(tab.id as typeof adminSubTab);
              if (tab.id === 'AKUN' || tab.id === 'VERIFIKASI_KTM') void loadAccounts();
            }}
            className={`min-h-11 px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
              adminSubTab === tab.id
                ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-900/5'
                : 'text-slate-700 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span
                className={`ml-2 px-1.5 py-0.5 rounded-md text-white text-[10px] font-black ${
                  tab.id === 'VERIFIKASI_KTM' ? 'bg-amber-700' : 'bg-rose-700'
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* SUB-TAB 1: MANAJEMEN DATA MASTER */}
      {adminSubTab === 'MASTER' && (
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-5">
            <div className="flex items-center gap-2 text-sm font-black text-slate-900">
              <Building2 className="w-5 h-5 text-purple-700" />
              <span>Lokasi Gedung</span>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleAddLocation();
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                value={newLocationName}
                onChange={(e) => setNewLocationName(e.target.value)}
                placeholder="Tambah gedung..."
                aria-label="Nama lokasi gedung baru"
                className="flex-1 min-h-12 px-4 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-700 focus:bg-white transition"
              />
              <button
                type="submit"
                disabled={masterBusy !== null || !newLocationName.trim()}
                className="shrink-0 min-h-12 px-5 rounded-xl bg-purple-700 hover:bg-purple-800 disabled:opacity-50 text-white text-xs font-black flex items-center gap-2 shadow-sm transition"
              >
                <Plus className="w-4 h-4" />
                {masterBusy === 'LOCATION' ? '...' : 'Tambah'}
              </button>
            </form>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {locations.length === 0 ? (
                <p className="col-span-full text-xs text-slate-600 bg-slate-50 rounded-2xl p-6 text-center border border-slate-200 border-dashed">
                  Belum ada lokasi kampus.
                </p>
              ) : (
                locations.map((loc) => (
                  <div
                    key={loc}
                    className="flex items-center justify-between gap-2 min-h-11 pl-3 pr-0.5 bg-slate-50 border border-slate-200 rounded-xl group hover:bg-slate-100 transition"
                  >
                    <span className="text-xs font-bold text-slate-800 truncate">{loc}</span>
                    <button
                      type="button"
                      onClick={() => void handleRemoveLocation(loc)}
                      disabled={masterBusy !== null}
                      aria-label={`Hapus lokasi ${loc}`}
                      title={`Hapus lokasi ${loc}`}
                      className="min-w-11 min-h-11 flex items-center justify-center rounded-lg text-slate-600 hover:text-rose-700 hover:bg-rose-50 transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-5">
            <div className="flex items-center gap-2 text-sm font-black text-slate-900">
              <Tag className="w-5 h-5 text-purple-700" />
              <span>Kategori Barang</span>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleAddCategory();
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="Tambah kategori..."
                aria-label="Nama kategori barang baru"
                className="flex-1 min-h-12 px-4 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-700 focus:bg-white transition"
              />
              <button
                type="submit"
                disabled={masterBusy !== null || !newCategoryName.trim()}
                className="shrink-0 min-h-12 px-5 rounded-xl bg-purple-700 hover:bg-purple-800 disabled:opacity-50 text-white text-xs font-black flex items-center gap-2 shadow-sm transition"
              >
                <Plus className="w-4 h-4" />
                {masterBusy === 'CATEGORY' ? '...' : 'Tambah'}
              </button>
            </form>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {categories.length === 0 ? (
                <p className="col-span-full text-xs text-slate-600 bg-slate-50 rounded-2xl p-6 text-center border border-slate-200 border-dashed">
                  Belum ada kategori barang.
                </p>
              ) : (
                categories.map((cat) => (
                  <div
                    key={cat}
                    className="flex items-center justify-between gap-2 min-h-11 pl-3 pr-0.5 bg-slate-50 border border-slate-200 rounded-xl group hover:bg-slate-100 transition"
                  >
                    <span className="text-xs font-bold text-slate-800 truncate">{cat}</span>
                    <button
                      type="button"
                      onClick={() => void handleRemoveCategory(cat)}
                      disabled={masterBusy !== null}
                      aria-label={`Hapus kategori ${cat}`}
                      title={`Hapus kategori ${cat}`}
                      className="min-w-11 min-h-11 flex items-center justify-center rounded-lg text-slate-600 hover:text-rose-700 hover:bg-rose-50 transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB: VERIFIKASI KTM MAHASISWA */}
      {adminSubTab === 'VERIFIKASI_KTM' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-purple-700" /> Verifikasi Kartu Tanda Mahasiswa (KTM)
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  Tinjau foto fisik KTM mahasiswa untuk memvalidasi Nama, NIM, dan Program Studi secara manual.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void loadAccounts()}
                disabled={accountsLoading}
                className="self-start sm:self-center shrink-0 min-h-11 px-4 py-2 flex items-center gap-2 rounded-xl bg-slate-100 border border-slate-300 text-slate-800 hover:bg-slate-200 text-xs font-bold transition"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${accountsLoading ? 'animate-spin' : ''}`} />
                <span>Segarkan Data</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setKtmStatusFilter('PENDING')}
                className={`p-4 rounded-2xl border text-left transition ${
                  ktmStatusFilter === 'PENDING'
                    ? 'bg-amber-50 border-amber-400 ring-2 ring-amber-400/40'
                    : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-900">
                    Menunggu Verifikasi
                  </span>
                  {ktmPendingCount > 0 && <span className="w-2 h-2 rounded-full bg-amber-600" />}
                </div>
                <p className="text-2xl font-black text-amber-950 mt-1">{ktmPendingCount}</p>
                <p className="text-[11px] text-amber-800 mt-0.5">Mahasiswa baru / belum disetujui</p>
              </button>

              <button
                type="button"
                onClick={() => setKtmStatusFilter('VERIFIED')}
                className={`p-4 rounded-2xl border text-left transition ${
                  ktmStatusFilter === 'VERIFIED'
                    ? 'bg-emerald-50 border-emerald-400 ring-2 ring-emerald-400/40'
                    : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-900">
                  Sudah Terverifikasi
                </span>
                <p className="text-2xl font-black text-emerald-950 mt-1">{ktmApprovedCount}</p>
                <p className="text-[11px] text-emerald-800 mt-0.5">Identitas sah terverifikasi</p>
              </button>

              <button
                type="button"
                onClick={() => setKtmStatusFilter('SEMUA')}
                className={`p-4 rounded-2xl border text-left transition ${
                  ktmStatusFilter === 'SEMUA'
                    ? 'bg-purple-50 border-purple-400 ring-2 ring-purple-400/40'
                    : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-purple-900">
                  Total Berkas KTM
                </span>
                <p className="text-2xl font-black text-purple-950 mt-1">{totalKtmCount}</p>
                <p className="text-[11px] text-purple-800 mt-0.5">Semua berkas yang diunggah</p>
              </button>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={ktmSearch}
                onChange={(e) => setKtmSearch(e.target.value)}
                placeholder="Cari nama mahasiswa, NIM, prodi, atau email..."
                aria-label="Cari pengajuan KTM"
                className="w-full min-h-12 pl-11 pr-4 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-700 focus:bg-white transition"
              />
            </div>
          </div>

          {accountsLoading ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[0, 1, 2].map((n) => (
                <div key={n} className="bg-white rounded-3xl p-5 border border-slate-200 animate-pulse space-y-4">
                  <div className="h-40 bg-slate-100 rounded-2xl w-full" />
                  <div className="h-4 bg-slate-100 rounded w-2/3" />
                  <div className="h-3 bg-slate-100 rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : accountsError ? (
            <div className="bg-white rounded-3xl p-8 border border-rose-200 text-center space-y-3">
              <CloudOff className="w-10 h-10 text-rose-700 mx-auto" />
              <p className="text-sm font-bold text-slate-900">Data antrean KTM gagal dimuat</p>
              <button
                type="button"
                onClick={() => void loadAccounts()}
                className="min-h-11 px-4 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold inline-flex items-center gap-1.5"
              >
                <RefreshCw className="w-4 h-4" /> Muat Ulang
              </button>
            </div>
          ) : ktmFilteredSubmissions.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 border border-slate-200 text-center space-y-3">
              <GraduationCap className="w-12 h-12 text-slate-400 mx-auto" />
              <p className="text-sm font-bold text-slate-900">
                {ktmStatusFilter === 'PENDING'
                  ? 'Tidak ada antrean verifikasi KTM yang menunggu.'
                  : 'Tidak ada berkas KTM yang sesuai filter.'}
              </p>
              <p className="text-xs text-slate-600">
                Ketika mahasiswa mengunggah KTM atau biodata SIAKAD, foto berkas akan muncul di sini untuk ditinjau.
              </p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5">
              {ktmFilteredSubmissions.map((account) => {
                const isBusy = accountBusy === `${account.id}:ktm`;
                const isVerified = Boolean(account.ktmVerified);
                const phoneWaHref =
                  account.phone && account.phone !== '-'
                    ? whatsAppHref(account.phone, `Halo ${account.name}, terkait verifikasi KTM Lost & Found kampus:`)
                    : null;

                return (
                  <article
                    key={account.id}
                    className="bg-white rounded-3xl p-5 border border-slate-200 hover:border-slate-300 transition shadow-sm flex flex-col justify-between"
                  >
                    <div className="space-y-4">
                      <div className="flex items-start gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-purple-50 overflow-hidden shrink-0 flex items-center justify-center text-sm font-black text-purple-800 border border-purple-200">
                          {account.avatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={account.avatarUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            account.name.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <p className="text-sm font-black text-slate-900 truncate">{account.name}</p>
                            {isVerified ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-emerald-900 bg-emerald-100 px-2 py-0.5 rounded-full shrink-0">
                                <CheckCircle2 className="w-3 h-3 text-emerald-700" /> Terverifikasi
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-amber-900 bg-amber-100 px-2 py-0.5 rounded-full shrink-0">
                                <ShieldAlert className="w-3 h-3 text-amber-700" /> Menunggu
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] font-mono font-bold text-slate-600 mt-0.5">
                            NIM: <span className="text-slate-900 font-extrabold">{account.identifier}</span>
                          </p>
                          <p className="text-[11px] text-slate-600 truncate">{account.department}</p>
                        </div>
                      </div>

                      <div className="relative aspect-[16/10] rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 group">
                        {account.ktmUrl ? (
                          <>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={account.ktmUrl}
                              alt={`KTM ${account.name}`}
                              className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                            />
                            <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition flex items-center justify-center p-3">
                              <button
                                type="button"
                                onClick={() => setViewingKtmAccount(account)}
                                className="min-h-11 px-4 py-2 rounded-xl bg-white text-slate-900 text-xs font-bold shadow-lg flex items-center gap-1.5 transition"
                              >
                                <Eye className="w-3.5 h-3.5" /> Periksa KTM Lengkap
                              </button>
                            </div>
                          </>
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-slate-600 p-4 text-center">
                            <GraduationCap className="w-8 h-8 mb-1 stroke-1" />
                            <p className="text-xs">Foto KTM Belum Ada</p>
                          </div>
                        )}
                      </div>

                      <div className="bg-slate-50 rounded-2xl p-3 text-xs space-y-1.5 border border-slate-200">
                        <div className="flex items-center justify-between text-slate-700">
                          <span className="text-slate-600">Email:</span>
                          <span className="font-semibold truncate max-w-[170px]">{account.emailPersonal || '-'}</span>
                        </div>
                        <div className="flex items-center justify-between text-slate-700">
                          <span className="text-slate-600">WhatsApp:</span>
                          {phoneWaHref ? (
                            <a
                              href={phoneWaHref}
                              target="_blank"
                              rel="noreferrer"
                              className="min-h-11 px-2 font-bold text-emerald-800 hover:underline inline-flex items-center gap-1 rounded-lg focus-visible:outline-2 focus-visible:outline-emerald-700"
                            >
                              <Phone className="w-3 h-3 text-emerald-700" />
                              {account.phone}
                            </a>
                          ) : (
                            <span className="font-semibold">{account.phone || '-'}</span>
                          )}
                        </div>
                        <div className="flex items-center justify-between text-slate-700">
                          <span className="text-slate-600">Terdaftar:</span>
                          <span className="font-semibold">{account.createdAt}</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-slate-200 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setViewingKtmAccount(account)}
                        className="min-h-11 px-3 py-2 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-800 text-xs font-bold transition flex items-center gap-1.5 shrink-0"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Lihat</span>
                      </button>

                      {!isVerified ? (
                        <>
                          <button
                            type="button"
                            disabled={accountBusy !== null}
                            onClick={() => void handleVerifyKtm(account, true, false)}
                            className="flex-1 min-h-11 py-2 px-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs font-black transition flex items-center justify-center gap-1.5 shadow-sm"
                          >
                            {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                            <span>Setujui KTM</span>
                          </button>
                          <button
                            type="button"
                            disabled={accountBusy !== null}
                            onClick={() => void handleVerifyKtm(account, false, true)}
                            aria-label={`Tolak verifikasi KTM ${account.name}`}
                            title="Tolak verifikasi KTM"
                            className="min-h-11 min-w-11 py-2 px-3 rounded-xl border border-rose-300 text-rose-800 hover:bg-rose-50 disabled:opacity-50 text-xs font-bold transition flex items-center justify-center"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          disabled={accountBusy !== null}
                          onClick={() => void handleVerifyKtm(account, false, false)}
                          className="flex-1 min-h-11 py-2 px-3 rounded-xl border border-slate-300 text-slate-800 hover:bg-slate-100 disabled:opacity-50 text-xs font-bold transition flex items-center justify-center gap-1.5"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>{isBusy ? 'Menyimpan...' : 'Batalkan Status'}</span>
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 2: DAFTAR AKUN TERDAFTAR */}
      {adminSubTab === 'AKUN' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <Users className="w-5 h-5 text-purple-700" /> Akun Terdaftar
                </h3>
              </div>
              <button
                type="button"
                onClick={() => void loadAccounts()}
                disabled={accountsLoading}
                aria-label="Segarkan daftar akun"
                className="shrink-0 w-11 h-11 flex items-center justify-center rounded-xl bg-slate-100 border border-slate-300 text-slate-700 hover:text-slate-900 hover:bg-slate-200 transition"
              >
                <RefreshCw className={`w-4 h-4 ${accountsLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <div className="grid gap-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={accountSearch}
                  onChange={(e) => setAccountSearch(e.target.value)}
                  placeholder="Cari nama, NIM/NIDN, atau prodi..."
                  aria-label="Cari akun terdaftar"
                  className="w-full min-h-12 pl-11 pr-4 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-700 focus:bg-white transition"
                />
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <select
                  aria-label="Filter peran akun"
                  value={accountRole}
                  onChange={(e) => setAccountRole(e.target.value as typeof accountRole)}
                  className="min-h-12 px-4 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-purple-700 focus:bg-white transition"
                >
                  <option value="SEMUA">Semua peran</option>
                  {USER_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {ROLE_LABELS[role]}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Filter status akun"
                  value={accountStatus}
                  onChange={(e) => setAccountStatus(e.target.value as typeof accountStatus)}
                  className="min-h-12 px-4 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-purple-700 focus:bg-white transition"
                >
                  <option value="SEMUA">Semua status</option>
                  <option value="AKTIF">Aktif</option>
                  <option value="NONAKTIF">Nonaktif</option>
                </select>
              </div>
            </div>
          </div>

          {accountsLoading ? (
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {[0, 1, 2, 3, 4, 5].map((n) => (
                <div key={n} className="bg-white rounded-3xl p-5 border border-slate-200 animate-pulse flex gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 shrink-0" />
                  <div className="flex-1 space-y-2.5">
                    <div className="h-3 w-1/2 bg-slate-100 rounded-full" />
                    <div className="h-2.5 w-1/3 bg-slate-100 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : accountsError ? (
            <div className="bg-white rounded-3xl p-8 border border-rose-200 text-center space-y-3">
              <CloudOff className="w-10 h-10 text-rose-700 mx-auto" />
              <p className="text-sm font-bold text-slate-900">Daftar akun gagal dimuat</p>
              <button
                type="button"
                onClick={() => void loadAccounts()}
                className="min-h-11 px-4 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold inline-flex items-center gap-1.5"
              >
                <RefreshCw className="w-4 h-4" /> Muat Ulang
              </button>
            </div>
          ) : filteredAccounts.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 border border-slate-200 text-center space-y-3">
              <Users className="w-12 h-12 text-slate-400 mx-auto" />
              <p className="text-sm font-bold text-slate-800">Tidak ada akun ditemukan.</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredAccounts.map((account) => {
                const isSelf = account.id === currentUser?.id;
                return (
                  <article
                    key={account.id}
                    className="bg-white rounded-3xl p-5 border border-slate-200 hover:border-slate-300 transition-all shadow-sm"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-slate-100 overflow-hidden shrink-0 flex items-center justify-center text-sm font-black text-slate-700">
                        {account.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={account.avatarUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          account.name.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-black text-slate-900 truncate">{account.name}</p>
                            <p className="text-[11px] text-slate-600 font-bold mt-0.5">{account.identifier}</p>
                          </div>
                          <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-lg shrink-0 ${accountRoleBadgeClass(account.role)}`}>
                            {account.roleLabel}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 mt-2 truncate font-medium">{account.department}</p>
                        {account.role === 'MAHASISWA' && (
                          <div className="mt-2 flex items-center gap-1.5">
                            {account.ktmVerified ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3 text-emerald-700" /> KTM Disetujui
                              </span>
                            ) : account.ktmUrl ? (
                              <button
                                type="button"
                                onClick={() => setViewingKtmAccount(account)}
                                className="min-h-11 inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-900 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-xl border border-amber-200 transition"
                              >
                                <ShieldAlert className="w-3.5 h-3.5 text-amber-700" /> Menunggu KTM · Tinjau
                              </button>
                            ) : (
                              <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                                Belum Upload KTM
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-5 pt-4 border-t border-slate-200 flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-600 uppercase tracking-tighter">
                          Status Akun
                        </span>
                        <span className={`text-[11px] font-black mt-0.5 ${account.isActive ? 'text-emerald-700' : 'text-rose-700'}`}>
                          {account.isActive ? 'AKTIF' : 'NONAKTIF'}
                        </span>
                      </div>
                      {isSelf ? (
                        <span className="text-[11px] font-bold text-slate-600">Akun Anda</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => toggleAccountPanel(account)}
                          className="min-h-11 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition flex items-center gap-2"
                        >
                          <UserCog className="w-3.5 h-3.5" />
                          Kelola
                        </button>
                      )}
                    </div>

                    {managingId === account.id && !isSelf && (
                      <div className="mt-4 pt-4 border-t border-slate-200 space-y-4">
                        {account.ktmUrl && (
                          <button
                            type="button"
                            onClick={() => setViewingKtmAccount(account)}
                            className="w-full min-h-11 rounded-xl border border-purple-300 bg-purple-50 hover:bg-purple-100 text-purple-900 text-xs font-bold transition flex items-center justify-center gap-1.5"
                          >
                            <Eye className="w-3.5 h-3.5" /> Tinjau Berkas KTM Mahasiswa
                          </button>
                        )}
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-600 uppercase">Ubah Peran</label>
                          <div className="flex gap-2">
                            <select
                              aria-label={`Ubah peran ${account.name}`}
                              value={roleDraft}
                              onChange={(e) => setRoleDraft(e.target.value as UserRole)}
                              className="flex-1 min-h-11 px-3 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs font-bold"
                            >
                              {USER_ROLES.map((role) => (
                                <option key={role} value={role}>
                                  {ROLE_LABELS[role]}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => void handleRoleSave(account)}
                              disabled={accountBusy !== null || roleDraft === account.role}
                              className="min-h-11 px-4 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-xs font-black disabled:opacity-50"
                            >
                              {accountBusy === `${account.id}:role` ? '...' : 'Simpan'}
                            </button>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            disabled={accountBusy !== null}
                            onClick={() => void handleResetPassword(account)}
                            className="min-h-11 rounded-xl border border-slate-300 text-slate-800 text-xs font-bold hover:bg-slate-100 disabled:opacity-50"
                          >
                            {accountBusy === `${account.id}:reset` ? 'Mereset...' : 'Reset Sandi'}
                          </button>
                          <button
                            type="button"
                            disabled={accountBusy !== null}
                            onClick={() => void handleAccountStatus(account)}
                            className={`min-h-11 rounded-xl text-white text-xs font-bold disabled:opacity-50 ${
                              account.isActive ? 'bg-rose-700 hover:bg-rose-800' : 'bg-emerald-700 hover:bg-emerald-800'
                            }`}
                          >
                            {accountBusy === `${account.id}:status`
                              ? 'Memproses...'
                              : account.isActive
                                ? 'Blokir'
                                : 'Aktifkan'}
                          </button>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 3: IMPOR AKUN */}
      {adminSubTab === 'IMPOR' && (
        <div className="bg-white rounded-3xl p-6 lg:p-8 border border-slate-200 shadow-sm space-y-6">
          <div className="space-y-1">
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <FileUp className="w-5 h-5 text-purple-700" /> Impor Akun
            </h3>
            <p className="text-xs text-slate-600">Format: NIM,Nama,Prodi (satu per baris).</p>
          </div>

          <textarea
            rows={8}
            value={bulkInput}
            onChange={(e) => setBulkInput(e.target.value)}
            aria-label="Daftar akun untuk diimpor"
            placeholder="230101044,Budi Santoso,S1 Teknik Informatika..."
            className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-300 text-slate-900 text-xs font-mono placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-700 focus:bg-white transition"
          />

          <button
            type="button"
            onClick={handleBulkImport}
            disabled={bulkSubmitting || !bulkInput.trim()}
            className="w-full min-h-12 rounded-2xl bg-purple-700 hover:bg-purple-800 text-white font-black text-xs disabled:opacity-50 transition shadow-sm"
          >
            {bulkSubmitting ? 'Memproses...' : 'Impor Akun'}
          </button>

          {bulkResult && (
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 space-y-1.5">
                <p className="text-xs font-black text-emerald-900 uppercase tracking-tighter">
                  Berhasil ({bulkResult.created.length})
                </p>
                <p className="text-[11px] text-emerald-800 font-mono">
                  {bulkResult.created.join(', ') || '-'}
                </p>
                {bulkResult.created.length > 0 && bulkResult.defaultPassword && (
                  <p className="text-[11px] text-emerald-900">
                    Kata sandi awal: <code className="font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-emerald-200">{bulkResult.defaultPassword}</code>
                  </p>
                )}
              </div>
              <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4">
                <p className="text-xs font-black text-rose-900 uppercase tracking-tighter">
                  Gagal ({bulkResult.failed.length})
                </p>
                {bulkResult.failed.map((f, i) => (
                  <p key={i} className="text-[11px] text-rose-800 mt-0.5">
                    {f.identifier}: {f.reason}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 4 & 7: QUEUE COMPONENTS */}
      {(adminSubTab === 'LAPORAN' || adminSubTab === 'PENGADUAN') && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden p-4">
          {adminSubTab === 'LAPORAN' ? <ReportQueue /> : <ComplaintQueue />}
        </div>
      )}

      {/* SUB-TAB 5: MODERASI (TERHUBUNG DATABASE NYATA) */}
      {adminSubTab === 'MODERASI' && (
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-5">
            <div>
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-rose-700" /> Akun dengan Penolakan Berulang
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                Otomatis memantau akun yang klaimnya ditolak 2 kali atau lebih.
              </p>
            </div>

            {suspiciousAccounts.length === 0 ? (
              <div className="bg-slate-50 rounded-2xl p-8 border border-slate-200 text-center space-y-1">
                <p className="text-xs font-bold text-slate-800">Tidak ada akun mencurigakan</p>
                <p className="text-[11px] text-slate-600">
                  Belum ada akun dengan penolakan klaim berulang pada data saat ini.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {suspiciousAccounts.map((acc) => {
                  const busy = accountBusy === `${acc.userId}:status`;
                  return (
                    <div
                      key={acc.userId}
                      className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs font-black text-slate-900">{acc.name}</p>
                          <p className="text-[11px] text-slate-600 font-mono">
                            {acc.identifier} · {acc.department}
                          </p>
                        </div>
                        <span className="text-[10px] font-black px-2 py-1 rounded bg-rose-700 text-white shrink-0">
                          {acc.rejectedCount}x Ditolak
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-700">
                        Klaim terakhir: <strong>{acc.lastItemTitle}</strong>
                      </p>
                      <button
                        type="button"
                        disabled={
                          accountsLoading ||
                          accountBusy !== null ||
                          acc.userId === currentUser?.id
                        }
                        onClick={() => {
                          const targetAcc = accounts.find((a) => a.id === acc.userId);
                          if (!targetAcc) {
                            showToast(
                              'Akun Belum Tersedia',
                              'Daftar akun masih dimuat atau gagal diambil. Coba muat ulang tab Akun.',
                              'error'
                            );
                            return;
                          }
                          void handleAccountStatus(targetAcc);
                        }}
                        className={`w-full min-h-11 py-2 rounded-xl text-white text-xs font-bold transition disabled:opacity-50 ${
                          acc.isActive
                            ? 'bg-rose-700 hover:bg-rose-800'
                            : 'bg-emerald-700 hover:bg-emerald-800'
                        }`}
                      >
                        {busy
                          ? 'Memproses...'
                          : acc.isActive
                            ? 'Bekukan / Nonaktifkan Akun'
                            : 'Aktifkan Kembali Akun'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-5">
            <div>
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-700" /> Laporan Spam
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                Daftar postingan yang ditandai sebagai spam atau tidak pantas oleh pengguna.
              </p>
            </div>

            {spamItems.length === 0 ? (
              <div className="bg-slate-50 rounded-2xl p-8 border border-slate-200 text-center space-y-1">
                <p className="text-xs font-bold text-slate-800">Aman. Tidak ada laporan spam.</p>
                <p className="text-[11px] text-slate-600">
                  Postingan yang dilaporkan pengguna akan masuk ke daftar ini.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {spamItems.map((spm) => (
                  <div
                    key={spm.id}
                    className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3"
                  >
                    <div>
                      <p className="text-xs font-bold text-slate-900">&quot;{spm.title}&quot;</p>
                      <p className="text-[11px] text-slate-600 mt-0.5">
                        Pelapor: {spm.reporterName} · {spm.location}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <a
                        href={`/barang/${spm.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="min-h-11 px-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-800 text-xs font-bold inline-flex items-center gap-1.5"
                      >
                        <ExternalLink className="w-3.5 h-3.5" /> Lihat
                      </a>
                      <button
                        type="button"
                        disabled={spamBusyId !== null}
                        onClick={() => void handleDeleteSpamItem(spm.id, spm.title)}
                        className="flex-1 min-h-11 py-2 px-3 rounded-xl bg-rose-700 hover:bg-rose-800 disabled:opacity-50 text-white text-xs font-bold"
                      >
                        {spamBusyId === spm.id ? 'Memproses...' : 'Hapus'}
                      </button>
                      <button
                        type="button"
                        disabled={spamBusyId !== null}
                        onClick={() => void handleDismissSpam(spm.id)}
                        className="flex-1 min-h-11 py-2 px-3 rounded-xl bg-slate-200 hover:bg-slate-300 disabled:opacity-50 text-slate-800 text-xs font-bold"
                      >
                        Abaikan
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB 6: DOKUMENTASI */}
      {adminSubTab === 'DOKUMEN' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-6">
          <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
            <Camera className="w-5 h-5 text-purple-700" /> Dokumentasi Serah Terima
          </h3>
          {doneHandoverItems.length === 0 ? (
            <div className="bg-slate-50 rounded-2xl p-10 border border-slate-200 text-center space-y-1.5">
              <Camera className="w-10 h-10 text-slate-400 mx-auto" />
              <p className="text-sm font-bold text-slate-900">Belum ada dokumentasi serah terima</p>
              <p className="text-xs text-slate-600 max-w-sm mx-auto">
                Foto dokumentasi penyerahan barang yang sudah selesai akan tersimpan otomatis di sini sebagai arsip audit.
              </p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {doneHandoverItems.map((item) => (
                <div
                  key={item.id}
                  className="bg-slate-50 rounded-2xl overflow-hidden border border-slate-200 group"
                >
                  {item.handoverInfo?.photoUrl ? (
                    <a href={item.handoverInfo.photoUrl} target="_blank" rel="noreferrer" className="block">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.handoverInfo.photoUrl}
                        alt={`Serah terima ${item.title}`}
                        className="w-full aspect-video object-cover group-hover:scale-105 transition duration-500"
                      />
                    </a>
                  ) : (
                    <div className="w-full aspect-video bg-slate-200 flex items-center justify-center text-slate-700 text-xs font-bold">
                      Tanpa Foto
                    </div>
                  )}
                  <div className="p-4 space-y-1">
                    <p className="text-xs font-black text-slate-900 truncate">{item.title}</p>
                    <p className="text-[11px] text-slate-700 font-bold">
                      Penerima: {item.handoverInfo?.claimedBy || '-'}
                    </p>
                    {item.handoverInfo?.verifiedBy && (
                      <p className="text-[11px] text-slate-600">
                        Verifikasi: {item.handoverInfo.verifiedBy}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL LIGHTBOX / PENINJAUAN FOTO KTM LENGKAP */}
      {viewingKtmAccount && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="ktm-lightbox-title"
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 lg:p-6"
          onClick={() => setViewingKtmAccount(null)}
        >
          <div
            className="bg-white rounded-3xl overflow-hidden max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 text-purple-800 rounded-xl">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <div>
                  <h3 id="ktm-lightbox-title" className="text-sm font-black text-slate-900">
                    Tinjau Berkas KTM: {viewingKtmAccount.name}
                  </h3>
                  <p className="text-xs text-slate-600">
                    NIM: {viewingKtmAccount.identifier} · {viewingKtmAccount.department}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingKtmAccount(null)}
                aria-label="Tutup pratinjau KTM"
                className="w-11 h-11 rounded-xl border border-slate-300 text-slate-600 hover:text-slate-900 hover:bg-slate-100 flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-4 sm:p-6 bg-slate-900 flex items-center justify-center">
              {viewingKtmAccount.ktmUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={viewingKtmAccount.ktmUrl}
                  alt={`KTM ${viewingKtmAccount.name}`}
                  className="max-h-[60vh] max-w-full object-contain rounded-xl shadow-lg"
                />
              ) : (
                <p className="text-slate-200 text-xs">Foto KTM tidak tersedia.</p>
              )}
            </div>

            <div className="p-4 sm:p-5 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3 text-xs w-full sm:w-auto">
                {viewingKtmAccount.ktmUrl && (
                  <a
                    href={viewingKtmAccount.ktmUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-blue-700 hover:underline font-bold text-xs min-h-11"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Buka Tab Baru
                  </a>
                )}
                <span className="text-slate-400" aria-hidden="true">|</span>
                <span className="text-slate-700">
                  Status:{' '}
                  <strong>
                    {viewingKtmAccount.ktmVerified ? 'Terverifikasi Resmi' : 'Menunggu Persetujuan'}
                  </strong>
                </span>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => setViewingKtmAccount(null)}
                  className="min-h-11 px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-800 text-xs font-bold transition"
                >
                  Tutup
                </button>

                {!viewingKtmAccount.ktmVerified ? (
                  <>
                    <button
                      type="button"
                      disabled={accountBusy !== null}
                      onClick={() => void handleVerifyKtm(viewingKtmAccount, false, true)}
                      className="min-h-11 px-4 py-2.5 rounded-xl border border-rose-300 bg-rose-50 hover:bg-rose-100 disabled:opacity-50 text-rose-800 text-xs font-bold transition"
                    >
                      Tolak
                    </button>
                    <button
                      type="button"
                      disabled={accountBusy !== null}
                      onClick={() => void handleVerifyKtm(viewingKtmAccount, true, false)}
                      className="min-h-11 px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs font-black shadow-sm transition flex items-center gap-1.5"
                    >
                      <Check className="w-4 h-4" /> Setujui KTM
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    disabled={accountBusy !== null}
                    onClick={() => void handleVerifyKtm(viewingKtmAccount, false, false)}
                    className="min-h-11 px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-800 hover:bg-rose-50 hover:text-rose-800 disabled:opacity-50 text-xs font-bold transition"
                  >
                    Batalkan Status
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
