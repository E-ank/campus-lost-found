'use client';

import { parseIdentityText, type ParsedIdentityDoc } from '@/lib/ktm-parser';

// Pra-proses gambar di canvas agar pembacaan OCR lebih cepat dan tajam
// (terutama untuk screenshot desktop beresolusi tinggi atau foto KTM).
async function preprocessImageForOcr(file: File): Promise<Blob | File> {
  if (typeof window === 'undefined' || typeof document === 'undefined') return file;

  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      try {
        // Batasi lebar maks 1600px agar OCR selesai dalam 2-5 detik namun huruf tetap tajam
        const maxWidth = 1600;
        const scale = img.width > maxWidth ? maxWidth / img.width : 1;
        const width = Math.round(img.width * scale);
        const height = Math.round(img.height * scale);

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(objectUrl);
          resolve(file);
          return;
        }

        // Sedikit kontras + grayscale agar teks form SIAKAD & kartu KTM lebih kontras
        ctx.filter = 'grayscale(100%) contrast(125%)';
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(objectUrl);
            resolve(blob || file);
          },
          'image/png',
          0.92
        );
      } catch {
        URL.revokeObjectURL(objectUrl);
        resolve(file);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file);
    };

    img.src = objectUrl;
  });
}

// Jalankan OCR di Web Worker browser (jauh lebih cepat & tidak pernah hang di Next.js/Vercel).
export async function extractIdentityInBrowser(
  file: File,
  onProgress?: (percent: number) => void,
  timeoutMs = 20000
): Promise<ParsedIdentityDoc> {
  const { createWorker } = await import('tesseract.js');
  const prepared = await preprocessImageForOcr(file);

  let terminated = false;
  // Model 'eng' 3x lebih kecil & cepat diunduh, akurat untuk alfabet Latin & angka NIM/SIAKAD.
  const worker = await createWorker('eng', 1, {
    logger: (m) => {
      if (m.status === 'recognizing text' && typeof m.progress === 'number') {
        onProgress?.(Math.min(99, Math.max(15, Math.round(15 + m.progress * 84))));
      } else if (m.status === 'loading tesseract core' || m.status === 'initializing tesseract') {
        onProgress?.(10);
      }
    },
  });

  const safeTerminate = async () => {
    if (!terminated) {
      terminated = true;
      try {
        await worker.terminate();
      } catch {
        // ignore
      }
    }
  };

  try {
    const result = await Promise.race([
      worker.recognize(prepared),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('OCR_TIMEOUT')), timeoutMs)
      ),
    ]);
    onProgress?.(100);
    const rawText = result.data.text || '';
    return parseIdentityText(rawText);
  } finally {
    await safeTerminate();
  }
}
