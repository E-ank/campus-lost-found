'use client';

import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Camera,
  CheckCircle2,
  CheckSquare,
  CloudOff,
  Loader2,
  PackageCheck,
  ShieldCheck,
  Square,
  XCircle,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import ClaimStatusBadge from '@/components/ui/ClaimStatusBadge';
import StatusBadge from '@/components/ui/StatusBadge';
import ComplaintQueue from '@/components/ui/ComplaintQueue';
import PhotoCapture from '@/components/ui/PhotoCapture';
import QrScannerModal from '@/components/ui/QrScannerModal';

type SatpamSubTab = 'TITIPAN' | 'KLAIM' | 'SERAH_TERIMA' | 'PENGADUAN';

function parseSatpamTab(tabParam: string | null, ticketParam: string | null): SatpamSubTab {
  const upper = (tabParam || '').toUpperCase();
  if (upper === 'KLAIM') return 'KLAIM';
  if (upper === 'PENGADUAN') return 'PENGADUAN';
  if (upper === 'SERAH_TERIMA' || ticketParam) return 'SERAH_TERIMA';
  return 'TITIPAN';
}

export default function SatpamDashboardView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    currentUser,
    items,
    claims,
    complaints,
    dataError,
    refreshData,
    decideClaim,
    confirmTitipanSatpam,
    completeHandover,
    showToast,
  } = useApp();

  const ticketParam = searchParams.get('tiket');
  const satpamSubTab = parseSatpamTab(searchParams.get('tab'), ticketParam);

  const [submittingHandover, setSubmittingHandover] = useState(false);
  const [busyTitipanId, setBusyTitipanId] = useState<string | null>(null);
  const [busyClaim, setBusyClaim] = useState<{
    claimId: string;
    decision: 'APPROVED' | 'REJECTED';
  } | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  const [ticketDraft, setTicketDraft] = useState<string | null>(null);
  const [ktmVerified, setKtmVerified] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  const ticketCode = ticketDraft !== null ? ticketDraft : (ticketParam ?? '').trim().toUpperCase();

  const selectSubTab = (nextTab: SatpamSubTab, nextTicket?: string) => {
    const params = new URLSearchParams();
    params.set('tab', nextTab);
    if (nextTicket) params.set('tiket', nextTicket);
    router.replace(`/satpam?${params.toString()}`, { scroll: false });
  };

  const titipanItems = useMemo(
    () =>
      items.filter(
        (i) =>
          i.type === 'FOUND' &&
          (i.status === 'Menunggu Diserahkan ke Pos' || i.status === 'Di Pos Satpam')
      ),
    [items]
  );

  const titipanPendingCount = useMemo(
    () => items.filter((i) => i.status === 'Menunggu Diserahkan ke Pos').length,
    [items]
  );

  // Antrean klaim yang menjadi wewenang Pos Satpam (barang temuan yang dititipkan ke Satpam).
  const satpamReviewClaims = useMemo(
    () =>
      claims.filter((c) => {
        const associatedItem = items.find((i) => i.id === c.itemId);
        if (!associatedItem) return c.storageType === 'SATPAM';
        return associatedItem.type === 'FOUND' && associatedItem.storageType === 'SATPAM';
      }),
    [claims, items]
  );

  const pendingClaimCount = useMemo(
    () => satpamReviewClaims.filter((c) => c.status === 'PENDING').length,
    [satpamReviewClaims]
  );

  const approvedClaims = useMemo(
    () =>
      claims.filter((c) => {
        if (c.status !== 'APPROVED' || c.storageType !== 'SATPAM') return false;
        const associatedItem = items.find((i) => i.id === c.itemId);
        if (associatedItem && associatedItem.status === 'Selesai') return false;
        if (associatedItem && associatedItem.type === 'FOUND' && associatedItem.storageType !== 'SATPAM') {
          return false;
        }
        return true;
      }),
    [claims, items]
  );

  const selectedClaim = useMemo(() => {
    const code = ticketCode.trim().toUpperCase();
    if (!code) return null;
    return approvedClaims.find((c) => c.ticketCode?.toUpperCase() === code) || null;
  }, [approvedClaims, ticketCode]);

  const selectedClaimItem = useMemo(
    () => (selectedClaim ? items.find((i) => i.id === selectedClaim.itemId) || null : null),
    [items, selectedClaim]
  );

  const pendingComplaintCount = useMemo(
    () => complaints.filter((c) => c.status === 'Menunggu').length,
    [complaints]
  );

  const handleConfirmTitipan = async (itemId: string) => {
    if (busyTitipanId) return;
    setBusyTitipanId(itemId);
    try {
      await confirmTitipanSatpam(itemId);
    } finally {
      setBusyTitipanId(null);
    }
  };

  const handleDecideClaim = async (claimId: string, decision: 'APPROVED' | 'REJECTED') => {
    if (busyClaim) return;
    if (decision === 'REJECTED') {
      const confirmed = window.confirm(
        'Tolak klaim ini? Keputusan penolakan akan dicatat ke log pengawasan Anti-False Claim.'
      );
      if (!confirmed) return;
    }
    setBusyClaim({ claimId, decision });
    try {
      await decideClaim(claimId, decision);
    } finally {
      setBusyClaim(null);
    }
  };

  return (
    <div className="flex-1 p-4 space-y-4 lg:mx-auto lg:max-w-6xl">
      <div className="bg-emerald-800 rounded-2xl p-4 text-white shadow">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-extrabold">
              {currentUser?.name || 'Petugas Satpam'}
            </h2>
            <p className="text-xs text-emerald-100">
              {currentUser?.department || 'Pos Satpam Kampus'}
            </p>
          </div>
          <ShieldCheck className="w-8 h-8 text-emerald-200" />
        </div>
      </div>

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

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 bg-slate-200 p-1 rounded-xl">
        <button
          type="button"
          onClick={() => selectSubTab('TITIPAN')}
          className={`min-h-11 px-2 rounded-lg text-[11px] font-bold transition ${
            satpamSubTab === 'TITIPAN' ? 'bg-white text-emerald-900 shadow-sm' : 'text-slate-700'
          }`}
        >
          Titipan ({titipanPendingCount})
        </button>
        <button
          type="button"
          onClick={() => selectSubTab('KLAIM')}
          className={`min-h-11 px-2 rounded-lg text-[11px] font-bold transition ${
            satpamSubTab === 'KLAIM' ? 'bg-white text-emerald-900 shadow-sm' : 'text-slate-700'
          }`}
        >
          Klaim ({pendingClaimCount})
        </button>
        <button
          type="button"
          onClick={() => selectSubTab('SERAH_TERIMA')}
          className={`min-h-11 px-2 rounded-lg text-[11px] font-bold transition ${
            satpamSubTab === 'SERAH_TERIMA'
              ? 'bg-white text-emerald-900 shadow-sm'
              : 'text-slate-700'
          }`}
        >
          Serah Terima
        </button>
        <button
          type="button"
          onClick={() => selectSubTab('PENGADUAN')}
          className={`min-h-11 px-2 rounded-lg text-[11px] font-bold transition ${
            satpamSubTab === 'PENGADUAN'
              ? 'bg-white text-emerald-900 shadow-sm'
              : 'text-slate-700'
          }`}
        >
          Pengaduan ({pendingComplaintCount})
        </button>
      </div>

      {/* TAB 1: VERIFIKASI TITIPAN */}
      {satpamSubTab === 'TITIPAN' && (
        <div className="space-y-3">
          {titipanItems.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm text-center space-y-2">
              <PackageCheck className="w-10 h-10 text-slate-400 mx-auto" />
              <p className="text-sm font-bold text-slate-900">Belum ada barang titipan</p>
              <p className="text-xs text-slate-600 max-w-sm mx-auto">
                Laporan barang temuan yang dititipkan ke Pos Satpam akan tampil di daftar ini untuk dikonfirmasi.
              </p>
            </div>
          ) : (
            titipanItems.map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded">
                      Tujuan: {item.securityPost}
                    </span>
                    <h3 className="text-xs font-extrabold text-slate-900 mt-1">{item.title}</h3>
                    <p className="text-[11px] text-slate-600">
                      Pelapor: {item.reporterName} ({item.reporterId})
                    </p>
                  </div>
                  <StatusBadge status={item.status} />
                </div>

                {item.status === 'Menunggu Diserahkan ke Pos' ? (
                  <button
                    type="button"
                    disabled={busyTitipanId !== null}
                    onClick={() => void handleConfirmTitipan(item.id)}
                    className="w-full min-h-11 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white font-bold text-xs py-2.5 rounded-xl shadow-sm flex items-center justify-center gap-1.5 transition"
                  >
                    {busyTitipanId === item.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <PackageCheck className="w-4 h-4" />
                    )}
                    {busyTitipanId === item.id ? 'Menyimpan...' : 'Konfirmasi Barang Diterima di Pos'}
                  </button>
                ) : (
                  <div className="bg-slate-50 p-2.5 rounded-xl text-xs text-slate-700 flex items-center justify-between gap-2">
                    <span>
                      Tersimpan di {item.securityPost && item.securityPost !== '-' ? item.securityPost : 'Pos Satpam'}
                    </span>
                    <button
                      type="button"
                      onClick={() => router.push('/barang/' + item.id)}
                      className="min-h-11 px-2 text-emerald-800 font-bold underline"
                    >
                      Lihat Barang
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 2: VERIFIKASI KLAIM MASUK */}
      {satpamSubTab === 'KLAIM' && (
        <div className="space-y-3">
          {satpamReviewClaims.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm text-center space-y-2">
              <ShieldCheck className="w-10 h-10 text-slate-400 mx-auto" />
              <p className="text-sm font-bold text-slate-900">Belum ada pengajuan klaim Pos Satpam</p>
              <p className="text-xs text-slate-600 max-w-sm mx-auto">
                Klaim kepemilikan atas barang temuan yang dititipkan di Pos Satpam akan muncul di sini.
              </p>
            </div>
          ) : (
            satpamReviewClaims.map((clm) => {
              const relatedItem = items.find((i) => i.id === clm.itemId);
              const effectiveClaimStatus = clm.status;
              const isItemClosedByOther =
                effectiveClaimStatus !== 'SELESAI' && relatedItem?.status === 'Selesai';
              const hasProofUrl = Boolean(
                clm.proofPhotoName && clm.proofPhotoName.startsWith('http')
              );

              return (
                <div
                  key={clm.id}
                  className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-3"
                >
                  <div className="flex items-start justify-between gap-2 border-b border-slate-200 pb-2">
                    <div>
                      <span className="text-[10px] font-bold text-blue-800">
                        Klaim • {clm.createdAt}
                      </span>
                      <h3 className="text-xs font-extrabold text-slate-900">{clm.itemTitle}</h3>
                    </div>
                    <ClaimStatusBadge
                      status={effectiveClaimStatus}
                      isLostFoundReport={relatedItem?.type === 'LOST'}
                    />
                  </div>

                  <div className="text-xs space-y-0.5">
                    <p className="font-bold text-slate-900">
                      Pengklaim: {clm.claimantName} ({clm.claimantId})
                    </p>
                    <p className="text-[11px] text-slate-600">{clm.claimantDept}</p>
                  </div>

                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 space-y-2 text-xs">
                    <div>
                      <p className="text-[10px] font-bold text-slate-600 uppercase">
                        Pertanyaan Rahasia:
                      </p>
                      <p className="font-semibold text-slate-900">{clm.secretQuestion || '-'}</p>
                    </div>

                    {relatedItem?.secretAnswerHint && (
                      <div className="bg-emerald-50 border border-emerald-200 p-2 rounded-lg">
                        <p className="text-[10px] font-bold text-emerald-900 uppercase">
                          Kunci Jawaban Penemu / Cek Fisik:
                        </p>
                        <p className="font-bold text-emerald-950">{relatedItem.secretAnswerHint}</p>
                      </div>
                    )}

                    <div className="bg-blue-50 border border-blue-200 p-2 rounded-lg">
                      <p className="text-[10px] font-bold text-blue-900 uppercase">
                        Jawaban Pengklaim:
                      </p>
                      <p className="font-bold text-blue-950">&quot;{clm.answer}&quot;</p>
                      <p className="text-[11px] text-slate-700 mt-1">
                        Ciri Tambahan: {clm.additionalNotes}
                      </p>
                    </div>

                    {clm.hasProofPhoto && (
                      hasProofUrl && clm.proofPhotoName ? (
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-emerald-800 uppercase flex items-center gap-1">
                            <Camera className="w-3.5 h-3.5" /> Foto Bukti Pendukung:
                          </p>
                          <a
                            href={clm.proofPhotoName}
                            target="_blank"
                            rel="noreferrer"
                            className="block"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={clm.proofPhotoName}
                              alt={`Foto bukti klaim ${clm.claimantName}`}
                              className="w-full max-w-[240px] max-h-44 object-cover rounded-xl border border-slate-200 hover:opacity-95"
                            />
                          </a>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-[11px] text-emerald-800 font-semibold">
                          <Camera className="w-3.5 h-3.5" />
                          <span>Lampiran Bukti: {clm.proofPhotoName}</span>
                        </div>
                      )
                    )}
                  </div>

                  {effectiveClaimStatus === 'PENDING' && !isItemClosedByOther ? (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        disabled={busyClaim !== null}
                        onClick={() => void handleDecideClaim(clm.id, 'APPROVED')}
                        className="min-h-11 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white font-bold text-xs py-2.5 rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition"
                      >
                        {busyClaim?.claimId === clm.id && busyClaim.decision === 'APPROVED' ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4" />
                        )}
                        Setujui Klaim
                      </button>
                      <button
                        type="button"
                        disabled={busyClaim !== null}
                        onClick={() => void handleDecideClaim(clm.id, 'REJECTED')}
                        className="min-h-11 bg-rose-700 hover:bg-rose-800 disabled:opacity-60 text-white font-bold text-xs py-2.5 rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition"
                      >
                        {busyClaim?.claimId === clm.id && busyClaim.decision === 'REJECTED' ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <XCircle className="w-4 h-4" />
                        )}
                        Tolak Klaim
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between text-xs text-slate-700 pt-1">
                      <span>
                        {effectiveClaimStatus === 'SELESAI'
                          ? `Serah terima selesai (${clm.ticketCode || '-'})`
                          : isItemClosedByOther
                            ? 'Laporan barang sudah selesai oleh pengklaim lain'
                            : effectiveClaimStatus === 'APPROVED'
                              ? `Tiket Terbit: ${clm.ticketCode}`
                              : 'Klaim telah ditolak'}
                      </span>
                      {effectiveClaimStatus === 'APPROVED' && !isItemClosedByOther && (
                        <button
                          type="button"
                          onClick={() => {
                            const nextCode = clm.ticketCode ?? '';
                            setTicketDraft(nextCode);
                            selectSubTab('SERAH_TERIMA', nextCode);
                          }}
                          className="min-h-11 px-2 text-emerald-800 font-bold underline"
                        >
                          Lanjut Serah Terima &rarr;
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* TAB 3: SERAH TERIMA FISIK */}
      {satpamSubTab === 'SERAH_TERIMA' && (
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
              <PackageCheck className="w-4 h-4 text-emerald-700" /> Serah Terima Fisik
            </h3>
            {selectedClaim && (
              <span className="text-[10px] font-black text-emerald-900 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                Tiket Ditemukan
              </span>
            )}
          </div>

          {selectedClaim && (
            <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-4 space-y-3 animate-fadeIn">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-950 bg-emerald-200 px-2 py-0.5 rounded">
                  Tiket Terverifikasi &bull; Siap Serah Terima
                </span>
                <span className="text-xs font-mono font-black text-emerald-950">
                  {selectedClaim.ticketCode}
                </span>
              </div>

              <div className="grid sm:grid-cols-2 gap-3 pt-2 border-t border-emerald-200">
                <div>
                  <p className="text-[10px] font-bold text-emerald-900 uppercase tracking-tight">
                    {selectedClaimItem?.type === 'LOST' ? 'Barang Hilang (Temuan)' : 'Barang Temuan'}
                  </p>
                  <p className="text-xs font-black text-slate-900 truncate mt-0.5">{selectedClaim.itemTitle}</p>
                  <p className="text-[11px] text-slate-700">Pos Simpan: {selectedClaim.securityPost}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-emerald-900 uppercase tracking-tight">
                    Penerima / Pengambil (Cek KTM)
                  </p>
                  {selectedClaimItem?.type === 'LOST' ? (
                    <>
                      <p className="text-xs font-black text-slate-900 mt-0.5">
                        {selectedClaimItem.reporterName}
                      </p>
                      <p className="text-[11px] text-slate-700 font-mono">
                        {selectedClaimItem.reporterId} &bull; Penemu: {selectedClaim.claimantName}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-xs font-black text-slate-900 mt-0.5">{selectedClaim.claimantName}</p>
                      <p className="text-[11px] text-slate-700 font-mono">
                        {selectedClaim.claimantId} &bull; {selectedClaim.claimantDept}
                      </p>
                    </>
                  )}
                </div>
              </div>

              {selectedClaim.answer && (
                <div className="bg-white rounded-xl p-2.5 border border-emerald-200 text-xs">
                  <p className="text-[10px] font-bold text-slate-600 uppercase">
                    {selectedClaimItem?.type === 'LOST' ? 'Lokasi Barang Ditemukan:' : 'Jawaban Ciri Barang:'}
                  </p>
                  <p className="text-slate-900 italic mt-0.5">&quot;{selectedClaim.answer}&quot;</p>
                </div>
              )}
            </div>
          )}

          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
            <p className="text-[10px] font-bold text-slate-600 uppercase mb-1.5">
              Tiket Siap Diambil:
            </p>
            {approvedClaims.length === 0 ? (
              <p className="text-xs text-slate-600 italic">Belum ada tiket klaim yang disetujui.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {approvedClaims.map((c) => {
                  const chipItem = items.find((i) => i.id === c.itemId);
                  const chipRecipient =
                    chipItem?.type === 'LOST' ? chipItem.reporterName : c.claimantName;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setTicketDraft(c.ticketCode ?? '')}
                      className={`min-h-11 text-xs font-mono font-bold px-3 py-2 rounded-xl border transition ${
                        ticketCode === c.ticketCode
                          ? 'bg-emerald-700 border-emerald-700 text-white shadow-sm'
                          : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-950 border-emerald-300'
                      }`}
                    >
                      {c.ticketCode} ({chipRecipient.split(' ')[0]})
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (submittingHandover) return;
              setSubmittingHandover(true);
              try {
                const success = await completeHandover({
                  ticketCode,
                  ktmVerified,
                  photoFile,
                });
                if (success) {
                  setTicketDraft(null);
                  setKtmVerified(false);
                  setPhotoFile(null);
                  selectSubTab('SERAH_TERIMA');
                }
              } finally {
                setSubmittingHandover(false);
              }
            }}
            className="space-y-3.5"
          >
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="satpam-ticket-code" className="block text-xs font-bold text-slate-800">
                  Kode Tiket Klaim *
                </label>
                <button
                  type="button"
                  onClick={() => setIsScannerOpen(true)}
                  className="min-h-11 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-900 text-xs font-bold transition active:scale-95 shadow-xs"
                >
                  <Camera className="w-3.5 h-3.5 text-emerald-800" />
                  Buka Kamera Scanner
                </button>
              </div>
              <input
                id="satpam-ticket-code"
                type="text"
                required
                value={ticketCode}
                onChange={(e) => setTicketDraft(e.target.value)}
                placeholder="Scan QR atau masukkan kode (misal: #KLAIM-1234)"
                className="w-full min-h-11 px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono text-xs font-bold uppercase text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <button
              type="button"
              role="checkbox"
              aria-checked={ktmVerified}
              onClick={() => setKtmVerified(!ktmVerified)}
              className={`w-full min-h-11 p-3 rounded-xl border text-left flex items-center gap-2.5 transition focus-visible:outline-2 focus-visible:outline-emerald-700 ${
                ktmVerified
                  ? 'bg-emerald-50 border-emerald-600 text-emerald-950 font-bold'
                  : 'bg-slate-50 border-slate-300 text-slate-800'
              }`}
            >
              {ktmVerified ? (
                <CheckSquare className="w-5 h-5 text-emerald-700 shrink-0" />
              ) : (
                <Square className="w-5 h-5 text-slate-600 shrink-0" />
              )}
              <span className="text-xs">KTM Fisik Sesuai</span>
            </button>

            <div>
              <PhotoCapture
                file={photoFile}
                onChange={setPhotoFile}
                label="Foto Dokumentasi Serah Terima"
                accent="emerald"
                hint="Ambil foto serah terima barang dan pengambil. Maksimal 2 MB."
              />
            </div>

            <button
              type="submit"
              disabled={submittingHandover}
              className="w-full min-h-12 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white font-bold text-xs py-3 rounded-xl shadow-md transition"
            >
              {submittingHandover ? 'Memproses Serah Terima...' : 'Selesaikan Serah Terima'}
            </button>
          </form>
        </div>
      )}

      {satpamSubTab === 'PENGADUAN' && <ComplaintQueue />}

      <QrScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanSuccess={(code) => {
          setTicketDraft(code);
          showToast('Kode Tiket Terpindai', `Tiket ${code} berhasil dimuat ke formulir.`, 'success');
        }}
      />
    </div>
  );
}
