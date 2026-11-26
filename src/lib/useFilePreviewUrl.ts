'use client';

import { useEffect, useState } from 'react';

interface PreviewEntry {
  file: File;
  url: string;
}

/**
 * Mengelola object URL sementara untuk pratinjau File gambar dan mencabutnya
 * otomatis saat file berganti atau komponen dilepas.
 */
export function useFilePreviewUrl(file: File | null): string | null {
  const [entry, setEntry] = useState<PreviewEntry | null>(null);

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const frameId = window.requestAnimationFrame(() => {
      setEntry({ file, url });
    });
    return () => {
      window.cancelAnimationFrame(frameId);
      URL.revokeObjectURL(url);
    };
  }, [file]);

  if (!file) return null;
  return entry?.file === file ? entry.url : null;
}
