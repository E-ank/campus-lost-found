'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  Camera,
  CheckCircle2,
  ChevronLeft,
  Clock,
  Eye,
  EyeOff,
  Flag,
  HelpCircle,
  Loader2,
  Lock,
  MapPin,
  Pencil,
  Phone,
  ShieldCheck,
  Ticket,
  Trash2,
  Unlock,
  User,
  UserCheck,
  UserX,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import ClaimStatusBadge from '@/components/ui/ClaimStatusBadge';
import StatusBadge from '@/components/ui/StatusBadge';
import StatusStepper from '@/components/ui/StatusStepper';
import TicketBoardingPass from '@/components/ui/TicketBoardingPass';
import ItemVisualIllustration from '@/components/ui/ItemVisualIllustration';
import PhotoCapture from '@/components/ui/PhotoCapture';
import { requiresStudentIdentityVerification, SECURITY_POST_OPTIONS } from '@/lib/campus';
import { whatsAppHref } from '@/lib/whatsapp';
import type { ClaimFormState, FoundReportFormState } from '@/types';

const EMPTY_CLAIM_FORM: ClaimFormState = {
  answer: '',
  additionalNotes: '',
  proofPhotoFile: null,
};

const EMPTY_FOUND_REPORT_FORM: FoundReportFormState = {
  foundLocation: '',
  notes: '',
  handoverMethod: 'SATPAM',
  securityPost: SECURITY_POST_OPTIONS[0],
  proofPhotoFile: null,
};

export default function DetailView() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const {
    currentUser,
    items,
    claims,
    dataLoading,
    pendingClaimItemId,
    clearPendingClaim,
    openLoginGate,
    submitClaim,
    submitFoundReport,
    decideClaim,
    completeFinderHandover,
    deleteReport,
    reportSpamItem,
    showToast,
  } = useApp();

  const item = items.find((i) => i.id === params.id);

  const [claimModalOpen, setClaimModalOpen] = useState(false);
  const [foundModalOpen, setFoundModalOpen] = useState(false);
  const [foundForm, setFoundForm] = useState<FoundReportFormState>(EMPTY_FOUND_REPORT_FORM);
  const [submittingFoundReport, setSubmittingFoundReport] = useState(false);
  const [submittingClaim, setSubmittingClaim] = useState(false);
  const [decidingClaim, setDecidingClaim] = useState<{
    claimId: string;
    decision: 'APPROVED' | 'REJECTED';
  } | null>(null);
  const [finishingHandoverId, setFinishingHandoverId] = useState<string | null>(null);
  const [reportingSpam, setReportingSpam] = useState(false);
  const [isRevealed, setIsRevealed] = useState(false);
  const [claimForm, setClaimForm] = useState<ClaimFormState>(EMPTY_CLAIM_FORM);
  const [finderPhotos, setFinderPhotos] = useState<Record<string, File | null>>({});
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const isReporter = Boolean(currentUser && item && currentUser.id === item.reporterUserId);
  const isAuthority = currentUser?.role === 'SATPAM' || currentUser?.role === 'SUPERADMIN';

  // Prioritaskan klaim aktif (SELESAI/APPROVED/PENDING) daripada klaim ditolak sebelumnya.
  const myClaimsForItem = claims.filter(
    (c) => c.itemId === item?.id && c.claimantUserId === currentUser?.id
  );
  const myClaim =
    myClaimsForItem.find((c) => c.status === 'SELESAI') ??
    myClaimsForItem.find((c) => c.status === 'APPROVED') ??
    myClaimsForItem.find((c) => c.status === 'PENDING') ??
    myClaimsForItem[0];

  const isApprovedClaimant = myClaim?.status === 'APPROVED' || myClaim?.status === 'SELESAI';
  const canToggleSensor = isReporter || isAuthority || isApprovedClaimant;

  useEffect(() => {
    if (!deleteConfirmOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isDeleting) setDeleteConfirmOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [deleteConfirmOpen, isDeleting]);

  const handleDeleteItem = async () => {
    if (!item || isDeleting) return;
    setIsDeleting(true);
    try {
      const removed = await deleteReport(item.id);
      if (removed) {
        setDeleteConfirmOpen(false);
        router.push('/');
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDecideClaim = async (claimId: string, decision: 'APPROVED' | 'REJECTED') => {
    if (decidingClaim) return;
    if (decision === 'REJECTED') {
      const confirmed = window.confirm(
        'Tolak pengajuan ini? Keputusan penolakan akan dicatat pada log pengawasan Anti-False Claim.'
      );
      if (!confirmed) return;
    }
    setDecidingClaim({ claimId, decision });
    try {
      await decideClaim(claimId, decision);
    } finally {
      setDecidingClaim(null);
    }
  };

  const handleFinishHandover = async (claimId: string) => {
    if (finishingHandoverId) return;
    setFinishingHandoverId(claimId);
    try {
      await completeFinderHandover(claimId, finderPhotos[claimId] ?? null);
    } finally {
      setFinishingHandoverId(null);
    }
  };

  const openClaimFromQuery = searchParams?.get('openClaim') === '1';
  const canOpenClaimForm = Boolean(
    currentUser &&
      item &&
      item.type === 'FOUND' &&
      item.status !== 'Selesai' &&
      !isReporter &&
      (!myClaim || myClaim.status === 'REJECTED') &&
      (!requiresStudentIdentityVerification(currentUser.role) || currentUser.ktmVerified)
  );
  const isClaimFormOpen =
    canOpenClaimForm &&
    (claimModalOpen || pendingClaimItemId === item?.id || openClaimFromQuery);

  const closeClaimForm = () => {
    setClaimModalOpen(false);
    if (pendingClaimItemId) clearPendingClaim();
    if (openClaimFromQuery && item) {
      router.replace(`/barang/${item.id}`, { scroll: false });
    }
  };

  if (!item) {
    if (dataLoading) {
      return (
        <div className="flex-1 p-4 lg:mx-auto lg:max-w-3xl">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-3 animate-pulse">
            <div className="h-40 bg-slate-100 rounded-xl" />
            <div className="h-3 w-2/3 bg-slate-100 rounded-full" />
            <div className="h-3 w-1/3 bg-slate-100 rounded-full" />
          </div>
        </div>
      );
    }

    return (
      <div className="flex-1 p-4 lg:mx-auto lg:max-w-3xl">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 text-center space-y-4">
          <p className="text-sm font-semibold text-slate-800">
            Barang tidak ditemukan atau sudah dihapus.
          </p>
          <button
            type="button"
            onClick={() => router.push('/')}
            className="w-full min-h-11 bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs py-3 rounded-xl shadow-md transition"
          >
            Kembali ke Beranda
          </button>
        </div>
      </div>
    );
  }

  const ownerWhatsAppHref = whatsAppHref(
    item.reporterPhone,
    `Halo ${item.reporterName}, saya menemukan barang yang Anda laporkan hilang: "${item.title}". Saya ingin mengembalikannya.`
  );

  const existingClaimsForItem = claims.filter((c) => c.itemId === item.id);

  return (
    <div className="flex-1 p-4 space-y-4 lg:mx-auto lg:max-w-3xl">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => router.push('/')}
          className="inline-flex items-center gap-1 min-h-11 px-1 text-xs font-semibold text-slate-700 hover:text-blue-700 rounded-lg focus-visible:outline-2 focus-visible:outline-blue-700"
        >
          <ChevronLeft className="w-4 h-4" /> Kembali ke Daftar
        </button>
        <StatusBadge status={item.status} />
      </div>

      {/* Aksi pemilik laporan (terkunci setelah serah terima selesai) */}
      {isReporter && item.status !== 'Selesai' && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => router.push(`/barang/${item.id}/edit`)}
            className="flex-1 min-h-11 inline-flex items-center justify-center gap-1.5 text-xs font-bold text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 py-2.5 rounded-xl transition"
          >
            <Pencil className="w-3.5 h-3.5" /> Sunting Laporan
          </button>
          <button
            type="button"
            onClick={() => setDeleteConfirmOpen(true)}
            className="flex-1 min-h-11 inline-flex items-center justify-center gap-1.5 text-xs font-bold text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 py-2.5 rounded-xl transition"
          >
            <Trash2 className="w-3.5 h-3.5" /> Hapus
          </button>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="relative overflow-hidden bg-slate-900 aspect-[4/3] w-full">
          {item.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.photoUrl}
              alt={`Foto barang: ${item.title}`}
              className={`w-full h-full object-cover transition-all duration-300 ${
                item.isSensitive && !isRevealed && !isAuthority
                  ? 'blur-xl scale-110 select-none pointer-events-none'
                  : 'blur-0 scale-100'
              }`}
            />
          ) : (
            <ItemVisualIllustration
              theme={item.visualTheme}
              isBlurred={item.isSensitive && !isRevealed && !isAuthority}
              category={item.category}
            />
          )}

          {item.isSensitive && !isRevealed && !isAuthority && (
            <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-10">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300 mb-2.5 shadow-lg shadow-amber-950/40">
                <Lock className="w-6 h-6 stroke-[2]" />
              </div>
              <h3 className="text-xs font-black text-white uppercase tracking-wider mb-1">
                Data Identitas Disensor demi Privasi
              </h3>
              <p className="text-[11px] text-slate-200 max-w-xs leading-relaxed mb-3">
                Informasi penting seperti NIK, foto wajah, atau nomor kartu disamarkan untuk melindungi privasi pemilik.
              </p>
              {canToggleSensor ? (
                <button
                  type="button"
                  onClick={() => setIsRevealed(true)}
                  className="min-h-11 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition active:scale-95 shadow-md"
                >
                  <Eye className="w-4 h-4" />
                  Buka Sensor Foto (Akses Berwenang)
                </button>
              ) : (
                <span className="text-[11px] text-amber-200 bg-amber-950/70 border border-amber-800/60 px-3 py-1.5 rounded-xl font-medium">
                  Hanya penemu &amp; petugas berwenang yang dapat membuka foto
                </span>
              )}
            </div>
          )}

          {item.isSensitive && isRevealed && (
            <div className="absolute top-3 left-3 z-20">
              <button
                type="button"
                onClick={() => setIsRevealed(false)}
                className="min-h-11 px-3.5 py-2 rounded-xl bg-slate-900/90 hover:bg-slate-900 text-white font-bold text-xs flex items-center gap-1.5 backdrop-blur-sm border border-white/20 transition active:scale-95 shadow-md"
              >
                <EyeOff className="w-3.5 h-3.5 text-amber-300" />
                Tutup Sensor Foto
              </button>
            </div>
          )}
        </div>

        <div className="p-4 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-800 bg-blue-50 px-2 py-0.5 rounded">
                {item.type === 'FOUND' ? 'Temuan' : 'Kehilangan'} • {item.category}
              </span>
              <h2 className="text-base font-extrabold text-slate-900 mt-1.5">
                {item.title}
              </h2>
            </div>
            {currentUser && !isReporter && item.status !== 'Selesai' && (
              item.isSpamReported ? (
                <span className="text-[10px] font-bold text-amber-900 bg-amber-100 border border-amber-200 px-2.5 py-1 rounded-xl shrink-0">
                  Dilaporkan ke Admin
                </span>
              ) : (
                <button
                  type="button"
                  disabled={reportingSpam}
                  onClick={async () => {
                    if (reportingSpam) return;
                    const ok = window.confirm('Laporkan postingan ini sebagai spam atau tidak pantas ke Admin?');
                    if (!ok) return;
                    setReportingSpam(true);
                    await reportSpamItem(item.id);
                    setReportingSpam(false);
                  }}
                  title="Laporkan spam / tidak pantas"
                  className="min-h-11 px-3 rounded-xl border border-slate-200 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 text-slate-700 text-[11px] font-bold inline-flex items-center gap-1.5 shrink-0 transition disabled:opacity-60"
                >
                  <Flag className="w-3.5 h-3.5" />
                  <span>{reportingSpam ? 'Mengirim...' : 'Laporkan'}</span>
                </button>
              )
            )}
          </div>

          <StatusStepper
            itemType={item.type}
            storageType={item.storageType}
            itemStatus={item.status}
            claimStatus={
              claims.find(
                (c) =>
                  c.itemId === item.id &&
                  (c.claimantUserId === currentUser?.id ||
                    c.status === 'APPROVED' ||
                    c.status === 'SELESAI')
              )?.status
            }
            securityPost={item.securityPost}
          />

          <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
            <div>
              <p className="text-[10px] text-slate-600 font-semibold uppercase">Lokasi</p>
              <p className="font-bold text-slate-900 flex items-center gap-1 mt-0.5">
                <MapPin className="w-3.5 h-3.5 text-blue-700" /> {item.location}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-slate-600 font-semibold uppercase">Waktu</p>
              <p className="font-bold text-slate-900 flex items-center gap-1 mt-0.5">
                <Clock className="w-3.5 h-3.5 text-blue-700" /> {item.date}
              </p>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-bold text-slate-800 mb-1">Deskripsi</h4>
            <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-200">
              {item.description}
            </p>
          </div>

          {(() => {
            const reporterInitial = (item.reporterName || 'P').trim().charAt(0).toUpperCase();
            const reporterAvatar = item.reporterAvatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.reporterAvatarUrl}
                alt={`Foto profil ${item.reporterName}`}
                className="w-7 h-7 rounded-full object-cover border border-slate-200 shrink-0"
              />
            ) : (
              <span
                aria-hidden="true"
                className="w-7 h-7 rounded-full bg-blue-100 text-blue-800 border border-blue-200 text-xs font-bold inline-flex items-center justify-center shrink-0"
              >
                {reporterInitial}
              </span>
            );

            if (item.type === 'FOUND') {
              return (
                <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-3 space-y-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-700">Penyimpanan:</span>
                    <span className="font-bold text-blue-900 text-right">
                      {item.storageType === 'SATPAM' ? item.securityPost : 'Di Penemu'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-700 shrink-0">Pelapor:</span>
                    <div className="flex items-center gap-2 min-w-0">
                      {reporterAvatar}
                      <span className="font-semibold text-slate-900 truncate">
                        {item.reporterName}
                      </span>
                    </div>
                  </div>
                  <div className="pt-1.5 border-t border-blue-200/60 flex items-center gap-1.5 text-[11px] text-blue-900">
                    <Lock className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                    <span>
                      {item.storageType === 'SATPAM'
                        ? 'Verifikasi kepemilikan dan pengambilan barang dilakukan di Pos Satpam melalui tiket resmi.'
                        : 'Kontak penemu dibuka setelah klaim disetujui.'}
                    </span>
                  </div>
                </div>
              );
            }

            return (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-700 shrink-0">Pelapor:</span>
                  <div className="flex items-center gap-2 min-w-0">
                    {reporterAvatar}
                    <span className="font-semibold text-slate-900 truncate">
                      {item.reporterName}
                    </span>
                  </div>
                </div>
                <div className="pt-1.5 border-t border-slate-200 flex items-center gap-1.5 text-[11px] text-slate-700">
                  <Lock className="w-3.5 h-3.5 text-rose-700 shrink-0" />
                  <span>Kontak pemilik dibuka setelah laporan temuan Anda dikonfirmasi oleh pemilik.</span>
                </div>
              </div>
            );
          })()}

          {item.status === 'Selesai' && item.handoverInfo && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 space-y-1">
              <div className="flex items-center gap-1.5 text-emerald-900 font-bold text-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                <span>Telah Dikembalikan</span>
              </div>
              <p className="text-[11px] text-emerald-900">
                Penerima: <strong>{item.handoverInfo.claimedBy}</strong>
              </p>
              <p className="text-[11px] text-emerald-800">
                Tiket {item.handoverInfo.ticketCode} • Verifikasi {item.handoverInfo.verifiedBy}
              </p>
              {item.handoverInfo.photoUrl && (
                <a href={item.handoverInfo.photoUrl} target="_blank" rel="noreferrer" className="block pt-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.handoverInfo.photoUrl}
                    alt="Dokumentasi serah terima"
                    className="w-full max-w-[240px] aspect-video object-cover rounded-lg border border-emerald-200 hover:opacity-90"
                  />
                </a>
              )}
            </div>
          )}

          {/* Informasi untuk Pelapor barang titipan Pos Satpam */}
          {isReporter && item.type === 'FOUND' && item.storageType === 'SATPAM' && item.status !== 'Selesai' && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3.5 text-xs text-blue-950 space-y-1">
              <p className="font-bold flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-blue-700 shrink-0" />
                Ditangani oleh {item.securityPost}
              </p>
              <p className="text-[11px] text-blue-900 leading-relaxed">
                Klaim untuk barang yang dititipkan di Pos Satpam akan diverifikasi dan diserahterimakan langsung oleh petugas Satpam.
              </p>
            </div>
          )}

          {/* Panel Verifikasi Penemu (FOUND & FINDER) */}
          {isReporter && item.type === 'FOUND' && item.storageType === 'FINDER' && item.status !== 'Selesai' && (
            <div className="space-y-4 pt-2">
              <div className="bg-slate-900 rounded-2xl p-4 shadow-lg border border-slate-800">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center">
                    <UserCheck className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-white uppercase tracking-wider">
                      Verifikasi Klaim Penemu
                    </h3>
                  </div>
                </div>

                {existingClaimsForItem.length === 0 ? (
                  <div className="text-center py-6 bg-slate-800/70 rounded-xl border border-slate-700">
                    <p className="text-[11px] font-bold text-slate-300 uppercase">
                      Belum ada klaim masuk
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {existingClaimsForItem.map((clm) => {
                      const hasProofUrl = Boolean(
                        clm.proofPhotoName && clm.proofPhotoName.startsWith('http')
                      );
                      return (
                        <div
                          key={clm.id}
                          className="bg-white rounded-xl p-3 border border-slate-200 space-y-2.5 shadow-sm"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                                <User className="w-3.5 h-3.5 text-slate-700" />
                              </div>
                              <span className="text-xs font-black text-slate-900 truncate">
                                {clm.claimantName}
                              </span>
                            </div>
                            <ClaimStatusBadge status={clm.status} />
                          </div>

                          <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-200 space-y-1">
                            <p className="text-[10px] font-black text-slate-600 uppercase">
                              Jawaban Verifikasi:
                            </p>
                            <p className="text-xs text-slate-800 italic">
                              &quot;{clm.answer}&quot;
                            </p>
                            {clm.additionalNotes &&
                              clm.additionalNotes !== 'Tidak ada catatan tambahan.' && (
                                <p className="text-[11px] text-slate-700">
                                  <strong>Catatan:</strong> {clm.additionalNotes}
                                </p>
                              )}
                          </div>

                          {hasProofUrl && clm.proofPhotoName && (
                            <a
                              href={clm.proofPhotoName}
                              target="_blank"
                              rel="noreferrer"
                              className="block overflow-hidden rounded-xl border border-slate-200 bg-slate-100"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={clm.proofPhotoName}
                                alt={`Foto bukti klaim ${clm.claimantName}`}
                                className="w-full max-h-48 object-cover hover:opacity-95 transition"
                              />
                            </a>
                          )}

                          {clm.status === 'PENDING' && (
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                disabled={decidingClaim !== null}
                                onClick={() => void handleDecideClaim(clm.id, 'APPROVED')}
                                className="min-h-11 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition shadow-sm"
                              >
                                {decidingClaim?.claimId === clm.id && decidingClaim.decision === 'APPROVED' ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <UserCheck className="w-3.5 h-3.5" />
                                )}
                                Setuju
                              </button>
                              <button
                                type="button"
                                disabled={decidingClaim !== null}
                                onClick={() => void handleDecideClaim(clm.id, 'REJECTED')}
                                className="min-h-11 bg-rose-50 hover:bg-rose-100 disabled:opacity-60 text-rose-800 border border-rose-200 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition"
                              >
                                {decidingClaim?.claimId === clm.id && decidingClaim.decision === 'REJECTED' ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <UserX className="w-3.5 h-3.5" />
                                )}
                                Tolak
                              </button>
                            </div>
                          )}

                          {clm.status === 'APPROVED' && item.storageType === 'FINDER' && (
                            <div className="space-y-2">
                              <PhotoCapture
                                file={finderPhotos[clm.id] ?? null}
                                onChange={(f) =>
                                  setFinderPhotos({ ...finderPhotos, [clm.id]: f })
                                }
                                label="Foto Dokumentasi Serah Terima"
                                accent="slate"
                                previewMax="max-w-[150px]"
                                hint="Wajib foto bukti serah terima. Kamera depan/belakang atau galeri. JPG/PNG/WebP maks 2 MB."
                              />
                              <button
                                type="button"
                                onClick={() => void handleFinishHandover(clm.id)}
                                disabled={!finderPhotos[clm.id] || finishingHandoverId !== null}
                                className="min-h-11 w-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                {finishingHandoverId === clm.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="w-4 h-4" />
                                )}
                                {finishingHandoverId === clm.id
                                  ? 'Menyimpan...'
                                  : 'Barang Sudah Diserahkan'}
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Panel Pemilik Barang Hilang (LOST) */}
          {isReporter && item.type === 'LOST' && item.status !== 'Selesai' && (
            <div className="space-y-4 pt-2">
              <div className="bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-800">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-xl bg-rose-600 flex items-center justify-center">
                    <UserCheck className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-white uppercase tracking-wider">
                      Laporan Penemuan Masuk
                    </h3>
                    <p className="text-[11px] text-slate-300">
                      Periksa foto bukti sebelum mengonfirmasi agar kontak Anda tetap aman.
                    </p>
                  </div>
                </div>

                {existingClaimsForItem.length === 0 ? (
                  <div className="text-center py-6 bg-slate-800/70 rounded-xl border border-slate-700">
                    <p className="text-xs font-bold text-slate-200">
                      Belum ada laporan penemuan masuk
                    </p>
                    <p className="text-[11px] text-slate-300 mt-1">
                      Notifikasi akan muncul jika ada civitas kampus yang melaporkan menemukan barang ini.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {existingClaimsForItem.map((clm) => {
                      const finderInitial = (clm.claimantName || 'P').trim().charAt(0).toUpperCase();
                      const finderContactHref = whatsAppHref(
                        clm.finderPhone,
                        `Halo ${clm.claimantName}, saya pemilik barang "${item.title}" yang Anda temukan. Terima kasih, mari atur waktu pengambilan di kampus.`
                      );
                      const hasProofUrl = Boolean(
                        clm.proofPhotoName && clm.proofPhotoName.startsWith('http')
                      );

                      return (
                        <div
                          key={clm.id}
                          className="bg-white rounded-xl p-3.5 border border-slate-200 space-y-3 shadow-sm"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                              {clm.claimantAvatarUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={clm.claimantAvatarUrl}
                                  alt={`Foto profil ${clm.claimantName}`}
                                  className="w-8 h-8 rounded-full object-cover border border-slate-200 shrink-0"
                                />
                              ) : (
                                <span
                                  aria-hidden="true"
                                  className="w-8 h-8 rounded-full bg-blue-100 text-blue-800 border border-blue-200 text-xs font-bold inline-flex items-center justify-center shrink-0"
                                >
                                  {finderInitial}
                                </span>
                              )}
                              <div className="min-w-0">
                                <p className="text-xs font-extrabold text-slate-900 truncate">
                                  {clm.claimantName}
                                </p>
                                <p className="text-[11px] text-slate-600 font-mono truncate">
                                  {clm.claimantId} · {clm.claimantDept}
                                </p>
                              </div>
                            </div>
                            <ClaimStatusBadge status={clm.status} isLostFoundReport />
                          </div>

                          {hasProofUrl && clm.proofPhotoName && (
                            <a
                              href={clm.proofPhotoName}
                              target="_blank"
                              rel="noreferrer"
                              className="block overflow-hidden rounded-xl border border-slate-200 bg-slate-100"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={clm.proofPhotoName}
                                alt="Foto bukti barang temuan"
                                className="w-full max-h-56 object-cover hover:opacity-95 transition"
                              />
                            </a>
                          )}

                          <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-200 space-y-1 text-xs">
                            <p className="text-slate-800">
                              <strong>Lokasi ditemukan:</strong> {clm.answer}
                            </p>
                            {clm.additionalNotes &&
                              clm.additionalNotes !== 'Tidak ada catatan tambahan.' && (
                                <p className="text-slate-700">
                                  <strong>Catatan:</strong> {clm.additionalNotes}
                                </p>
                              )}
                            <p className="text-slate-800">
                              <strong>Serah terima:</strong>{' '}
                              {clm.storageType === 'SATPAM'
                                ? `Dititipkan di ${clm.securityPost}`
                                : 'Serah terima langsung di kampus'}
                            </p>
                          </div>

                          {clm.status === 'PENDING' && (
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                disabled={decidingClaim !== null}
                                onClick={() => void handleDecideClaim(clm.id, 'APPROVED')}
                                className="min-h-11 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition"
                              >
                                {decidingClaim?.claimId === clm.id && decidingClaim.decision === 'APPROVED' ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <UserCheck className="w-3.5 h-3.5" />
                                )}
                                Benar, Barang Saya
                              </button>
                              <button
                                type="button"
                                disabled={decidingClaim !== null}
                                onClick={() => void handleDecideClaim(clm.id, 'REJECTED')}
                                className="min-h-11 bg-rose-50 hover:bg-rose-100 disabled:opacity-60 text-rose-800 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition border border-rose-200"
                              >
                                {decidingClaim?.claimId === clm.id && decidingClaim.decision === 'REJECTED' ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <UserX className="w-3.5 h-3.5" />
                                )}
                                Bukan Barang Saya
                              </button>
                            </div>
                          )}

                          {clm.status === 'APPROVED' && (
                            <div className="space-y-2.5 pt-1">
                              {clm.storageType === 'SATPAM' ? (
                                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-950 space-y-1">
                                  <p className="font-bold flex items-center gap-1.5">
                                    <Ticket className="w-4 h-4 text-blue-700" />
                                    Kode Tiket Pengambilan: <span className="font-mono">{clm.ticketCode}</span>
                                  </p>
                                  <p>
                                    Ambil barang di <strong>{clm.securityPost}</strong> dengan menunjukkan KTM/SIAKAD dan kode tiket ini.
                                  </p>
                                </div>
                              ) : finderContactHref ? (
                                <a
                                  href={finderContactHref}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="min-h-11 w-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition"
                                >
                                  <Phone className="w-4 h-4" /> Hubungi Penemu via WhatsApp
                                </a>
                              ) : null}

                              <PhotoCapture
                                file={finderPhotos[clm.id] ?? null}
                                onChange={(f) =>
                                  setFinderPhotos({ ...finderPhotos, [clm.id]: f })
                                }
                                label="Foto Bukti Penerimaan Barang"
                                accent="slate"
                                previewMax="max-w-[160px]"
                                hint="Unggah foto serah terima setelah barang kembali ke tangan Anda."
                              />
                              <button
                                type="button"
                                onClick={() => void handleFinishHandover(clm.id)}
                                disabled={!finderPhotos[clm.id] || finishingHandoverId !== null}
                                className="min-h-11 w-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                {finishingHandoverId === clm.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="w-4 h-4" />
                                )}
                                {finishingHandoverId === clm.id
                                  ? 'Menyimpan...'
                                  : 'Barang Sudah Saya Terima (Selesai)'}
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Pengunjung / Penemu Barang Hilang (LOST) */}
          {!isReporter && item.type === 'LOST' && (
            <div className="space-y-3 pt-1">
              {myClaim && (
                <div
                  className={`rounded-2xl p-4 border space-y-3 ${
                    myClaim.status === 'APPROVED' || myClaim.status === 'SELESAI'
                      ? 'bg-emerald-50 border-emerald-300'
                      : myClaim.status === 'REJECTED'
                        ? 'bg-rose-50 border-rose-300'
                        : 'bg-amber-50 border-amber-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-extrabold text-slate-900">
                      Status Laporan Penemuan Anda:
                    </span>
                    <ClaimStatusBadge status={myClaim.status} isLostFoundReport />
                  </div>

                  <div className="bg-white/90 rounded-xl p-3 border border-slate-200 space-y-2 text-xs">
                    {myClaim.proofPhotoName?.startsWith('http') && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={myClaim.proofPhotoName}
                        alt="Foto bukti yang Anda kirim"
                        className="w-full max-h-44 object-cover rounded-lg border border-slate-200"
                      />
                    )}
                    <p className="text-slate-800">
                      <strong>Lokasi ditemukan:</strong> {myClaim.answer}
                    </p>
                    <p className="text-slate-700">
                      <strong>Metode serah terima:</strong>{' '}
                      {myClaim.storageType === 'SATPAM'
                        ? `Titip di ${myClaim.securityPost}`
                        : 'Serahkan langsung ke pemilik'}
                    </p>
                  </div>

                  {myClaim.status === 'SELESAI' ? (
                    <div className="bg-blue-50 rounded-xl p-3 border border-blue-200 text-xs text-blue-950 flex items-center gap-2 font-bold">
                      <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                      <span>Barang telah kembali ke pemilik. Terima kasih telah membantu.</span>
                    </div>
                  ) : item.status === 'Selesai' ? (
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 text-xs text-slate-700 font-semibold">
                      Laporan barang hilang ini sudah selesai diproses oleh pemilik.
                    </div>
                  ) : myClaim.status === 'APPROVED' ? (
                    myClaim.storageType === 'SATPAM' ? (
                      <div className="bg-white rounded-xl p-3 border border-emerald-200 text-xs text-slate-800 space-y-1.5">
                        <p className="font-bold text-emerald-900 flex items-center gap-1.5">
                          <Unlock className="w-4 h-4 text-emerald-700" />
                          Pemilik mengonfirmasi barangnya!
                        </p>
                        <p>
                          Silakan titipkan barang di <strong>{myClaim.securityPost}</strong> dan sebutkan kode tiket{' '}
                          <strong className="font-mono text-slate-900">{myClaim.ticketCode}</strong> kepada petugas Satpam.
                        </p>
                      </div>
                    ) : ownerWhatsAppHref ? (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-emerald-900 flex items-center gap-1.5">
                          <Unlock className="w-4 h-4 text-emerald-700 shrink-0" />
                          Pemilik telah mengonfirmasi! Kontak WhatsApp pemilik kini dibuka:
                        </p>
                        <a
                          href={ownerWhatsAppHref}
                          target="_blank"
                          rel="noreferrer"
                          className="min-h-12 w-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-sm flex items-center justify-center gap-2 transition"
                        >
                          <Phone className="w-4 h-4" /> Hubungi Pemilik via WhatsApp
                        </a>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-800 bg-white border border-slate-200 rounded-xl p-3">
                        Nomor WhatsApp pemilik belum tersedia. Silakan titipkan barang ke Pos Satpam kampus.
                      </p>
                    )
                  ) : myClaim.status === 'PENDING' ? (
                    <p className="text-xs text-amber-900 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                      Kontak pemilik akan terbuka otomatis setelah pemilik mengonfirmasi foto bukti Anda.
                    </p>
                  ) : null}
                </div>
              )}

              {item.status !== 'Selesai' &&
                !foundModalOpen &&
                (!myClaim || myClaim.status === 'REJECTED') && (
                  <button
                    type="button"
                    onClick={() => {
                      if (!currentUser) {
                        openLoginGate(
                          'Masuk dengan akun kampus untuk mengirim bukti penemuan barang ini.',
                          { redirectPath: '/barang/' + item.id }
                        );
                      } else if (
                        requiresStudentIdentityVerification(currentUser.role) &&
                        !currentUser.ktmVerified
                      ) {
                        if (!currentUser.profileCompleted || !currentUser.ktmUrl) {
                          showToast(
                            'Verifikasi Identitas Diperlukan',
                            'Unggah foto KTM atau screenshot Biodata SIAKAD sekali saja sebelum melapor menemukan barang.',
                            'info'
                          );
                          router.push('/akun/pengaturan?onboarding=1');
                        } else {
                          showToast(
                            'Menunggu Verifikasi Admin',
                            'Berkas KTM/SIAKAD Anda sedang ditinjau Admin. Periksa statusnya di Pengaturan Akun.',
                            'info'
                          );
                          router.push('/akun/pengaturan');
                        }
                      } else {
                        setFoundModalOpen(true);
                      }
                    }}
                    className="min-h-12 w-full bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-sm flex items-center justify-center gap-2 transition"
                  >
                    <Camera className="w-4 h-4" />
                    {myClaim?.status === 'REJECTED' ? 'Kirim Bukti Penemuan Ulang' : 'Saya Menemukan Barang Ini'}
                  </button>
                )}

              {foundModalOpen && currentUser && (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (submittingFoundReport) return;
                    setSubmittingFoundReport(true);
                    const ok = await submitFoundReport(item, foundForm);
                    setSubmittingFoundReport(false);
                    if (ok) {
                      setFoundModalOpen(false);
                      setFoundForm(EMPTY_FOUND_REPORT_FORM);
                    }
                  }}
                  className="bg-rose-50/70 border-2 border-rose-600 rounded-2xl p-4 space-y-3.5"
                >
                  <div className="flex items-center justify-between border-b border-rose-200 pb-2">
                    <div className="flex items-center gap-1.5 text-rose-950 font-extrabold text-xs">
                      <ShieldCheck className="w-4 h-4 text-rose-700" />
                      <span>Konfirmasi Penemuan Barang</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFoundModalOpen(false)}
                      className="min-h-11 px-3 text-xs text-slate-700 hover:text-slate-900 font-bold rounded-xl"
                    >
                      Tutup
                    </button>
                  </div>

                  <div className="bg-white rounded-xl p-3 border border-rose-200 space-y-0.5">
                    <p className="text-[10px] font-bold uppercase text-rose-800 tracking-wider">
                      Identitas Penemu
                    </p>
                    <p className="text-xs font-extrabold text-slate-900">{currentUser.name}</p>
                    <p className="text-[11px] text-slate-700 font-mono">
                      {currentUser.idType}: {currentUser.identifier} · {currentUser.department}
                    </p>
                  </div>

                  <PhotoCapture
                    file={foundForm.proofPhotoFile}
                    onChange={(file) => setFoundForm({ ...foundForm, proofPhotoFile: file })}
                    label="Foto Bukti Barang yang Ditemukan"
                    accent="slate"
                    previewMax="max-w-[200px]"
                    hint="Wajib unggah foto fisik barang yang Anda temukan agar pemilik yakin sebelum kontak dibuka."
                  />

                  <div>
                    <label htmlFor="found-location" className="block text-xs font-bold text-slate-800 mb-1">
                      Lokasi &amp; Kondisi Ditemukan *
                    </label>
                    <textarea
                      id="found-location"
                      rows={2}
                      required
                      value={foundForm.foundLocation}
                      onChange={(e) =>
                        setFoundForm({ ...foundForm, foundLocation: e.target.value })
                      }
                      placeholder="Contoh: Ditemukan di meja Lab CNAP baris 2, kondisi masih bagus..."
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-700"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-800">
                      Pilihan Serah Terima *
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setFoundForm({ ...foundForm, handoverMethod: 'SATPAM' })
                        }
                        className={`min-h-11 px-3 py-2 rounded-xl border text-left text-xs font-bold transition ${
                          foundForm.handoverMethod === 'SATPAM'
                            ? 'bg-blue-600 border-blue-600 text-white'
                            : 'bg-white border-slate-300 text-slate-800 hover:bg-slate-50'
                        }`}
                      >
                        Titip di Pos Satpam (Paling Aman)
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setFoundForm({ ...foundForm, handoverMethod: 'FINDER' })
                        }
                        className={`min-h-11 px-3 py-2 rounded-xl border text-left text-xs font-bold transition ${
                          foundForm.handoverMethod === 'FINDER'
                            ? 'bg-blue-600 border-blue-600 text-white'
                            : 'bg-white border-slate-300 text-slate-800 hover:bg-slate-50'
                        }`}
                      >
                        Serahkan Langsung ke Pemilik
                      </button>
                    </div>

                    {foundForm.handoverMethod === 'SATPAM' && (
                      <select
                        aria-label="Pilih pos satpam penitipan"
                        value={foundForm.securityPost}
                        onChange={(e) =>
                          setFoundForm({ ...foundForm, securityPost: e.target.value })
                        }
                        className="w-full min-h-11 px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-700"
                      >
                        {SECURITY_POST_OPTIONS.map((post) => (
                          <option key={post} value={post}>
                            {post}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div>
                    <label htmlFor="found-notes" className="block text-xs font-bold text-slate-800 mb-1">
                      Catatan Tambahan (opsional)
                    </label>
                    <input
                      id="found-notes"
                      type="text"
                      value={foundForm.notes}
                      onChange={(e) => setFoundForm({ ...foundForm, notes: e.target.value })}
                      placeholder="Waktu luang untuk serah terima atau informasi tambahan..."
                      className="w-full min-h-11 px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-700"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submittingFoundReport || !foundForm.proofPhotoFile}
                    className="w-full min-h-12 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold text-xs py-3 rounded-xl shadow-sm flex items-center justify-center gap-2 transition"
                  >
                    {submittingFoundReport ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Mengirim Laporan...
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" /> Kirim Laporan Penemuan
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* Pengklaim Barang Temuan (FOUND) */}
          {!isReporter && item.type === 'FOUND' && (
            <div className="space-y-3 pt-1">
              {myClaim && (
                <div
                  className={`rounded-2xl p-4 border space-y-3 ${
                    myClaim.status === 'APPROVED' || myClaim.status === 'SELESAI'
                      ? 'bg-emerald-50 border-emerald-300'
                      : myClaim.status === 'REJECTED'
                        ? 'bg-rose-50 border-rose-300'
                        : 'bg-amber-50 border-amber-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-extrabold text-slate-900">
                      Status Klaim:
                    </span>
                    <ClaimStatusBadge status={myClaim.status} />
                  </div>

                  <div className="text-xs bg-white/90 p-2.5 rounded-xl border border-slate-200 space-y-1">
                    <p className="text-[11px] text-slate-600 font-semibold">
                      Pengklaim: {myClaim.claimantName} ({myClaim.claimantId})
                    </p>
                    <p className="text-xs text-slate-800">
                      <strong>Jawaban Anda:</strong> &quot;{myClaim.answer}&quot;
                    </p>
                    {myClaim.hasProofPhoto && myClaim.proofPhotoName?.startsWith('http') && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={myClaim.proofPhotoName}
                        alt="Foto bukti klaim Anda"
                        className="w-full max-h-40 object-cover rounded-lg border border-slate-200 mt-1"
                      />
                    )}
                  </div>

                  {myClaim.status === 'SELESAI' ? (
                    <div className="bg-blue-50 rounded-xl p-3.5 border border-blue-200 shadow-sm space-y-2">
                      <div className="flex items-center gap-1.5 text-blue-950 font-bold text-xs">
                        <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                        <span>Serah Terima Selesai</span>
                      </div>
                      <p className="text-xs text-slate-800 leading-relaxed">
                        Barang telah resmi diserahkan kepada Anda. Tiket {myClaim.ticketCode || '-'} telah ditutup.
                      </p>
                    </div>
                  ) : item.status === 'Selesai' ? (
                    <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 text-xs text-slate-700 font-semibold">
                      Laporan barang ini telah selesai diserahkan dan ditutup.
                    </div>
                  ) : myClaim.status === 'APPROVED' ? (
                    <TicketBoardingPass
                      ticketCode={myClaim.ticketCode || ''}
                      itemTitle={item.title}
                      category={item.category}
                      claimantName={myClaim.claimantName}
                      claimantId={myClaim.claimantId}
                      securityPost={item.securityPost}
                      storageType={item.storageType}
                      finderPhone={item.storageType === 'FINDER' ? (item.reporterPhone !== '-' ? item.reporterPhone : myClaim.finderPhone) : undefined}
                    />
                  ) : null}
                </div>
              )}

              {item.status !== 'Selesai' &&
                !isClaimFormOpen &&
                (!myClaim || myClaim.status === 'REJECTED') && (
                  <button
                    type="button"
                    onClick={() => {
                      if (!currentUser) {
                        openLoginGate(
                          'Masuk dengan akun kampus untuk mengajukan klaim kepemilikan barang.',
                          { redirectPath: '/barang/' + item.id, itemId: item.id, openClaim: true }
                        );
                      } else if (
                        requiresStudentIdentityVerification(currentUser.role) &&
                        !currentUser.ktmVerified
                      ) {
                        if (!currentUser.profileCompleted || !currentUser.ktmUrl) {
                          showToast(
                            'Verifikasi Identitas Diperlukan',
                            'Unggah foto KTM atau screenshot Biodata SIAKAD sekali saja sebelum mengklaim barang.',
                            'info'
                          );
                          router.push('/akun/pengaturan?onboarding=1');
                        } else {
                          showToast(
                            'Menunggu Verifikasi Admin',
                            'Berkas KTM/SIAKAD Anda sedang ditinjau Admin. Anda dapat memeriksa statusnya di Pengaturan Akun.',
                            'info'
                          );
                          router.push('/akun/pengaturan');
                        }
                      } else {
                        setClaimModalOpen(true);
                      }
                    }}
                    className="w-full min-h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-3 rounded-xl shadow-sm flex items-center justify-center gap-2 transition"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    {myClaim?.status === 'REJECTED' ? 'Ajukan Klaim Ulang' : 'Klaim Barang Ini'}
                  </button>
                )}

              {isClaimFormOpen && currentUser && (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (submittingClaim) return;
                    setSubmittingClaim(true);
                    const ok = await submitClaim(item, claimForm);
                    setSubmittingClaim(false);
                    if (ok) {
                      closeClaimForm();
                      setClaimForm(EMPTY_CLAIM_FORM);
                    }
                  }}
                  className="bg-blue-50/90 border-2 border-blue-600 rounded-2xl p-4 space-y-3.5"
                >
                  <div className="flex items-center justify-between border-b border-blue-200 pb-2">
                    <div className="flex items-center gap-1.5 text-blue-950 font-extrabold text-xs">
                      <ShieldCheck className="w-4 h-4 text-blue-700" />
                      <span>Formulir Pengajuan Klaim Barang</span>
                    </div>
                    <button
                      type="button"
                      onClick={closeClaimForm}
                      className="min-h-11 px-3 text-xs text-slate-700 hover:text-slate-900 font-bold rounded-xl"
                    >
                      Tutup
                    </button>
                  </div>

                  <div className="bg-white rounded-xl p-3 border border-blue-200 space-y-1">
                    <p className="text-[10px] font-bold uppercase text-blue-800 tracking-wider">
                      Identitas Pemohon Klaim
                    </p>
                    <p className="text-xs font-extrabold text-slate-900">
                      {currentUser.name}
                    </p>
                    <p className="text-[11px] text-slate-700 font-mono">
                      {currentUser.idType}: {currentUser.identifier} • {currentUser.department}
                    </p>
                  </div>

                  <div className="bg-amber-50 border border-amber-300 rounded-xl p-3">
                    <p className="text-[10px] font-bold uppercase text-amber-900 flex items-center gap-1">
                      <HelpCircle className="w-3.5 h-3.5 text-amber-800" /> Pertanyaan Pembuktian Pemilik:
                    </p>
                    <p className="text-xs font-extrabold text-slate-900 mt-1">
                      &quot;{item.secretQuestion || 'Sebutkan ciri khas barang ini yang membuktikan kepemilikan Anda'}&quot;
                    </p>
                  </div>

                  <div>
                    <label htmlFor="claim-answer" className="block text-xs font-bold text-slate-800 mb-1">
                      Jawaban Pembuktian Anda *
                    </label>
                    <textarea
                      id="claim-answer"
                      rows={2}
                      required
                      value={claimForm.answer}
                      onChange={(e) =>
                        setClaimForm({ ...claimForm, answer: e.target.value })
                      }
                      placeholder="Tuliskan ciri khas barang yang membuktikan Anda adalah pemilik sah..."
                      className="w-full px-3 py-2 rounded-xl border border-blue-300 bg-white text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                    <p className="text-[11px] text-slate-600 mt-1">
                      Jawaban akan dicocokkan oleh penemu / petugas satpam sebelum klaim disetujui.
                    </p>
                  </div>

                  <div>
                    <label htmlFor="claim-notes" className="block text-xs font-bold text-slate-800 mb-1">
                      Ciri Tambahan (opsional)
                    </label>
                    <input
                      id="claim-notes"
                      type="text"
                      value={claimForm.additionalNotes}
                      onChange={(e) =>
                        setClaimForm({ ...claimForm, additionalNotes: e.target.value })
                      }
                      placeholder="Goresan, stiker, atau ciri lainnya..."
                      className="w-full min-h-11 px-3 py-2 rounded-xl border border-blue-300 bg-white text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>

                  <PhotoCapture
                    file={claimForm.proofPhotoFile}
                    onChange={(proofPhotoFile) =>
                      setClaimForm({ ...claimForm, proofPhotoFile })
                    }
                    label="Foto Bukti Kepemilikan"
                    optional
                    accent="blue"
                    previewMax="max-w-[180px]"
                    hint="Foto nota pembelian, foto lama barang, atau bukti lain (JPG/PNG/WebP, maks 2 MB)."
                  />

                  <button
                    type="submit"
                    disabled={submittingClaim}
                    className="w-full min-h-12 bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white font-bold text-xs py-3 rounded-xl shadow-md transition inline-flex items-center justify-center gap-2"
                  >
                    {submittingClaim && <Loader2 className="w-4 h-4 animate-spin" />}
                    {submittingClaim ? 'Mengirim Klaim...' : 'Kirim Klaim'}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Dialog konfirmasi hapus laporan */}
      {deleteConfirmOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-item-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
          onClick={() => {
            if (!isDeleting) setDeleteConfirmOpen(false);
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
                <h3 id="delete-item-title" className="text-sm font-extrabold text-slate-900">
                  Hapus Laporan?
                </h3>
                <p className="text-xs text-slate-700 mt-1 leading-relaxed">
                  Laporan &quot;{item.title}&quot; akan dihapus permanen beserta seluruh klaim terkait. Tindakan ini tidak dapat dibatalkan.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeleteConfirmOpen(false)}
                className="flex-1 min-h-11 text-xs font-bold text-slate-800 bg-slate-100 hover:bg-slate-200 py-2.5 rounded-xl transition disabled:opacity-60"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteItem}
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
