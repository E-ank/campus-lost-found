'use client';

// Komponen unggah foto + kamera langsung (kamera depan/belakang).
// Dipakai di: lapor barang, klaim barang, temuan barang hilang, serah terima.
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Camera, ImagePlus, RefreshCw, Trash2, X } from 'lucide-react';
import { PHOTO_ACCEPTED, PHOTO_MAX_MB, PHOTO_MAX_BYTES, validatePhotoFile } from '@/lib/photo';
import { useFilePreviewUrl } from '@/lib/useFilePreviewUrl';

type FacingMode = 'environment' | 'user';
type Accent = 'blue' | 'emerald' | 'slate';

const ACCENTS: Record<Accent, { solid: string; outline: string }> = {
  blue: { solid: 'bg-blue-600 hover:bg-blue-700', outline: 'bg-blue-50 hover:bg-blue-100 text-blue-800 border-blue-300' },
  emerald: { solid: 'bg-emerald-700 hover:bg-emerald-800', outline: 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300' },
  slate: { solid: 'bg-slate-900 hover:bg-slate-800', outline: 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-300' },
};

interface PhotoCaptureProps {
  file: File | null;
  onChange: (file: File | null) => void;
  label: string;
  optional?: boolean;
  accent?: Accent;
  hint?: string;
  previewMax?: string;
  existingPhotoUrl?: string | null;
}

export default function PhotoCapture({
  file,
  onChange,
  label,
  optional = false,
  accent = 'blue',
  hint,
  previewMax = 'max-w-[220px]',
  existingPhotoUrl = null,
}: PhotoCaptureProps) {
  const [cameraOpen, setCameraOpen] = useState(false);
  const [facing, setFacing] = useState<FacingMode>('environment');
  const fileInputId = useId();
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const objectUrl = useFilePreviewUrl(file);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const cameraActiveRef = useRef(false);

  const a = ACCENTS[accent];

  const stopStream = useCallback(() => {
    cameraActiveRef.current = false;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const startCamera = useCallback(async (mode: FacingMode) => {
    if (!navigator.mediaDevices?.getUserMedia) return;
    cameraActiveRef.current = true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode, width: { ideal: 1600 }, height: { ideal: 1600 } },
        audio: false,
      });
      if (!cameraActiveRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
    } catch (err) {
      const name = (err as DOMException | undefined)?.name;
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        setCameraError('Izin kamera ditolak. Izinkan kamera di pengaturan browser, lalu coba lagi.');
      } else if (name === 'NotFoundError') {
        setCameraError('Kamera tidak ditemukan di perangkat ini.');
      } else {
        setCameraError('Kamera gagal dibuka. Gunakan tombol Galeri sebagai alternatif.');
      }
    }
  }, []);

  const openCamera = () => {
    setCameraError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setFileError(
        'Browser tidak mendukung akses kamera. Gunakan tombol Galeri sebagai alternatif.'
      );
      return;
    }
    setCameraOpen(true);
  };

  useEffect(() => {
    if (!cameraOpen) return;
    const id = window.setTimeout(() => {
      void startCamera(facing);
    }, 0);
    return () => {
      window.clearTimeout(id);
      stopStream();
    };
  }, [cameraOpen, facing, startCamera, stopStream]);

  useEffect(() => {
    if (!cameraOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCameraOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cameraOpen]);

  const capturePhoto = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) {
      setCameraError('Kamera belum siap, tunggu satu-dua detik lalu jepret lagi.');
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setCameraError('Gagal memproses foto.');
      return;
    }
    ctx.drawImage(video, 0, 0);

    let quality = 0.85;
    let blob: Blob | null = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', quality)
    );
    while (blob && blob.size > PHOTO_MAX_BYTES && quality > 0.35) {
      quality -= 0.15;
      blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    }
    if (!blob) {
      setCameraError('Gagal memproses foto.');
      return;
    }
    if (blob.size > PHOTO_MAX_BYTES) {
      setCameraError(`Foto hasil jepretan melebihi ${PHOTO_MAX_MB} MB. Coba ulangi.`);
      return;
    }

    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    setCameraError(null);
    setFileError(null);
    onChange(new File([blob], `kamera-${stamp}.jpg`, { type: 'image/jpeg' }));
    setCameraOpen(false);
  }, [onChange]);

  const handleSelectFromGallery = useCallback(
    (selected: File | null) => {
      if (!selected) return;
      const error = validatePhotoFile(selected);
      if (error) {
        setFileError(error);
        onChange(null);
        return;
      }
      setFileError(null);
      onChange(selected);
    },
    [onChange]
  );

  const removePhoto = useCallback(() => {
    if (inputRef.current) inputRef.current.value = '';
    onChange(null);
  }, [onChange]);

  const previewUrl = objectUrl || existingPhotoUrl;

  return (
    <div>
      <label htmlFor={fileInputId} className="block text-xs font-bold text-slate-800 mb-1.5">
        {label}{' '}
        {optional ? (
          <span className="text-slate-600 font-normal">(opsional)</span>
        ) : (
          <span className="text-rose-600">*</span>
        )}
      </label>

      {file && objectUrl ? (
        <div className="flex items-start gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={objectUrl}
            alt="Pratinjau foto"
            className={`w-full ${previewMax} aspect-video object-cover rounded-xl border border-slate-200`}
          />
          <button
            type="button"
            onClick={removePhoto}
            title="Hapus foto"
            aria-label="Hapus foto terpilih"
            className="shrink-0 w-11 h-11 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl flex items-center justify-center transition focus-visible:outline-2 focus-visible:outline-blue-700"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {previewUrl && (
            <div className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-200 bg-slate-50">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt="Foto laporan saat ini"
                className="w-20 h-14 object-cover rounded-lg border border-slate-200 shrink-0"
              />
              <p className="text-[11px] text-slate-700 leading-snug">
                Foto saat ini tersimpan. Pilih Galeri atau Kamera di bawah bila ingin menggantinya.
              </p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className={`${a.solid} min-h-11 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700`}
            >
              <ImagePlus className="w-4 h-4" /> Galeri
            </button>
            <button
              type="button"
              onClick={openCamera}
              className={`${a.outline} min-h-11 border text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700`}
            >
              <Camera className="w-4 h-4" /> Kamera
            </button>
          </div>
        </div>
      )}

      {file && (
        <p className="text-[11px] text-slate-600 mt-1">
          {file.name} ({(file.size / 1024).toFixed(0)} KB), format &amp; ukuran valid
        </p>
      )}
      {fileError && <p className="text-[11px] font-bold text-rose-700 mt-1">{fileError}</p>}
      {hint && !file && <p className="text-[11px] text-slate-600 mt-1 leading-snug">{hint}</p>}

      <input
        id={fileInputId}
        ref={inputRef}
        type="file"
        accept={PHOTO_ACCEPTED.join(',')}
        className="hidden"
        onChange={(e) => {
          handleSelectFromGallery(e.target.files?.[0] ?? null);
          e.target.value = '';
        }}
      />

      {cameraOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Kamera pengambil foto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setCameraOpen(false);
          }}
          className="fixed inset-0 z-[60] bg-black/95 flex flex-col items-center justify-center px-4"
        >
          <p className="text-xs font-bold text-white mb-3">
            {facing === 'environment' ? 'Kamera Belakang: arahkan ke objek, lalu jepret' : 'Kamera Depan: arahkan ke objek, lalu jepret'}
          </p>
          <div className="relative w-full max-w-md h-[65vh] rounded-2xl overflow-hidden bg-slate-900 border border-white/10">
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            {cameraError && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60 p-4">
                <p className="text-xs font-bold text-rose-300 text-center leading-snug">{cameraError}</p>
              </div>
            )}
          </div>
          <div className="flex items-center justify-center gap-7 mt-5">
            <button
              type="button"
              onClick={() => setCameraOpen(false)}
              title="Tutup kamera"
              aria-label="Tutup kamera"
              className="w-11 h-11 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition focus-visible:outline-2 focus-visible:outline-white"
            >
              <X className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => void capturePhoto()}
              title="Jepret foto"
              aria-label="Jepret foto"
              className="w-16 h-16 rounded-full bg-white ring-4 ring-white/30 flex items-center justify-center transition active:scale-90 focus-visible:outline-2 focus-visible:outline-blue-400"
            >
              <div className="w-12 h-12 rounded-full bg-blue-600" />
            </button>
            <button
              type="button"
              onClick={() => {
                setCameraError(null);
                setFacing(facing === 'environment' ? 'user' : 'environment');
              }}
              title="Ganti kamera depan/belakang"
              aria-label="Ganti kamera depan atau belakang"
              className="w-11 h-11 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition focus-visible:outline-2 focus-visible:outline-white"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
          <p className="text-[11px] text-slate-300 mt-3">
            Hasil jepretan otomatis menjadi JPG dengan ukuran maksimal {PHOTO_MAX_MB} MB.
          </p>
        </div>
      )}
    </div>
  );
}
