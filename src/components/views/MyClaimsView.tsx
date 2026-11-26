'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Archive,
  Bell,
  CheckCheck,
  CheckCircle2,
  CloudOff,
  ExternalLink,
  KeyRound,
  Loader2,
  Mail,
  Package,
  PackageCheck,
  PackagePlus,
  Pencil,
  Phone,
  ShieldCheck,
  Ticket,
  TimerReset,
  Trash2,
  User,
  XCircle,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import ClaimStatusBadge from '@/components/ui/ClaimStatusBadge';
import StatusBadge from '@/components/ui/StatusBadge';
import StatusStepper from '@/components/ui/StatusStepper';
import TicketBoardingPass from '@/components/ui/TicketBoardingPass';
import { isItemArchived, remainingDays } from '@/lib/supabase/queries';
import {
  type AppNotification,
  getStoredNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  syncNotificationsFromIndexedDB,
} from '@/lib/notifications';
import type { Item } from '@/types';

type RiwayatTab = 'LAPORAN' | 'KLAIM' | 'NOTIFIKASI';

function parseRiwayatTab(param: string | null): RiwayatTab {
  const upper = (param || '').toUpperCase();
  if (upper === 'NOTIFIKASI') return 'NOTIFIKASI';
  if (upper === 'KLAIM') return 'KLAIM';
  return 'LAPORAN';
}

export default function MyClaimsView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentUser, myClaims, myReportedItems, items, dataError, refreshData, deleteReport } =
    useApp();

  const tab = parseRiwayatTab(searchParams.get('tab'));
  const [notifications, setNotifications] = useState<AppNotification[]>(() =>
    getStoredNotifications()
  );
  const [filterUnread, setFilterUnread] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Item | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const selectTab = (nextTab: RiwayatTab) => {
    const query = nextTab === 'LAPORAN' ? '' : `?tab=${nextTab.toLowerCase()}`;
    router.replace(`/klaim${query}`, { scroll: false });
  };

  useEffect(() => {
    if (!currentUser) return;
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
    return () => {
      active = false;
      window.removeEventListener('app_notification_received', handleUpdate);
    };
  }, [currentUser]);

  useEffect(() => {
    if (!pendingDelete) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isDeleting) setPendingDelete(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pendingDelete, isDeleting]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handleConfirmDelete = async () => {
    if (!pendingDelete || isDeleting) return;
    setIsDeleting(true);
    try {
      const removed = await deleteReport(pendingDelete.id);
      if (removed) setPendingDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex-1 p-4 space-y-4 lg:mx-auto lg:max-w-4xl">
      {currentUser && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-4 space-y-3">
          <div className="flex items-center gap-3">
            {currentUser.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={currentUser.avatarUrl}
                alt="Foto profil"
                className="w-16 h-16 rounded-2xl object-cover border border-slate-200 shadow-sm"
              />
            ) : (
              <div className="w-16 h-16 rounded-2xl border-2 border-dashed border-slate-300 flex items-center justify-center bg-slate-50">
                <User className="w-6 h-6 text-slate-500" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-black text-slate-900 truncate">
                {currentUser.name}
              </p>
              <p className="text-[11px] font-bold text-slate-600">
                {currentUser.identifier} • {currentUser.roleLabel}
              </p>
              <p className="text-[11px] text-slate-600 truncate">
                {currentUser.department}
              </p>
            </div>
          </div>

          <div className="bg-slate-50 rounded-2xl border border-slate-200 divide-y divide-slate-200">
            <div className="flex items-center gap-2 px-3 py-2 text-xs text-slate-800">
              <Mail className="w-3.5 h-3.5 text-blue-700 shrink-0" />
              <span className="truncate">{currentUser.emailPersonal || 'Email belum diisi'}</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 text-xs text-slate-800">
              <Phone className="w-3.5 h-3.5 text-blue-700 shrink-0" />
              <span className="truncate">
                {currentUser.phone && currentUser.phone !== '-'
                  ? currentUser.phone
                  : 'Nomor WhatsApp belum diisi'}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => router.push('/akun/pengaturan')}
            className="w-full min-h-11 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition active:scale-95"
          >
            <KeyRound className="w-3.5 h-3.5" /> Pengaturan Akun
          </button>
        </div>
      )}

      {dataError && (
        <div className="bg-white rounded-2xl p-4 border border-rose-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-rose-900 font-semibold">
            <CloudOff className="w-4 h-4 text-rose-700 shrink-0" />
            <span>Sebagian data gagal dimuat. Periksa koneksi Anda.</span>
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

      <div>
        <h2 className="text-sm font-black text-slate-900">Riwayat</h2>
      </div>

      <div className="grid grid-cols-3 gap-1 bg-slate-200 p-1 rounded-xl">
        <button
          type="button"
          onClick={() => selectTab('LAPORAN')}
          className={`min-h-11 py-2 rounded-lg text-[11px] font-bold transition ${
            tab === 'LAPORAN' ? 'bg-white text-blue-800 shadow-sm' : 'text-slate-700'
          }`}
        >
          Laporan ({myReportedItems.length})
        </button>
        <button
          type="button"
          onClick={() => selectTab('KLAIM')}
          className={`min-h-11 py-2 rounded-lg text-[11px] font-bold transition ${
            tab === 'KLAIM' ? 'bg-white text-blue-800 shadow-sm' : 'text-slate-700'
          }`}
        >
          Klaim ({myClaims.length})
        </button>
        <button
          type="button"
          onClick={() => selectTab('NOTIFIKASI')}
          className={`min-h-11 py-2 rounded-lg text-[11px] font-bold transition flex items-center justify-center gap-1.5 ${
            tab === 'NOTIFIKASI' ? 'bg-white text-blue-800 shadow-sm' : 'text-slate-700'
          }`}
        >
          <span>Notifikasi</span>
          {unreadCount > 0 ? (
            <span className="px-1.5 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-black leading-none">
              {unreadCount}
            </span>
          ) : (
            <span className="text-[10px] text-slate-600 font-medium">({notifications.length})</span>
          )}
        </button>
      </div>

      {tab === 'LAPORAN' && (
        <>
          {myReportedItems.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 sm:p-12 text-center border border-slate-200 shadow-sm space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center mx-auto">
                <Package className="w-7 h-7 stroke-[1.75]" />
              </div>
              <div>
                <p className="text-sm font-black text-slate-900">Belum Ada Laporan Barang</p>
                <p className="text-xs text-slate-600 mt-1 max-w-xs mx-auto">
                  Anda belum pernah membuat laporan kehilangan atau barang temuan di portal ini.
                </p>
              </div>
              <button
                type="button"
                onClick={() => router.push('/lapor')}
                className="min-h-11 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition inline-flex items-center gap-1.5 shadow-xs"
              >
                + Buat Laporan Baru
              </button>
            </div>
          ) : (
            myReportedItems.map((item) => {
              const archived = isItemArchived(item);
              const sisaHari = remainingDays(item);

              return (
                <div
                  key={item.id}
                  className="bg-white rounded-3xl p-4 border border-slate-200 shadow-sm space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">
                        {item.type === 'FOUND' ? 'Temuan' : 'Kehilangan'} • {item.category}
                      </span>
                      <h3 className="text-xs font-black text-slate-900 mt-1 uppercase">
                        {item.title}
                      </h3>
                    </div>
                    <StatusBadge status={item.status} />
                  </div>

                  <div className="flex items-center gap-2 text-[10px] font-bold">
                    {archived ? (
                      <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full uppercase">
                        <Archive className="w-3 h-3" /> Di Arsip (Riwayat)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 px-2.5 py-1 rounded-full uppercase">
                        <TimerReset className="w-3 h-3" /> Tampil Publik {sisaHari} Hari Lagi
                      </span>
                    )}
                  </div>

                  <StatusStepper
                    itemType={item.type}
                    storageType={item.storageType}
                    itemStatus={item.status}
                    securityPost={item.securityPost}
                  />

                  {item.status === 'Selesai' ? (
                    <button
                      type="button"
                      onClick={() => router.push('/barang/' + item.id)}
                      className="w-full min-h-11 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition active:scale-95"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> Lihat Detail Serah Terima
                    </button>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => router.push('/barang/' + item.id)}
                        className="min-h-11 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition active:scale-95"
                      >
                        <ExternalLink className="w-3.5 h-3.5" /> Detail
                      </button>
                      <button
                        type="button"
                        onClick={() => router.push('/barang/' + item.id + '/edit')}
                        className="min-h-11 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition active:scale-95"
                      >
                        <Pencil className="w-3.5 h-3.5" /> Sunting
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingDelete(item)}
                        className="min-h-11 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition active:scale-95"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Hapus
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </>
      )}

      {tab === 'KLAIM' && (
        <>
          {myClaims.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 sm:p-12 text-center border border-slate-200 shadow-sm space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center mx-auto">
                <Ticket className="w-7 h-7 stroke-[1.75]" />
              </div>
              <div>
                <p className="text-sm font-black text-slate-900">Belum Ada Pengajuan Klaim</p>
                <p className="text-xs text-slate-600 mt-1 max-w-xs mx-auto">
                  Jika Anda mengenali barang milik Anda di daftar temuan, ajukan klaim untuk mendapatkan tiket pengambilan resmi.
                </p>
              </div>
              <button
                type="button"
                onClick={() => router.push('/')}
                className="min-h-11 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition inline-flex items-center gap-1.5 shadow-xs"
              >
                Cari Barang di Beranda
              </button>
            </div>
          ) : (
            myClaims.map((clm) => {
              const associatedItem = items.find((i) => i.id === clm.itemId);
              const isClaimFinished = clm.status === 'SELESAI';
              const isLostItemReport = associatedItem?.type === 'LOST';
              const itemClosedByOther =
                !isClaimFinished && associatedItem?.status === 'Selesai';
              const resolvedContactPhone = isLostItemReport
                ? associatedItem?.reporterPhone && associatedItem.reporterPhone !== '-'
                  ? associatedItem.reporterPhone
                  : undefined
                : associatedItem?.reporterPhone && associatedItem.reporterPhone !== '-'
                  ? associatedItem.reporterPhone
                  : clm.finderPhone !== '-'
                    ? clm.finderPhone
                    : undefined;

              return (
                <div
                  key={clm.id}
                  className="bg-white rounded-3xl p-4 border border-slate-200 shadow-sm space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">
                        {clm.createdAt}
                      </span>
                      <h3 className="text-xs font-black text-slate-900 mt-0.5 uppercase">
                        {clm.itemTitle}
                      </h3>
                    </div>
                    <ClaimStatusBadge
                      status={clm.status}
                      isLostFoundReport={isLostItemReport}
                    />
                  </div>

                  <div className="bg-slate-50 rounded-2xl p-3 text-xs text-slate-800 space-y-1 border border-slate-200">
                    <p className="text-[10px] font-black text-slate-600 uppercase">
                      {isLostItemReport ? 'Lokasi Penemuan Anda:' : 'Jawaban Anda:'}
                    </p>
                    <p className="italic">&quot;{clm.answer}&quot;</p>
                  </div>

                  <StatusStepper
                    itemType={associatedItem?.type || 'FOUND'}
                    storageType={clm.storageType}
                    itemStatus={
                      associatedItem?.status || (isClaimFinished ? 'Selesai' : 'Di Pos Satpam')
                    }
                    claimStatus={clm.status}
                    securityPost={clm.securityPost}
                  />

                  <button
                    type="button"
                    onClick={() => router.push('/barang/' + clm.itemId)}
                    className="min-h-11 w-full bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition active:scale-95"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Lihat Detail Barang
                  </button>

                  {isClaimFinished ? (
                    <div className="bg-blue-50 rounded-2xl p-4 border border-blue-200 space-y-2.5">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-blue-950">
                        <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                        <span>Barang Telah Berhasil Diserahkan</span>
                      </div>
                      <div className="text-xs text-slate-800 space-y-1">
                        <p>
                          Tiket Pengambilan:{' '}
                          <span className="font-mono font-bold text-slate-900">
                            {clm.ticketCode || '-'}
                          </span>
                        </p>
                        {associatedItem?.handoverInfo && (
                          <>
                            <p>
                              Waktu Penyerahan:{' '}
                              <span className="font-semibold text-slate-900">
                                {associatedItem.handoverInfo.handoverTime}
                              </span>
                            </p>
                            <p>
                              Diverifikasi oleh:{' '}
                              <span className="font-semibold text-slate-900">
                                {associatedItem.handoverInfo.verifiedBy}
                              </span>
                            </p>
                          </>
                        )}
                      </div>
                      {associatedItem?.handoverInfo?.photoUrl && (
                        <div className="pt-1.5 border-t border-blue-200">
                          <p className="text-[10px] font-bold text-slate-600 uppercase mb-1.5">
                            Foto Serah Terima:
                          </p>
                          <a
                            href={associatedItem.handoverInfo.photoUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="block"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={associatedItem.handoverInfo.photoUrl}
                              alt="Foto Serah Terima"
                              className="w-full max-w-[280px] aspect-video object-cover rounded-xl border border-slate-200 hover:opacity-95 transition"
                            />
                          </a>
                        </div>
                      )}
                    </div>
                  ) : itemClosedByOther ? (
                    <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200 text-xs text-slate-700 font-semibold">
                      Laporan barang ini telah selesai diproses dan ditutup.
                    </div>
                  ) : clm.status === 'APPROVED' ? (
                    <TicketBoardingPass
                      ticketCode={clm.ticketCode || ''}
                      itemTitle={clm.itemTitle}
                      category={associatedItem?.category || 'Barang Kampus'}
                      headerLabel={
                        isLostItemReport
                          ? 'Tiket Penyerahan Barang Hilang'
                          : 'Tiket Pengambilan Resmi'
                      }
                      recipientLabel={isLostItemReport ? 'Pemilik Barang' : 'Pemilik Sah'}
                      claimantName={
                        isLostItemReport
                          ? associatedItem?.reporterName || 'Pemilik Barang'
                          : clm.claimantName
                      }
                      claimantId={
                        isLostItemReport ? associatedItem?.reporterId : clm.claimantId
                      }
                      securityPost={clm.securityPost}
                      storageType={clm.storageType}
                      contactCtaLabel={
                        isLostItemReport
                          ? 'Hubungi Pemilik via WhatsApp'
                          : 'Hubungi Penemu via WhatsApp'
                      }
                      finderPhone={clm.storageType === 'FINDER' ? resolvedContactPhone : undefined}
                    />
                  ) : null}
                </div>
              );
            })
          )}
        </>
      )}

      {tab === 'NOTIFIKASI' && (
        <div className="space-y-3">
          <div className="bg-white rounded-2xl border border-slate-200 p-3 shadow-xs flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setFilterUnread(false)}
                className={`min-h-11 px-3.5 py-2 rounded-xl text-xs font-bold transition ${
                  !filterUnread
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                }`}
              >
                Semua ({notifications.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterUnread(true)}
                className={`min-h-11 px-3.5 py-2 rounded-xl text-xs font-bold transition ${
                  filterUnread
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                }`}
              >
                Belum Dibaca ({unreadCount})
              </button>
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  const updated = markAllNotificationsAsRead();
                  setNotifications(updated);
                }}
                className="min-h-11 inline-flex items-center gap-1.5 text-xs font-bold text-blue-800 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 px-3.5 py-2 rounded-xl transition"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Tandai Semua Dibaca
              </button>
            )}
          </div>

          {(() => {
            const displayList = filterUnread
              ? notifications.filter((n) => !n.isRead)
              : notifications;

            if (displayList.length === 0) {
              return (
                <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-sm">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-600">
                    <Bell className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-bold text-slate-900">
                    {filterUnread ? 'Tidak ada notifikasi belum dibaca' : 'Belum ada riwayat notifikasi'}
                  </p>
                  <p className="text-xs text-slate-600 mt-1">
                    Pemberitahuan verifikasi klaim, barang temuan, dan status serah terima akan muncul di sini.
                  </p>
                </div>
              );
            }

            return displayList.map((notif) => {
              const getIcon = () => {
                if (notif.type === 'CLAIM_SUBMITTED') {
                  return <PackagePlus className="w-4 h-4 text-blue-700" />;
                }
                if (notif.type === 'TITIPAN_NEW') {
                  return <ShieldCheck className="w-4 h-4 text-purple-700" />;
                }
                if (notif.type === 'HANDOVER_COMPLETED') {
                  return <PackageCheck className="w-4 h-4 text-emerald-700" />;
                }
                if (notif.title.toLowerCase().includes('ditolak')) {
                  return <XCircle className="w-4 h-4 text-rose-700" />;
                }
                return <CheckCircle2 className="w-4 h-4 text-emerald-700" />;
              };

              return (
                <button
                  key={notif.id}
                  type="button"
                  onClick={() => {
                    if (!notif.isRead) {
                      const updated = markNotificationAsRead(notif.id);
                      setNotifications(updated);
                    }
                    if (notif.url) {
                      router.push(notif.url);
                    }
                  }}
                  className={`w-full text-left bg-white rounded-2xl border p-4 shadow-xs transition hover:shadow-md hover:border-blue-300 flex items-start gap-3.5 focus-visible:outline-2 focus-visible:outline-blue-700 ${
                    !notif.isRead
                      ? 'border-blue-300 bg-blue-50/20 ring-1 ring-blue-100'
                      : 'border-slate-200'
                  }`}
                >
                  <div className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0 mt-0.5">
                    {getIcon()}
                  </div>

                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <h4 className="text-xs font-bold text-slate-900 truncate">
                          {notif.title}
                        </h4>
                        {!notif.isRead && (
                          <span className="px-1.5 py-0.5 rounded-md bg-blue-100 text-blue-900 text-[10px] font-black uppercase shrink-0">
                            Baru
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-600 font-medium shrink-0">
                        {notif.createdAt}
                      </span>
                    </div>

                    <p className="text-xs text-slate-700 leading-relaxed">
                      {notif.body}
                    </p>

                    {notif.url && (
                      <div className="pt-1">
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700">
                          Buka Halaman Terkait &rarr;
                        </span>
                      </div>
                    )}
                  </div>
                </button>
              );
            });
          })()}
        </div>
      )}

      {pendingDelete && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="myclaims-delete-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
          onClick={() => {
            if (!isDeleting) setPendingDelete(null);
          }}
        >
          <div
            className="w-full max-w-sm bg-white rounded-2xl p-5 space-y-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-rose-100 flex items-center justify-center shrink-0">
                <Trash2 className="w-4 h-4 text-rose-700" />
              </div>
              <div>
                <h3 id="myclaims-delete-title" className="text-sm font-extrabold text-slate-900">
                  Hapus Laporan?
                </h3>
                <p className="text-xs text-slate-700 mt-1 leading-relaxed">
                  Laporan &quot;{pendingDelete.title}&quot; akan dihapus permanen beserta seluruh klaim terkait. Tindakan ini tidak dapat dibatalkan.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setPendingDelete(null)}
                className="flex-1 min-h-11 text-xs font-bold text-slate-800 bg-slate-100 hover:bg-slate-200 py-2.5 rounded-xl transition disabled:opacity-60"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="flex-1 min-h-11 inline-flex items-center justify-center gap-1.5 text-xs font-bold text-white bg-rose-700 hover:bg-rose-800 py-2.5 rounded-xl transition disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {isDeleting ? 'Menghapus...' : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
