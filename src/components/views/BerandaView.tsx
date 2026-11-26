'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Building2,
  Clock,
  CloudOff,
  CreditCard,
  Eye,
  EyeOff,
  Key,
  Loader2,
  Lock,
  MapPin,
  MoreHorizontal,
  Package,
  PackageCheck,
  PackagePlus,
  PackageSearch,
  Plus,
  RotateCcw,
  Search,
  Smartphone,
  Wallet,
  X,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import ItemVisualIllustration from '@/components/ui/ItemVisualIllustration';
import PwaInstallCard from '@/components/pwa/PwaInstallCard';
import StatusBadge from '@/components/ui/StatusBadge';
import { isItemArchived } from '@/lib/supabase/queries';
import type { Item } from '@/types';

// Beranda: pencarian & filter daftar barang ditemukan/hilang.
export default function BerandaView() {
  const router = useRouter();
  const {
    currentUser,
    items,
    dataLoading,
    dataError,
    refreshData,
    locations,
    categories,
    feedType,
    setFeedType,
    setItemSensitivity,
    feedSearch: searchQuery,
    setFeedSearch: setSearchQuery,
    openLoginGate,
  } = useApp();

  const [selectedLocation, setSelectedLocation] = useState('Semua');
  const [selectedCategory, setSelectedCategory] = useState('Semua');
  const [sensitivityPendingId, setSensitivityPendingId] = useState<string | null>(null);

  const activeItems = useMemo<Item[]>(
    () => items.filter((item) => !isItemArchived(item)),
    [items]
  );

  const isSearching = searchQuery.trim().length > 0;

  const filteredItems = useMemo<Item[]>(() => {
    const query = searchQuery.trim().toLowerCase();

    if (query) {
      return activeItems
        .filter((item) => {
          const haystack = [
            item.title,
            item.description,
            item.location,
            item.category,
          ]
            .join(' ')
            .toLowerCase();
          return haystack.includes(query);
        })
        .sort((a, b) => {
          const aTitle = a.title.toLowerCase().includes(query) ? 0 : 1;
          const bTitle = b.title.toLowerCase().includes(query) ? 0 : 1;
          return aTitle - bTitle;
        });
    }

    return activeItems.filter((item) => {
      const matchesType = item.type === feedType;
      const matchesLoc = selectedLocation === 'Semua' || item.location === selectedLocation;
      const matchesCat = selectedCategory === 'Semua' || item.category === selectedCategory;
      return matchesType && matchesLoc && matchesCat;
    });
  }, [activeItems, feedType, selectedLocation, selectedCategory, searchQuery]);

  const canModerateSensitivity =
    currentUser?.role === 'SATPAM' || currentUser?.role === 'SUPERADMIN';

  const navigateToReport = () => {
    if (!currentUser) {
      openLoginGate('Masuk dengan akun kampus untuk melapor barang.', {
        redirectPath: '/lapor',
      });
    } else {
      router.push('/lapor');
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Identitas/KTM':
        return <CreditCard className="w-5 h-5" />;
      case 'Elektronik':
        return <Smartphone className="w-5 h-5" />;
      case 'Kunci':
        return <Key className="w-5 h-5" />;
      case 'Dompet':
        return <Wallet className="w-5 h-5" />;
      default:
        return <MoreHorizontal className="w-5 h-5" />;
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-50 lg:bg-transparent">
      {/* Pencarian mobile */}
      <div className="sticky top-0 z-20 bg-white px-4 py-3 border-b border-slate-200 shadow-sm lg:hidden">
        <div className="relative group">
          <Search className="w-4 h-4 text-slate-600 absolute left-3.5 top-1/2 -translate-y-1/2 group-focus-within:text-blue-700 transition-colors pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari barang..."
            aria-label="Cari barang hilang atau temuan"
            className="w-full min-h-11 pl-10 pr-12 py-2.5 bg-slate-100 border border-slate-200 rounded-2xl text-sm text-slate-900 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Hapus pencarian"
              className="absolute right-0.5 top-1/2 -translate-y-1/2 min-h-11 min-w-11 inline-flex items-center justify-center text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-200 focus-visible:outline-2 focus-visible:outline-blue-700"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar pb-8">
        {!isSearching && (
          <>
            {/* Hero Section */}
            <div className="px-4 py-3">
              <div className="relative rounded-3xl overflow-hidden bg-blue-700 p-5 shadow-lg flex items-center justify-between">
                <div className="relative z-10 space-y-2.5 max-w-[75%]">
                  <h2 className="text-base font-extrabold text-white leading-tight">
                    Temukan atau laporkan barang kampus
                  </h2>
                  <button
                    type="button"
                    onClick={navigateToReport}
                    className="min-h-11 bg-white text-blue-900 text-xs font-bold px-4 py-2.5 rounded-xl shadow-md hover:bg-blue-50 transition active:scale-95 inline-flex items-center gap-1.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                  >
                    <PackagePlus className="w-4 h-4" />
                    Lapor
                  </button>
                </div>
                <div className="w-16 h-16 opacity-20 shrink-0" aria-hidden="true">
                  <PackageCheck className="w-full h-full text-white" />
                </div>
              </div>
            </div>

            <PwaInstallCard />

            {/* Navigasi Kategori */}
            <div className="px-4 py-2">
              <div className="flex items-start justify-between mb-2 px-1">
                <h3 className="text-xs font-bold text-slate-800 tracking-tight">Kategori</h3>
              </div>
              <div className="flex gap-4 overflow-x-auto no-scrollbar py-2">
                {['Semua', ...categories].map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className="flex flex-col items-center gap-2 min-w-[64px] min-h-11 transition active:scale-90 focus-visible:outline-2 focus-visible:outline-blue-700 rounded-2xl"
                  >
                    <div
                      className={`w-14 h-14 rounded-2xl flex items-center justify-center border-2 transition ${
                        selectedCategory === cat
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'bg-white border-slate-200 text-slate-700'
                      }`}
                    >
                      {cat === 'Semua' ? <Package className="w-6 h-6" /> : getCategoryIcon(cat)}
                    </div>
                    <span
                      className={`text-[11px] font-bold text-center leading-tight ${
                        selectedCategory === cat ? 'text-blue-700' : 'text-slate-600'
                      }`}
                    >
                      {cat === 'Identitas/KTM' ? 'Identitas' : cat}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Pemilih Jenis Laporan (Ditemukan / Hilang) */}
            <div className="px-4 py-4">
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setFeedType('FOUND')}
                  className={`relative overflow-hidden p-4 min-h-11 rounded-2xl border-2 transition-all text-left focus-visible:outline-2 focus-visible:outline-blue-700 ${
                    feedType === 'FOUND'
                      ? 'bg-blue-50 border-blue-600 shadow-md ring-4 ring-blue-50'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex flex-col items-start gap-1">
                    <div
                      className={`p-1.5 rounded-lg ${
                        feedType === 'FOUND' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      <PackageCheck className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-black text-slate-900 mt-1">Ditemukan</span>
                    <span className="text-[10px] font-bold text-slate-600">
                      {activeItems.filter((i) => i.type === 'FOUND').length} Item
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setFeedType('LOST')}
                  className={`relative overflow-hidden p-4 min-h-11 rounded-2xl border-2 transition-all text-left focus-visible:outline-2 focus-visible:outline-blue-700 ${
                    feedType === 'LOST'
                      ? 'bg-rose-50 border-rose-600 shadow-md ring-4 ring-rose-50'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex flex-col items-start gap-1">
                    <div
                      className={`p-1.5 rounded-lg ${
                        feedType === 'LOST' ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      <Search className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-black text-slate-900 mt-1">Hilang</span>
                    <span className="text-[10px] font-bold text-slate-600">
                      {activeItems.filter((i) => i.type === 'LOST').length} Item
                    </span>
                  </div>
                </button>
              </div>
            </div>

            {/* Filter Lokasi Cepat Kampus */}
            <div className="px-4 py-2">
              <div className="flex items-center justify-between mb-1.5 px-0.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                  <Building2 className="w-3.5 h-3.5 text-blue-700" />
                  <span>Titik Lokasi Kampus</span>
                </div>
                {selectedLocation !== 'Semua' && (
                  <button
                    type="button"
                    onClick={() => setSelectedLocation('Semua')}
                    className="min-h-11 px-2 text-xs font-bold text-blue-700 hover:text-blue-800 inline-flex items-center gap-1 focus-visible:outline-2 focus-visible:outline-blue-700 rounded-lg"
                  >
                    Reset Lokasi
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                {['Semua', ...locations].map((loc) => {
                  const count =
                    loc === 'Semua'
                      ? activeItems.filter(
                          (i) =>
                            i.type === feedType &&
                            (selectedCategory === 'Semua' || i.category === selectedCategory)
                        ).length
                      : activeItems.filter(
                          (i) =>
                            i.type === feedType &&
                            (selectedCategory === 'Semua' || i.category === selectedCategory) &&
                            i.location === loc
                        ).length;

                  return (
                    <button
                      key={loc}
                      type="button"
                      onClick={() => setSelectedLocation(loc)}
                      className={`min-h-11 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition border flex items-center gap-1.5 focus-visible:outline-2 focus-visible:outline-blue-700 ${
                        selectedLocation === loc
                          ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                          : 'bg-white border-slate-200 text-slate-800 hover:border-slate-300'
                      }`}
                    >
                      <span>{loc}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                          selectedLocation === loc
                            ? 'bg-white/20 text-white'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* Daftar Barang */}
        <div className="px-4 pt-4 pb-20 lg:pb-0">
          <div className="flex items-center justify-between mb-4 px-1">
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">
              {isSearching
                ? 'Hasil Pencarian'
                : feedType === 'FOUND'
                  ? 'Daftar Temuan'
                  : 'Daftar Kehilangan'}
            </h3>
            <span className="text-[11px] font-bold text-slate-700 bg-slate-200/70 px-2.5 py-0.5 rounded-full uppercase tracking-tighter">
              {filteredItems.length} Hasil
            </span>
          </div>

          {dataError ? (
            <div className="bg-white rounded-3xl p-10 text-center border border-rose-200 shadow-sm">
              <CloudOff className="w-10 h-10 text-rose-500 mx-auto mb-3" />
              <p className="text-sm font-bold text-slate-900">Gagal memuat laporan</p>
              <p className="text-xs text-slate-600 mt-1">
                Periksa koneksi internet Anda, lalu coba lagi.
              </p>
              <button
                type="button"
                onClick={() => void refreshData()}
                className="mt-4 min-h-11 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition active:scale-95 focus-visible:outline-2 focus-visible:outline-blue-700"
              >
                Coba Lagi
              </button>
            </div>
          ) : dataLoading ? (
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {[0, 1, 2, 3].map((n) => (
                <div
                  key={n}
                  className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden animate-pulse"
                >
                  <div className="aspect-square bg-slate-100" />
                  <div className="p-3.5 space-y-2">
                    <div className="h-2.5 w-14 bg-slate-100 rounded-full" />
                    <div className="h-3 w-full bg-slate-100 rounded-full" />
                    <div className="h-2.5 w-20 bg-slate-100 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 sm:p-12 text-center border border-slate-200 shadow-sm space-y-4">
              <div className="w-16 h-16 rounded-3xl bg-blue-50 text-blue-700 flex items-center justify-center mx-auto shadow-inner">
                <PackageSearch className="w-8 h-8 stroke-[1.75]" />
              </div>
              <div className="space-y-1 max-w-sm mx-auto">
                <h4 className="text-sm font-black text-slate-900">
                  {isSearching
                    ? `Hasil pencarian "${searchQuery.trim()}" tidak ditemukan`
                    : selectedLocation !== 'Semua' || selectedCategory !== 'Semua'
                      ? 'Tidak ada barang yang cocok dengan filter'
                      : 'Belum ada laporan barang yang terdaftar'}
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {isSearching
                    ? 'Periksa kembali ejaan kata kunci atau coba gunakan istilah barang yang lebih umum.'
                    : selectedLocation !== 'Semua' || selectedCategory !== 'Semua'
                      ? 'Belum ada laporan barang di kategori atau titik lokasi ini. Coba pilih lokasi lain.'
                      : 'Jadilah yang pertama melaporkan barang temuan atau barang hilang di kampus.'}
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                {(isSearching || selectedLocation !== 'Semua' || selectedCategory !== 'Semua') && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedLocation('Semua');
                      setSelectedCategory('Semua');
                    }}
                    className="min-h-11 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Reset Semua Filter
                  </button>
                )}
                <button
                  type="button"
                  onClick={navigateToReport}
                  className="min-h-11 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-xs flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Laporkan Barang
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredItems.map((item) => {
                const isCurrentlyBlurred = item.isSensitive && !canModerateSensitivity;

                return (
                  <div
                    key={item.id}
                    className="relative flex flex-col bg-white rounded-3xl border border-slate-200 shadow-sm hover:shadow-lg transition-all duration-300 group overflow-hidden"
                  >
                    {/* Kontrol sensor publik khusus Admin/Satpam (saudara tombol kartu agar tidak nested button) */}
                    {canModerateSensitivity && (
                      <button
                        type="button"
                        onClick={async () => {
                          if (sensitivityPendingId) return;
                          setSensitivityPendingId(item.id);
                          await setItemSensitivity(item.id, !item.isSensitive);
                          setSensitivityPendingId(null);
                        }}
                        disabled={sensitivityPendingId !== null}
                        aria-label={
                          item.isSensitive
                            ? `Buka sensor ${item.title}`
                            : `Sensor ${item.title}`
                        }
                        title={
                          item.isSensitive
                            ? 'Buka sensor agar foto tampil ke publik'
                            : 'Sensor foto agar tidak tampil ke publik'
                        }
                        className="absolute top-2 left-2 z-20 min-h-11 min-w-11 inline-flex items-center justify-center rounded-xl bg-slate-900/85 text-white hover:bg-slate-900 disabled:opacity-60 transition focus-visible:outline-2 focus-visible:outline-white"
                      >
                        {sensitivityPendingId === item.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : item.isSensitive ? (
                          <Eye className="w-4 h-4" />
                        ) : (
                          <EyeOff className="w-4 h-4" />
                        )}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => router.push('/barang/' + item.id)}
                      className="flex flex-col flex-1 w-full text-left active:scale-[0.99] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-700 rounded-3xl"
                    >
                      <div className="relative aspect-square w-full overflow-hidden bg-slate-100">
                        {item.photoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.photoUrl}
                            alt={`Foto barang: ${item.title}`}
                            className={`absolute inset-0 w-full h-full object-cover transition-all duration-300 ${
                              isCurrentlyBlurred
                                ? 'blur-md scale-110 select-none'
                                : 'blur-0 scale-100 group-hover:scale-105'
                            }`}
                          />
                        ) : (
                          <ItemVisualIllustration
                            theme={item.visualTheme}
                            isBlurred={isCurrentlyBlurred}
                            category={item.category}
                          />
                        )}

                        <div className="absolute top-2 right-2 scale-90 origin-top-right">
                          <StatusBadge status={item.status} />
                        </div>

                        {isCurrentlyBlurred && (
                          <div className="absolute inset-0 bg-slate-950/65 backdrop-blur-md flex flex-col items-center justify-center p-2 text-center z-10 pointer-events-none">
                            <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300 mb-1">
                              <Lock className="w-4 h-4" />
                            </div>
                            <span className="text-[10px] font-black text-white uppercase tracking-wider">
                              Disensor
                            </span>
                            <span className="text-[10px] text-slate-200 mt-0.5 font-medium">
                              Privasi Identitas
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="p-3.5 flex flex-col flex-1 w-full">
                        <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider truncate mb-1.5">
                          {item.category}
                        </span>

                        <h4 className="text-xs font-black text-slate-900 leading-tight line-clamp-2 group-hover:text-blue-700 transition-colors mb-2 min-h-8">
                          {item.title}
                        </h4>

                        <div className="mt-auto pt-2 space-y-2 border-t border-slate-100 w-full">
                          <div className="flex items-center gap-1 text-slate-600">
                            <MapPin className="w-3 h-3 text-blue-700 shrink-0" />
                            <span className="text-[11px] font-bold truncate">{item.location}</span>
                          </div>

                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1 text-[11px] font-bold text-slate-600">
                              <Clock className="w-3 h-3 shrink-0" />
                              <span>{item.date.split(',')[0]}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Floating Action Button (FAB) Mobile */}
      <div className="fixed bottom-20 right-4 lg:hidden z-30">
        <button
          type="button"
          onClick={navigateToReport}
          className="min-h-11 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-xs px-4 py-3 rounded-2xl shadow-lg shadow-blue-500/30 flex items-center gap-2 border border-blue-500 transition-transform focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          aria-label="Laporkan barang baru"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Lapor Barang</span>
        </button>
      </div>
    </div>
  );
}
