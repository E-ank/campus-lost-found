'use client';

import { useState } from 'react';
import {
  Check,
  CheckCircle2,
  Copy,
  Info,
  MapPin,
  Phone,
  ShieldCheck,
} from 'lucide-react';
import TicketQrCode from './TicketQrCode';
import { whatsAppHref } from '@/lib/whatsapp';

interface TicketBoardingPassProps {
  ticketCode: string;
  itemTitle: string;
  category: string;
  claimantName: string;
  claimantId?: string;
  securityPost?: string;
  storageType?: string;
  finderPhone?: string;
  recipientLabel?: string;
  contactCtaLabel?: string;
  headerLabel?: string;
  className?: string;
}

export default function TicketBoardingPass({
  ticketCode,
  itemTitle,
  category,
  claimantName,
  claimantId,
  securityPost,
  storageType = 'SATPAM',
  finderPhone,
  recipientLabel = 'Pemilik Sah',
  contactCtaLabel = 'Hubungi Penemu via WhatsApp',
  headerLabel = 'Tiket Pengambilan Resmi',
  className = '',
}: TicketBoardingPassProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(ticketCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Abaikan jika clipboard permission ditolak
    }
  };

  const isAtSatpam = storageType === 'SATPAM';
  const finderWaHref =
    !isAtSatpam && finderPhone
      ? whatsAppHref(
          finderPhone,
          `Halo, klaim saya untuk barang "${itemTitle}" (tiket ${ticketCode}) sudah disetujui. Mari atur waktu dan tempat serah terima di kampus.`
        )
      : null;

  return (
    <div
      className={`relative overflow-hidden rounded-3xl bg-slate-900 text-white p-5 sm:p-6 shadow-xl border border-slate-800 ${className}`}
    >
      {/* Header Tiket */}
      <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">
              {headerLabel}
            </span>
          </div>
          <h3 className="text-base sm:text-lg font-black text-white mt-1 leading-snug">
            {itemTitle}
          </h3>
          <p className="text-xs text-slate-300">{category}</p>
        </div>

        <span className="px-3 py-1 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase tracking-wider shrink-0 flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Disetujui
        </span>
      </div>

      {/* Bagian Kode Tiket & Detail Lokasi */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4 border-b border-slate-800">
        <div className="space-y-1">
          <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">
            Kode Tiket
          </span>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xl sm:text-2xl font-black text-emerald-400 tracking-wider">
              {ticketCode}
            </span>
            <button
              type="button"
              onClick={handleCopyCode}
              title="Salin Kode Tiket"
              aria-label="Salin kode tiket"
              className="min-h-11 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 transition active:scale-95 text-xs flex items-center gap-1.5 font-bold focus-visible:outline-2 focus-visible:outline-emerald-400"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-[11px] text-emerald-300">Tersalin</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span className="text-[11px]">Salin</span>
                </>
              )}
            </button>
          </div>
          <p className="text-[11px] text-slate-300">
            {recipientLabel}: <strong className="text-white">{claimantName}</strong> {claimantId ? `(${claimantId})` : ''}
          </p>
        </div>

        <div className="space-y-1.5">
          <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">
            Tempat Pengambilan
          </span>
          <div className="flex items-center gap-1.5 text-white text-sm font-black">
            <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{isAtSatpam ? securityPost || 'Pos Satpam Kampus' : 'Langsung ke Penemu'}</span>
          </div>
          <p className="text-[11px] text-slate-300 leading-relaxed">
            {isAtSatpam
              ? 'Tunjukkan tiket ini kepada petugas satpam yang berjaga di pos.'
              : finderWaHref
                ? `Nomor WhatsApp penemu: ${finderPhone}`
                : 'Nomor WhatsApp penemu belum tersedia.'}
          </p>
          {finderWaHref && (
            <a
              href={finderWaHref}
              target="_blank"
              rel="noreferrer"
              className="mt-1 min-h-11 w-full px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold inline-flex items-center justify-center gap-2 transition focus-visible:outline-2 focus-visible:outline-emerald-300"
            >
              <Phone className="w-4 h-4" />
              {contactCtaLabel}
            </a>
          )}
        </div>
      </div>

      {/* Garis Potongan Tiket */}
      <div className="relative my-3 -mx-5 sm:-mx-6 flex items-center justify-between">
        <div className="w-4 h-8 bg-slate-50 rounded-r-full -ml-1 border-r border-slate-300 lg:bg-transparent lg:border-none" />
        <div className="flex-1 border-b-2 border-dashed border-slate-700 mx-2" />
        <div className="w-4 h-8 bg-slate-50 rounded-l-full -mr-1 border-l border-slate-300 lg:bg-transparent lg:border-none" />
      </div>

      {/* QR Code & Petunjuk Syarat Pengambilan */}
      <div className="space-y-4 pt-1">
        {isAtSatpam && ticketCode && (
          <div className="bg-white rounded-2xl p-3 text-slate-900">
            <TicketQrCode
              ticketCode={ticketCode}
              itemTitle={itemTitle}
              securityPost={securityPost}
            />
          </div>
        )}

        <div className="bg-slate-800/80 rounded-2xl p-3.5 border border-slate-700 space-y-2 text-xs">
          <div className="flex items-center gap-1.5 text-amber-300 font-bold text-xs">
            <Info className="w-3.5 h-3.5 text-amber-300 shrink-0" />
            <span>Ketentuan Serah Terima:</span>
          </div>
          <ul className="space-y-1.5 text-[11px] text-slate-200">
            <li className="flex items-start gap-2">
              <span className="text-emerald-400 font-bold shrink-0">1.</span>
              <span>
                <strong>Bawa KTM (Kartu Tanda Mahasiswa) Asli</strong> untuk dicocokkan dengan identitas pengklaim.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-400 font-bold shrink-0">2.</span>
              <span>
                Petugas/Penemu akan mendokumentasikan serah terima dengan <strong>foto penyerahan fisik</strong> sebelum status diubah menjadi Selesai.
              </span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
