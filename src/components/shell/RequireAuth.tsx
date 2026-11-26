'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Clock, ShieldAlert } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import type { UserRole } from '@/types';

interface RequireAuthProps {
  children: ReactNode;
  // Bila kosong, semua pengguna yang sudah login boleh mengakses.
  allow?: UserRole[];
  // Bila true, mahasiswa wajib sudah terverifikasi identitas (KTM / SS Biodata SIAKAD).
  requireVerified?: boolean;
}

// Penjaga rute: mengalihkan pengunjung yang belum login (atau peran tidak sesuai) ke beranda,
// dan menerapkan verifikasi identitas progresif pada aksi penting (lapor/klaim).
export default function RequireAuth({ children, allow, requireVerified = false }: RequireAuthProps) {
  const router = useRouter();
  const { currentUser, authLoading } = useApp();
  const allowKey = (allow ?? []).join(',');

  const isAllowed = Boolean(
    currentUser && (allowKey === '' || allowKey.split(',').includes(currentUser.role))
  );

  // Akun SIAKAD baru wajib mengganti sandi bawaan terlebih dahulu.
  const needsPasswordChange = Boolean(currentUser && currentUser.mustChangePassword);

  // Untuk aksi yang butuh verifikasi identitas (seperti melapor barang):
  const isUnverifiedStudent = Boolean(
    requireVerified && currentUser?.role === 'MAHASISWA' && !currentUser.ktmVerified
  );
  const needsIdentityUpload = Boolean(
    isUnverifiedStudent && (!currentUser?.profileCompleted || !currentUser?.ktmUrl)
  );
  const isWaitingAdminReview = Boolean(isUnverifiedStudent && currentUser?.ktmUrl);

  useEffect(() => {
    if (authLoading) return;
    if (!isAllowed) {
      router.replace('/');
      return;
    }
    if (needsPasswordChange || needsIdentityUpload) {
      router.replace('/akun/pengaturan?onboarding=1');
    }
  }, [authLoading, isAllowed, needsPasswordChange, needsIdentityUpload, router]);

  // Tunggu pemulihan sesi selesai agar tidak terjadi redirect palsu.
  if (authLoading || needsPasswordChange || needsIdentityUpload) {
    return (
      <div className="flex-1 p-8 flex items-center justify-center">
        <p className="text-xs font-bold text-slate-600 uppercase tracking-widest">
          {needsPasswordChange || needsIdentityUpload
            ? 'Mengalihkan ke verifikasi identitas...'
            : 'Memuat sesi...'}
        </p>
      </div>
    );
  }

  if (!isAllowed) return null;

  if (isWaitingAdminReview) {
    return (
      <div className="flex-1 p-4 lg:mx-auto lg:max-w-xl flex items-center">
        <div className="w-full bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h2 className="text-sm font-extrabold text-slate-900">
                Identitas Sedang Ditinjau Admin
              </h2>
              <p className="text-xs text-slate-600 leading-relaxed">
                Berkas KTM atau screenshot Biodata SIAKAD Anda sudah diterima dan sedang diperiksa oleh Admin kampus. Fitur melapor barang akan terbuka otomatis setelah disetujui.
              </p>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2 text-xs text-amber-900">
            <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <span>
              Jika ingin verifikasi otomatis tanpa menunggu, Anda dapat mengunggah ulang foto KTM atau screenshot Biodata SIAKAD yang tulisannya lebih jelas.
            </span>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 pt-1">
            <button
              type="button"
              onClick={() => router.push('/akun/pengaturan')}
              className="flex-1 min-h-11 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
            >
              Cek Status / Ganti Berkas
            </button>
            <button
              type="button"
              onClick={() => router.push('/')}
              className="flex-1 min-h-11 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
            >
              Kembali ke Beranda
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
