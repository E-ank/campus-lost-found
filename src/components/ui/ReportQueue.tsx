'use client';

import { useMemo, useState } from 'react';
import {
  ExternalLink,
  Package,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import StatusBadge from '@/components/ui/StatusBadge';
import type { Item, ItemStatus, ItemType } from '@/types';

const ITEM_STATUSES: ItemStatus[] = [
  'Dicari',
  'Menunggu Diserahkan ke Pos',
  'Di Pos Satpam',
  'Di Penemu',
  'Selesai',
];

const TYPE_LABEL: Record<ItemType, string> = {
  FOUND: 'Temuan',
  LOST: 'Kehilangan',
};

function formatReportDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// Daftar semua laporan barang untuk Superadmin. Penghapusan dilakukan lewat
// API server agar klaim, riwayat chat, dan foto terkait ikut dibersihkan.
export default function ReportQueue() {
  const { items, dataLoading, dataError, refreshData, showToast } = useApp();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'SEMUA' | ItemType>('SEMUA');
  const [statusFilter, setStatusFilter] = useState<'SEMUA' | ItemStatus>('SEMUA');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter((item) => {
      const matchesType = typeFilter === 'SEMUA' || item.type === typeFilter;
      const matchesStatus = statusFilter === 'SEMUA' || item.status === statusFilter;
      const matchesQuery =
        query.length === 0 ||
        [
          item.title,
          item.reporterName,
          item.reporterId,
          item.category,
          item.location,
        ]
          .join(' ')
          .toLowerCase()
          .includes(query);

      return matchesType && matchesStatus && matchesQuery;
    });
  }, [items, search, statusFilter, typeFilter]);

  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await refreshData();
    } finally {
      setRefreshing(false);
    }
  };

  const handleDelete = async (item: Item) => {
    const confirmed = window.confirm(
      `Hapus laporan "${item.title}"?\n\nKlaim dan foto terkait akan ikut terhapus. Tindakan ini tidak dapat dibatalkan.`
    );
    if (!confirmed) return;

    setDeletingId(item.id);
    try {
      const response = await fetch(`/api/admin/items/${item.id}`, {
        method: 'DELETE',
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };

      if (!response.ok) {
        showToast(
          'Gagal Menghapus Laporan',
          payload.error ?? 'Terjadi kesalahan pada server.',
          'error'
        );
        return;
      }

      showToast('Laporan Dihapus', payload.message ?? 'Laporan berhasil dihapus.');
      await refreshData();
    } catch {
      showToast('Gagal Menghapus Laporan', 'Tidak dapat menghubungi server.', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs font-black text-slate-900">
            <Package className="w-4 h-4 text-purple-700" />
            <span>Kelola Laporan</span>
          </div>
          <button
            type="button"
            onClick={() => void handleRefresh()}
            disabled={refreshing}
            aria-label="Muat ulang daftar laporan"
            className="shrink-0 min-h-11 min-w-11 inline-flex items-center justify-center rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari judul, pelapor, lokasi..."
            aria-label="Cari laporan barang"
            className="w-full min-h-11 pl-9 pr-3 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-blue-700"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as 'SEMUA' | ItemType)}
            aria-label="Filter jenis laporan"
            className="w-full min-h-11 px-3 rounded-xl border border-slate-300 bg-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-700"
          >
            <option value="SEMUA">Semua jenis</option>
            <option value="FOUND">Temuan</option>
            <option value="LOST">Kehilangan</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'SEMUA' | ItemStatus)}
            aria-label="Filter status laporan"
            className="w-full min-h-11 px-3 rounded-xl border border-slate-300 bg-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-700"
          >
            <option value="SEMUA">Semua status</option>
            {ITEM_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>

        <p className="text-[10px] font-bold text-slate-600">
          {dataLoading
            ? 'Memuat laporan...'
            : dataError
              ? 'Laporan gagal dimuat.'
              : `${filteredItems.length} laporan`}
        </p>
      </div>

      {dataLoading ? (
        <div className="space-y-2.5">
          {[0, 1, 2].map((n) => (
            <div
              key={n}
              className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-sm animate-pulse flex items-start gap-3"
            >
              <div className="w-12 h-12 rounded-xl bg-slate-100 shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-1/2 bg-slate-100 rounded-full" />
                <div className="h-2.5 w-1/3 bg-slate-100 rounded-full" />
                <div className="h-2.5 w-2/3 bg-slate-100 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      ) : dataError ? (
        <div className="bg-white rounded-2xl p-6 border border-rose-200 shadow-sm text-center space-y-3">
          <p className="text-sm font-bold text-slate-800">Laporan gagal dimuat</p>
          <p className="text-xs text-slate-600">
            Periksa koneksi internet Anda, lalu coba lagi.
          </p>
          <button
            type="button"
            onClick={() => void handleRefresh()}
            className="min-h-11 px-4 bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold rounded-xl transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          >
            Coba Lagi
          </button>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 border border-slate-100 shadow-sm text-center">
          <Package className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-bold text-slate-800">
            {items.length === 0 ? 'Belum ada laporan barang' : 'Tidak ada laporan yang cocok'}
          </p>
          <p className="text-xs text-slate-600 mt-1">
            {items.length === 0
              ? 'Laporan dari pengguna akan tampil di sini.'
              : 'Ubah kata kunci pencarian atau filter jenis/status.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredItems.map((item) => (
            <article
              key={item.id}
              className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-sm space-y-3"
            >
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-xl bg-slate-100 overflow-hidden shrink-0 flex items-center justify-center">
                  {item.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.photoUrl}
                      alt=""
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Package className="w-5 h-5 text-slate-500" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-extrabold text-slate-900 truncate">
                        {item.title}
                      </p>
                      <p className="text-[10px] text-slate-600 truncate">
                        {item.category} • {item.location}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${
                        item.type === 'FOUND'
                          ? 'bg-blue-50 text-blue-700 border-blue-200'
                          : 'bg-rose-50 text-rose-700 border-rose-200'
                      }`}
                    >
                      {TYPE_LABEL[item.type]}
                    </span>
                  </div>

                  <p className="text-[10px] text-slate-600 mt-1 truncate">
                    Pelapor: {item.reporterName} ({item.reporterId})
                  </p>

                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                    <StatusBadge status={item.status} />
                    <span className="text-[10px] text-slate-600">
                      Dilaporkan {formatReportDate(item.createdAtIso)}
                    </span>
                    {item.isSensitive && (
                      <span className="bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded text-[10px] font-bold">
                        Disensor
                      </span>
                    )}
                    {item.archivedAt && (
                      <span className="bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded text-[10px] font-bold">
                        Diarsipkan
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <a
                  href={`/barang/${item.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="min-h-11 px-3 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 text-[11px] font-bold inline-flex items-center justify-center gap-1.5 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
                >
                  <ExternalLink className="w-4 h-4" /> Lihat Detail
                </a>
                <button
                  type="button"
                  onClick={() => void handleDelete(item)}
                  disabled={deletingId !== null}
                  className="min-h-11 px-3 rounded-xl bg-rose-700 hover:bg-rose-800 disabled:opacity-50 text-white text-[11px] font-bold inline-flex items-center justify-center gap-1.5 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
                >
                  <Trash2 className="w-4 h-4" />
                  {deletingId === item.id ? 'Menghapus...' : 'Hapus Laporan'}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
