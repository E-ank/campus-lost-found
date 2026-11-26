'use client';

import { Suspense, useEffect, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  AlertCircle,
  ChevronDown,
  ChevronLeft,
  Eye,
  EyeOff,
  Info,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  google_cancelled: 'Masuk dengan Google dibatalkan. Silakan coba lagi bila ingin melanjutkan.',
  oauth_state_missing: 'Sesi login Google kedaluwarsa. Silakan ulangi proses masuk.',
  oauth_state_invalid: 'Sesi login Google tidak valid. Silakan ulangi proses masuk.',
  oauth_state_mismatch: 'Validasi keamanan OAuth gagal. Silakan coba masuk kembali.',
  google_secret_missing: 'Konfigurasi Google OAuth di server belum lengkap. Hubungi Admin.',
  google_token_failed: 'Gagal memverifikasi token dari Google. Periksa koneksi lalu coba lagi.',
  google_id_token_missing: 'Google tidak mengirimkan token identitas. Silakan ulangi.',
  supabase_google_signin_failed: 'Akun Google gagal masuk ke sistem autentikasi kampus.',
  google_oauth_not_configured: 'Login Google belum dikonfigurasi. Gunakan akun SIAKAD/Petugas atau hubungi Admin.',
  auth_callback_failed: 'Autentikasi callback gagal. Silakan coba masuk kembali.',
};

function GoogleIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3.03h3.88c2.27-2.09 3.665-5.17 3.665-9.12z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.03c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.13C3.26 21.36 7.33 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.29c-.25-.72-.38-1.49-.38-2.29s.13-1.57.38-2.29V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.13z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.13c.95-2.83 3.6-4.96 6.72-4.96z"
      />
    </svg>
  );
}

export default function LoginView() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-slate-600">Memuat halaman masuk...</div>}>
      <LoginViewInner />
    </Suspense>
  );
}

function LoginViewInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentUser, authLoading, signIn, redirectIntent } = useApp();

  const [loginInputId, setLoginInputId] = useState<string>('');
  const [loginPassword, setLoginPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showStaffLogin, setShowStaffLogin] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [googleLoading, setGoogleLoading] = useState<boolean>(false);

  useEffect(() => {
    if (authLoading || !currentUser || submitting || googleLoading) return;
    if (currentUser.mustChangePassword || !currentUser.profileCompleted) {
      router.replace('/akun/pengaturan');
      return;
    }
    if (currentUser.role === 'SATPAM') router.replace('/satpam');
    else if (currentUser.role === 'SUPERADMIN') router.replace('/admin');
    else router.replace('/');
  }, [authLoading, currentUser, googleLoading, router, submitting]);

  const errorCode = searchParams.get('error');
  const oauthErrorMessage = errorCode
    ? OAUTH_ERROR_MESSAGES[errorCode] ?? 'Proses masuk gagal. Silakan coba lagi.'
    : null;

  const targetRedirectPath = (() => {
    const rawPath = redirectIntent?.path || '/';
    if (redirectIntent?.openClaim && rawPath.startsWith('/barang/')) {
      const separator = rawPath.includes('?') ? '&' : '?';
      return `${rawPath}${separator}openClaim=1`;
    }
    return rawPath;
  })();

  const googleAuthHref = `/auth/google?next=${encodeURIComponent(targetRedirectPath)}`;

  const handleSubmitLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    const ok = await signIn(loginInputId, loginPassword);
    setSubmitting(false);
    if (ok) setLoginPassword('');
  };

  return (
    <div className="flex-1 p-6 flex flex-col justify-between bg-white lg:mx-auto lg:max-w-md lg:rounded-3xl lg:border lg:border-slate-200 lg:shadow-sm lg:my-auto">
      <div>
        <button
          type="button"
          onClick={() => router.push('/')}
          className="inline-flex items-center gap-1 min-h-11 px-1 text-xs font-semibold text-slate-700 hover:text-blue-700 mb-3 rounded-lg focus-visible:outline-2 focus-visible:outline-blue-700"
        >
          <ChevronLeft className="w-4 h-4" /> Kembali
        </button>

        <div className="bg-blue-700 rounded-2xl p-4 text-white shadow-sm mb-5">
          <h2 className="text-base font-extrabold">Masuk Akun Lost &amp; Found Kampus</h2>
          <p className="text-xs text-blue-100 mt-1 leading-relaxed">
            Cukup 1 klik menggunakan akun Google Anda. Setiap NIM/identitas hanya dapat terhubung ke 1 akun agar serah terima barang tetap aman.
          </p>
          {redirectIntent && (
            <div className="mt-2.5 bg-white/15 rounded-lg p-2 text-[11px] text-white flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 shrink-0" />
              <span>Akan dialihkan ke halaman tujuan setelah masuk.</span>
            </div>
          )}
        </div>

        {oauthErrorMessage && (
          <div
            role="alert"
            className="mb-4 bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-start gap-2.5 text-xs text-rose-900"
          >
            <AlertCircle className="w-4 h-4 text-rose-700 shrink-0 mt-0.5" />
            <span>{oauthErrorMessage}</span>
          </div>
        )}

        {/* Jalur Utama: Masuk dengan Google */}
        <div className="space-y-3 mb-5">
          <a
            href={googleAuthHref}
            onClick={(e) => {
              if (googleLoading || submitting) {
                e.preventDefault();
                return;
              }
              setGoogleLoading(true);
            }}
            aria-disabled={googleLoading || submitting}
            className={`w-full min-h-12 flex items-center justify-center gap-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-3 px-4 rounded-xl shadow-sm transition active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 ${
              googleLoading || submitting ? 'opacity-60 pointer-events-none' : ''
            }`}
          >
            {googleLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Mengalihkan ke Google...</span>
              </>
            ) : (
              <>
                <span className="w-6 h-6 rounded-full bg-white flex items-center justify-center shrink-0">
                  <GoogleIcon className="w-3.5 h-3.5" />
                </span>
                <span>Masuk atau Daftar dengan Google</span>
              </>
            )}
          </a>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
            <p className="text-xs text-slate-700 leading-relaxed">
              Setelah masuk, Anda bisa langsung melihat daftar barang. Verifikasi identitas (foto KTM atau screenshot Biodata SIAKAD) hanya dilakukan sekali saat akan melapor atau mengklaim barang.
            </p>
          </div>
        </div>

        {/* Jalur Khusus Petugas / Akun SIAKAD */}
        <div className="border-t border-slate-200 pt-4">
          <button
            type="button"
            onClick={() => setShowStaffLogin((prev) => !prev)}
            aria-expanded={showStaffLogin}
            className="w-full min-h-11 flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold text-slate-800 hover:bg-slate-100 transition focus-visible:outline-2 focus-visible:outline-blue-700"
          >
            <span>Masuk sebagai Petugas Satpam / Admin / SIAKAD</span>
            <ChevronDown
              className={`w-4 h-4 text-slate-600 transition-transform ${showStaffLogin ? 'rotate-180' : ''}`}
            />
          </button>

          {showStaffLogin && (
            <form onSubmit={handleSubmitLogin} className="space-y-3.5 mt-3 pt-3 border-t border-slate-100">
              <div>
                <label htmlFor="login-id" className="block text-xs font-bold text-slate-800 mb-1">
                  ID Petugas / NIM / NIDN
                </label>
                <input
                  id="login-id"
                  type="text"
                  required
                  value={loginInputId}
                  onChange={(e) => setLoginInputId(e.target.value)}
                  placeholder="Masukkan nomor identitas..."
                  className="w-full min-h-11 px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-700"
                />
              </div>

              <div>
                <label htmlFor="login-password" className="block text-xs font-bold text-slate-800 mb-1">
                  Kata Sandi
                </label>
                <div className="relative">
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Masukkan kata sandi..."
                    className="w-full min-h-11 px-3.5 py-2.5 pr-12 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-700"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                    className="absolute right-0.5 top-1/2 -translate-y-1/2 min-h-11 min-w-11 inline-flex items-center justify-center text-slate-600 hover:text-slate-900 rounded-xl focus-visible:outline-2 focus-visible:outline-blue-700"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting || googleLoading}
                className="w-full min-h-11 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white font-bold text-xs py-3 rounded-xl transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
              >
                {submitting ? 'Memproses...' : 'Masuk dengan Akun Kampus'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
