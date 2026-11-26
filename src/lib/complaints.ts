import type { ComplaintStatus } from '@/types';

// Kategori yang dipakai form pengaduan. Daftar ini sengaja pendek agar
// pengguna cepat memilih, dan tetap mencakup masalah kampus yang nyata.
export const COMPLAINT_CATEGORIES = [
  'Fasilitas',
  'Keamanan',
  'Kebersihan',
  'Layanan',
  'Lainnya',
] as const;

export const COMPLAINT_STATUSES: ComplaintStatus[] = [
  'Menunggu',
  'Diproses',
  'Selesai',
  'Ditolak',
];

// Batas deskripsi disamakan dengan constraint di tabel `complaints`.
export const COMPLAINT_DESCRIPTION_MIN = 20;
export const COMPLAINT_DESCRIPTION_MAX = 1000;
