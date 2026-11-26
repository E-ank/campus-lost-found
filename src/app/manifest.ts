import type { MetadataRoute } from 'next';

// Manifest PWA: membuat aplikasi bisa dipasang ke layar utama.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Campus Lost & Found',
    short_name: 'Lost & Found',
    description: 'Sistem Informasi Kehilangan & Temuan Barang Kampus',
    lang: 'id',
    dir: 'ltr',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f8fafc',
    theme_color: '#2563eb',
    categories: ['education', 'utilities'],
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-maskable-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      {
        name: 'Lapor barang',
        short_name: 'Lapor',
        description: 'Laporkan barang hilang atau temuan',
        url: '/lapor',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
      },
      {
        name: 'Kirim pengaduan',
        short_name: 'Pengaduan',
        description: 'Laporkan masalah fasilitas, keamanan, atau layanan kampus',
        url: '/pengaduan',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
      },
      {
        name: 'Riwayat klaim',
        short_name: 'Klaim',
        description: 'Lihat status klaim Anda',
        url: '/klaim',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
      },
    ],
  };
}
