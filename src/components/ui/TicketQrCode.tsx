'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Check, Copy, Maximize2, QrCode as QrIcon, X } from 'lucide-react';

interface TicketQrCodeProps {
  ticketCode: string;
  itemTitle?: string;
  securityPost?: string;
  className?: string;
}

export default function TicketQrCode({
  ticketCode,
  itemTitle,
  securityPost,
  className = '',
}: TicketQrCodeProps) {
  const [qrState, setQrState] = useState<{ url: string; dataUrl: string | null }>({
    url: '',
    dataUrl: null,
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!ticketCode) return;
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://www.lost-found.my.id';
    const targetUrl = `${origin}/satpam?tab=SERAH_TERIMA&tiket=${encodeURIComponent(ticketCode)}`;

    let active = true;
    QRCode.toDataURL(targetUrl, {
      width: 320,
      margin: 2,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    })
      .then((url) => {
        if (active) setQrState({ url: targetUrl, dataUrl: url });
      })
      .catch((err) => {
        console.error('Gagal membuat QR Code:', err);
      });

    return () => {
      active = false;
    };
  }, [ticketCode]);

  useEffect(() => {
    if (!isModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsModalOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen]);

  const handleCopy = async () => {
    const linkToCopy =
      qrState.url ||
      `${typeof window !== 'undefined' ? window.location.origin : 'https://www.lost-found.my.id'}/satpam?tab=SERAH_TERIMA&tiket=${encodeURIComponent(ticketCode)}`;
    try {
      await navigator.clipboard.writeText(linkToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback jika clipboard permission ditolak
    }
  };

  if (!ticketCode) return null;

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="bg-white rounded-2xl p-3.5 border border-emerald-200 shadow-sm flex flex-col sm:flex-row items-center gap-4">
        {qrState.dataUrl ? (
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            title="Klik untuk memperbesar QR Code"
            aria-label={`Perbesar QR Code tiket ${ticketCode}`}
            className="group relative shrink-0 p-1.5 bg-white rounded-xl border border-slate-200 shadow-sm hover:border-emerald-600 transition cursor-pointer focus-visible:outline-2 focus-visible:outline-emerald-700"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrState.dataUrl}
              alt={`QR Code Tiket ${ticketCode}`}
              className="w-28 h-28 object-contain rounded-lg"
            />
            <div className="absolute inset-0 bg-slate-900/10 rounded-xl opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
              <span className="p-1.5 rounded-full bg-white text-slate-800 shadow">
                <Maximize2 className="w-3.5 h-3.5" />
              </span>
            </div>
          </button>
        ) : (
          <div className="w-28 h-28 rounded-xl bg-slate-100 animate-pulse shrink-0 flex items-center justify-center">
            <QrIcon className="w-6 h-6 text-slate-500" />
          </div>
        )}

        <div className="flex-1 text-center sm:text-left min-w-0">
          <div className="flex items-center justify-center sm:justify-start gap-1.5">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-900 bg-emerald-100 px-2 py-0.5 rounded">
              QR Tiket Satpam
            </span>
          </div>
          <p className="text-base font-black font-mono text-slate-900 mt-1">
            {ticketCode}
          </p>
          <p className="text-[11px] text-slate-700 mt-0.5 leading-snug">
            Tunjukkan QR ini ke Petugas di {securityPost || 'Pos Satpam'}.
          </p>

          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-2.5">
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="min-h-11 px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold inline-flex items-center gap-1.5 transition active:scale-95 shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              Perbesar QR
            </button>
            <button
              type="button"
              onClick={handleCopy}
              className="min-h-11 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold inline-flex items-center gap-1.5 transition focus-visible:outline-2 focus-visible:outline-blue-700"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Tersalin</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-600" />
                  <span>Salin Link</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="qr-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fadeIn"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="bg-white rounded-3xl max-w-sm w-full p-6 text-center space-y-4 shadow-2xl relative border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="absolute right-3 top-3 w-11 h-11 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 transition focus-visible:outline-2 focus-visible:outline-blue-700"
              aria-label="Tutup pratinjau QR"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="pt-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-900 bg-emerald-100 px-2.5 py-1 rounded-full">
                QR Serah Terima Satpam
              </span>
              <h4 id="qr-modal-title" className="text-sm font-black text-slate-900 mt-2 truncate">
                {itemTitle || 'Barang Ditemukan'}
              </h4>
              <p className="text-xs font-mono font-bold text-slate-600">
                Tiket: {ticketCode}
              </p>
            </div>

            {qrState.dataUrl && (
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 inline-block shadow-inner mx-auto">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrState.dataUrl}
                  alt={`QR Code Tiket ${ticketCode}`}
                  className="w-56 h-56 object-contain rounded-xl mx-auto"
                />
              </div>
            )}

            <p className="text-xs text-slate-700 leading-relaxed px-2">
              Minta petugas Pos Satpam memindai QR code ini untuk langsung membuka formulir serah terima.
            </p>

            <div className="pt-1 flex gap-2">
              <button
                type="button"
                onClick={handleCopy}
                className="flex-1 min-h-11 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-800 text-xs font-bold inline-flex items-center justify-center gap-1.5 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Link Tersalin' : 'Salin Link'}
              </button>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="flex-1 min-h-11 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
