'use client';

import { useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  Award,
  ClipboardList,
  Home,
  PlusSquare,
  ShieldCheck,
  User,
  type LucideIcon,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';

export interface NavItem {
  key: 'home' | 'upload' | 'pengaduan' | 'role';
  label: string;
  icon: LucideIcon;
  isActive: boolean;
  // Warna aksen saat aktif: biru untuk umum, warna peran untuk ruang kerja.
  accent: 'blue' | 'emerald' | 'purple';
  // Sudah termasuk gerbang login bila tujuan wajib masuk.
  go: () => void;
}

// Kelas warna teks saat menu aktif, dipetakan dari aksen tiap tujuan (lolos WCAG AA di atas slate-100 & putih).
export const NAV_ACCENT_TEXT: Record<NavItem['accent'], string> = {
  blue: 'text-blue-700',
  emerald: 'text-emerald-700',
  purple: 'text-purple-700',
};

// Pesan gerbang login disimpan di satu tempat agar konsisten di seluruh navigasi.
export const GATE_MESSAGES = {
  upload: 'Masuk dengan akun kampus untuk melapor barang.',
  pengaduan: 'Masuk untuk mengirim pengaduan.',
  claims: 'Masuk untuk melihat klaim Anda.',
};

// Membungkus navigasi dengan gerbang login. Tidak membaca pathname sehingga
// aman dipakai di komponen yang tidak dibungkus Suspense.
export function useGuardedNavigate() {
  const router = useRouter();
  const { currentUser, openLoginGate } = useApp();

  return useCallback(
    (path: string, message: string) => () => {
      if (!currentUser) {
        openLoginGate(message, { redirectPath: path });
        return;
      }
      router.push(path);
    },
    [currentUser, openLoginGate, router]
  );
}

// Tujuan navigasi utama. Dipakai bersama bilah bawah (mobile) dan sidebar
// (desktop) supaya keduanya tidak pernah menuju halaman yang berbeda.
export function useNavItems(): NavItem[] {
  const pathname = usePathname();
  const router = useRouter();
  const { currentUser } = useApp();
  const guarded = useGuardedNavigate();

  const items: NavItem[] = [
    {
      key: 'home',
      label: 'Beranda',
      icon: Home,
      isActive: pathname === '/' || pathname.startsWith('/barang'),
      accent: 'blue',
      go: () => router.push('/'),
    },
    {
      key: 'upload',
      label: 'Lapor',
      icon: PlusSquare,
      isActive: pathname === '/lapor',
      accent: 'blue',
      go: guarded('/lapor', GATE_MESSAGES.upload),
    },
    {
      key: 'pengaduan',
      label: 'Pengaduan',
      icon: ClipboardList,
      isActive: pathname.startsWith('/pengaduan'),
      accent: 'blue',
      go: guarded('/pengaduan', GATE_MESSAGES.pengaduan),
    },
  ];

  // Menu keempat menyesuaikan peran: ruang kerja petugas/admin, atau riwayat
  // klaim untuk pengguna umum.
  if (currentUser?.role === 'SATPAM') {
    items.push({
      key: 'role',
      label: 'Petugas',
      icon: ShieldCheck,
      isActive: pathname.startsWith('/satpam'),
      accent: 'emerald',
      go: () => router.push('/satpam'),
    });
  } else if (currentUser?.role === 'SUPERADMIN') {
    items.push({
      key: 'role',
      label: 'Admin',
      icon: Award,
      isActive: pathname.startsWith('/admin'),
      accent: 'purple',
      go: () => router.push('/admin'),
    });
  } else {
    items.push({
      key: 'role',
      label: 'Akun',
      icon: User,
      isActive: pathname.startsWith('/klaim'),
      accent: 'blue',
      go: guarded('/klaim', GATE_MESSAGES.claims),
    });
  }

  return items;
}
