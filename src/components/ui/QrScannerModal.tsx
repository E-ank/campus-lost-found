'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Camera, FlipHorizontal, RefreshCw, X, AlertCircle, UploadCloud } from 'lucide-react';
import jsQR from 'jsqr';

interface QrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (code: string) => void;
}

export default function QrScannerModal({ isOpen, onClose, onScanSuccess }: QrScannerModalProps) {
  if (!isOpen) return null;
  return <QrScannerDialog onClose={onClose} onScanSuccess={onScanSuccess} />;
}

function QrScannerDialog({
  onClose,
  onScanSuccess,
}: {
  onClose: () => void;
  onScanSuccess: (code: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(true);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraActiveRef = useRef(false);

  const playBeep = useCallback(() => {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch {
      // Abaikan jika audio diblokir
    }
  }, []);

  const extractTicketCode = useCallback((rawText: string): string => {
    const text = rawText.trim();
    if (!text) return '';

    if (text.includes('?') || text.includes('://')) {
      try {
        const url = new URL(text.startsWith('http') ? text : `https://${text}`);
        const code =
          url.searchParams.get('tiket') ||
          url.searchParams.get('ticket') ||
          url.searchParams.get('qrCode') ||
          url.searchParams.get('code');
        if (code) return code.trim().toUpperCase();
      } catch {
        // Fallback regex jika parsing URL gagal
      }

      const match = text.match(/(?:tiket|ticket|code|qrcode)=([a-zA-Z0-9_-]+)/i);
      if (match && match[1]) {
        return match[1].trim().toUpperCase();
      }
    }

    return text.toUpperCase();
  }, []);

  const stopCamera = useCallback(() => {
    cameraActiveRef.current = false;
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    stopCamera();
    cameraActiveRef.current = true;

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setError('Browser tidak mendukung akses kamera langsung. Silakan pilih opsi unggah foto QR.');
      setIsStarting(false);
      return;
    }

    const runLoop = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
        animFrameRef.current = requestAnimationFrame(runLoop);
        return;
      }

      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) {
        animFrameRef.current = requestAnimationFrame(runLoop);
        return;
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert',
      });

      if (code && code.data) {
        const parsed = extractTicketCode(code.data);
        if (parsed) {
          playBeep();
          stopCamera();
          onScanSuccess(parsed);
          onClose();
          return;
        }
      }

      animFrameRef.current = requestAnimationFrame(runLoop);
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      if (!cameraActiveRef.current || !videoRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      videoRef.current.setAttribute('playsinline', 'true');
      await videoRef.current.play();
      setError(null);
      setIsStarting(false);
      runLoop();
    } catch (err) {
      if (!cameraActiveRef.current) return;
      console.warn('Gagal membuka kamera:', err);
      setError('Izin kamera ditolak atau kamera sedang digunakan aplikasi lain. Anda juga bisa mengunggah tangkapan layar QR.');
      setIsStarting(false);
    }
  }, [extractTicketCode, facingMode, onClose, onScanSuccess, playBeep, stopCamera]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void startCamera();
    }, 0);
    return () => {
      window.clearTimeout(id);
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        stopCamera();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, stopCamera]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      if (code && code.data) {
        const parsed = extractTicketCode(code.data);
        if (parsed) {
          playBeep();
          onScanSuccess(parsed);
          onClose();
          return;
        }
      }
      setError('Kode QR tidak terdeteksi pada gambar yang diunggah. Coba foto QR lain.');
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      setError('Gagal membaca file gambar.');
    };
    img.src = objectUrl;
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="qr-scanner-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn"
      onClick={() => {
        stopCamera();
        onClose();
      }}
    >
      <div
        className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl border border-slate-200 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 id="qr-scanner-title" className="text-xs font-black text-slate-900 uppercase tracking-tight">
                Pindai QR Tiket
              </h3>
              <p className="text-[11px] text-slate-600 font-medium">Arahkan kamera ke QR pengklaim</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="min-h-11 min-w-11 -mr-2 rounded-xl hover:bg-slate-100 text-slate-600 hover:text-slate-900 flex items-center justify-center transition focus-visible:outline-2 focus-visible:outline-emerald-700"
            aria-label="Tutup pemindai"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="relative aspect-square bg-slate-950 overflow-hidden flex items-center justify-center">
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            playsInline
            muted
          />
          <canvas ref={canvasRef} className="hidden" />

          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="w-56 h-56 relative border-2 border-emerald-400 rounded-2xl shadow-[0_0_0_9999px_rgba(15,23,42,0.6)]">
              <div className="absolute -top-1 -left-1 w-5 h-5 border-t-4 border-l-4 border-emerald-400 rounded-tl-lg" />
              <div className="absolute -top-1 -right-1 w-5 h-5 border-t-4 border-r-4 border-emerald-400 rounded-tr-lg" />
              <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg" />
              <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-4 border-r-4 border-emerald-400 rounded-br-lg" />
            </div>
          </div>

          {isStarting && (
            <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center gap-2 text-white">
              <RefreshCw className="w-6 h-6 animate-spin text-emerald-400" />
              <span className="text-xs font-bold text-slate-200">Menyiapkan kamera...</span>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 bg-slate-900/95 p-6 flex flex-col items-center justify-center text-center gap-3">
              <AlertCircle className="w-10 h-10 text-amber-400" />
              <p className="text-xs font-bold text-white leading-relaxed">{error}</p>
              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="min-h-11 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  <UploadCloud className="w-4 h-4" /> Unggah Foto QR
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setIsStarting(true);
                    void startCamera();
                  }}
                  className="min-h-11 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  Coba Lagi
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => {
              setError(null);
              setIsStarting(true);
              setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
            }}
            className="flex-1 min-h-11 py-2.5 px-3 bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm focus-visible:outline-2 focus-visible:outline-emerald-700"
          >
            <FlipHorizontal className="w-3.5 h-3.5 text-slate-600" /> Balik Kamera
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 min-h-11 py-2.5 px-3 bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm focus-visible:outline-2 focus-visible:outline-emerald-700"
          >
            <UploadCloud className="w-3.5 h-3.5 text-slate-600" /> Unggah Foto
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileUpload}
          />
        </div>
      </div>
    </div>
  );
}
