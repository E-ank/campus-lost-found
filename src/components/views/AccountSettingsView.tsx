'use client';

import { Suspense, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  Bell,
  Camera,
  CheckCircle2,
  Eye,
  EyeOff,
  GraduationCap,
  Hash,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  Phone,
  Scan,
  ShieldAlert,
  ShieldCheck,
  UploadCloud,
  UserCheck,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { createClient } from '@/lib/supabase/client';
import { extractIdentityInBrowser } from '@/lib/client-ocr';
import { DEFAULT_ACCOUNT_PASSWORD as DEFAULT_PASSWORD } from '@/lib/accounts';
import { requiresStudentIdentityVerification } from '@/lib/campus';
import { useFilePreviewUrl } from '@/lib/useFilePreviewUrl';
import { toWhatsAppNumber } from '@/lib/whatsapp';
import type { ProfileSetupFormState, UserProfile } from '@/types';

interface OcrExtracted {
  nama: string;
  nim: string;
  jurusan: string;
  documentType?: 'ktm' | 'siakad' | 'other';
  rawText?: string;
}

export default function AccountSettingsView() {
  const { currentUser, authLoading } = useApp();

  if (authLoading) {
    return (
      <div className="flex-1 p-8 flex items-center justify-center">
        <p className="text-xs font-bold text-slate-600 uppercase tracking-widest">
          Memuat sesi...
        </p>
      </div>
    );
  }

  if (!currentUser) {
    return <NeedsLoginNotice />;
  }

  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-slate-600">Memuat formulir...</div>}>
      <AccountSettingsForm key={currentUser.id} user={currentUser} />
    </Suspense>
  );
}

function NeedsLoginNotice() {
  const router = useRouter();
  return (
    <div className="flex-1 p-6 flex flex-col items-center justify-center text-center">
      <ShieldAlert className="w-10 h-10 text-slate-500 mb-3" />
      <p className="text-sm font-bold text-slate-900">Anda Belum Masuk</p>
      <p className="text-xs text-slate-600 mt-1 mb-4">
        Silakan masuk dengan akun Google atau akun kampus untuk mengatur profil Anda.
      </p>
      <button
        type="button"
        onClick={() => router.push('/login')}
        className="min-h-11 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-sm"
      >
        Ke Halaman Masuk
      </button>
    </div>
  );
}

function AccountSettingsForm({ user }: { user: UserProfile }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isMahasiswa = requiresStudentIdentityVerification(user.role);
  const isOnboarding =
    isMahasiswa && (searchParams?.get('onboarding') === '1' || !user.profileCompleted);

  const supabase = useMemo(() => createClient(), []);
  const { updateProfile, showToast } = useApp();

  const mustReplacePassword = user.mustChangePassword;
  const isIdentityLocked = Boolean(
    (isMahasiswa && user.ktmVerified) ||
      (!isMahasiswa && user.identifier && user.identifier !== '-')
  );

  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const avatarObjectUrl = useFilePreviewUrl(avatarFile);

  const [ktmFile, setKtmFile] = useState<File | null>(null);
  const ktmObjectUrl = useFilePreviewUrl(ktmFile);
  const [scanningDoc, setScanningDoc] = useState(false);
  const [scanProgress, setScanProgress] = useState<number>(0);
  const [ocrData, setOcrData] = useState<OcrExtracted | null>(null);

  const [wantChangePassword, setWantChangePassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState<ProfileSetupFormState>({
    name: user.name || '',
    identifier: user.identifier === '-' ? '' : user.identifier,
    password: '',
    confirmPassword: '',
    emailPersonal: user.emailPersonal || '',
    phone: user.phone === '-' ? '' : user.phone,
    department:
      user.department === '-' || user.department === 'Belum diisi'
        ? ''
        : user.department,
  });

  const avatarPreview = avatarObjectUrl || user.avatarUrl || '';
  const ktmPreview = ktmObjectUrl || user.ktmUrl || '';

  const passwordRequired = mustReplacePassword || wantChangePassword;

  const handleAvatarChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Berkas Tidak Sesuai', 'Unggah berkas gambar berformat JPG, PNG, atau WEBP.', 'error');
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      showToast('Ukuran Terlalu Besar', 'Maksimal 3 MB agar proses unggah lancar.', 'error');
      return;
    }

    setAvatarFile(file);
  };

  const handleKtmChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Berkas Tidak Sesuai', 'Unggah gambar berformat JPG, PNG, atau WEBP.', 'error');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast('Ukuran Terlalu Besar', 'Maksimal ukuran gambar adalah 5 MB.', 'error');
      return;
    }

    setKtmFile(file);
    setOcrData(null);
    setScanProgress(5);
    setScanningDoc(true);

    try {
      let extracted: OcrExtracted | null = null;
      let extractedPhone = '';

      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 8000);
        const fd = new FormData();
        fd.append('file', file);
        const res = await fetch('/api/verify-ktm', {
          method: 'POST',
          body: fd,
          signal: controller.signal,
        });
        clearTimeout(timer);
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data && !json.needsClientOcr) {
            extracted = {
              nama: json.data.nama || '',
              nim: json.data.nim || '',
              jurusan: json.data.jurusan || '',
              documentType: json.data.documentType,
              rawText: json.data.rawText || '',
            };
          }
        }
      } catch {
        // Lanjut ke OCR browser
      }

      if (!extracted) {
        const browserResult = await extractIdentityInBrowser(file, (pct) => {
          setScanProgress(pct);
        });
        extracted = {
          nama: browserResult.nama || '',
          nim: browserResult.nim || '',
          jurusan: browserResult.jurusan || '',
          documentType: browserResult.documentType,
          rawText: browserResult.rawText || '',
        };
        extractedPhone = browserResult.phone || '';
      }

      if (extracted && (extracted.nim || extracted.nama || extracted.jurusan)) {
        setOcrData(extracted);

        setForm((prev) => ({
          ...prev,
          identifier: !isIdentityLocked && extracted.nim ? extracted.nim : prev.identifier,
          name: !isIdentityLocked && extracted.nama ? extracted.nama : prev.name,
          department: extracted.jurusan ? extracted.jurusan : prev.department,
          phone: !prev.phone && extractedPhone ? extractedPhone : prev.phone,
        }));

        const docLabel =
          extracted.documentType === 'siakad' ? 'Screenshot Biodata SIAKAD' : 'Dokumen KTM';
        showToast(
          `${docLabel} Terbaca`,
          'NIM, Nama Lengkap, dan Program Studi telah diisi otomatis. Periksa lalu klik Simpan.',
          'success'
        );
      } else {
        showToast(
          'Teks Tidak Terbaca Otomatis',
          'Silakan isi NIM, Nama Lengkap, dan Prodi secara manual lalu simpan.',
          'info'
        );
      }
    } catch {
      showToast(
        'Pemindaian Dilewati',
        'Gambar terlalu buram atau waktu habis. Silakan lengkapi biodata secara manual lalu klik simpan.',
        'info'
      );
    } finally {
      setScanningDoc(false);
      setScanProgress(0);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    if (passwordRequired) {
      if (form.password.length < 8) {
        showToast('Kata Sandi Terlalu Pendek', 'Gunakan minimal 8 karakter.', 'error');
        return;
      }
      if (form.password === DEFAULT_PASSWORD) {
        showToast(
          'Masih Memakai Sandi Bawaan',
          'Buat kata sandi baru yang hanya Anda ketahui.',
          'error'
        );
        return;
      }
      if (form.password !== form.confirmPassword) {
        showToast('Konfirmasi Tidak Cocok', 'Ulangi kata sandi baru dengan tepat.', 'error');
        return;
      }
    }

    if (isMahasiswa && !ktmFile && !user.ktmUrl) {
      showToast(
        'Bukti Identitas Wajib Diunggah',
        'Unggah foto KTM fisik atau screenshot Biodata SIAKAD sebagai verifikasi identitas.',
        'error'
      );
      return;
    }

    if (!avatarFile && !user.avatarUrl) {
      showToast(
        'Foto Profil Wajib Diunggah',
        'Foto profil ditampilkan pada laporan barang dan dipakai saat serah terima barang.',
        'error'
      );
      return;
    }

    if (!form.name.trim()) {
      showToast('Nama Wajib Diisi', 'Isi nama lengkap Anda sesuai identitas kampus.', 'error');
      return;
    }

    if (!form.identifier.trim()) {
      showToast(
        `${user.idType || 'Nomor Identitas'} Wajib Diisi`,
        `Isi ${user.idType || 'nomor identitas'} Anda yang terdaftar.`,
        'error'
      );
      return;
    }

    if (!form.department.trim()) {
      showToast('Unit / Prodi Wajib Diisi', 'Isi program studi atau unit kerja Anda.', 'error');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.emailPersonal.trim())) {
      showToast('Email Belum Valid', 'Masukkan email aktif, misalnya nama@gmail.com.', 'error');
      return;
    }

    if (!form.phone.trim() || !toWhatsAppNumber(form.phone)) {
      showToast(
        'Nomor WhatsApp Belum Valid',
        'Masukkan nomor WhatsApp aktif minimal 9 digit angka (contoh: 081234567890).',
        'error'
      );
      return;
    }

    setSubmitting(true);

    // 1. Unggah Foto Profil jika ada berkas baru
    let finalAvatarUrl = user.avatarUrl ?? '';
    if (avatarFile) {
      const ext = avatarFile.name.split('.').pop()?.toLowerCase() ?? 'jpg';
      const avatarPath = `${user.id}/avatar-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(avatarPath, avatarFile, { upsert: true, cacheControl: '3600' });

      if (uploadError) {
        setSubmitting(false);
        showToast('Gagal Mengunggah Foto Profil', uploadError.message, 'error');
        return;
      }
      finalAvatarUrl = supabase.storage.from('avatars').getPublicUrl(avatarPath).data.publicUrl;
    }

    // 2. Unggah Bukti Identitas (KTM / SS Biodata SIAKAD) khusus mahasiswa
    let finalKtmUrl = user.ktmUrl ?? '';
    if (isMahasiswa && ktmFile) {
      const ext = ktmFile.name.split('.').pop()?.toLowerCase() ?? 'jpg';
      const ktmPath = `${user.id}/ktm-${Date.now()}.${ext}`;

      const { error: ktmUploadError } = await supabase.storage
        .from('ktm-cards')
        .upload(ktmPath, ktmFile, { upsert: true, cacheControl: '3600' });

      if (ktmUploadError) {
        const fallbackPath = `${user.id}/ktm-${Date.now()}.${ext}`;
        const fallbackRes = await supabase.storage
          .from('avatars')
          .upload(fallbackPath, ktmFile, { upsert: true, cacheControl: '3600' });

        if (fallbackRes.error) {
          setSubmitting(false);
          showToast('Gagal Mengunggah Berkas KTM', fallbackRes.error.message, 'error');
          return;
        }
        finalKtmUrl = supabase.storage.from('avatars').getPublicUrl(fallbackPath).data.publicUrl;
      } else {
        finalKtmUrl = supabase.storage.from('ktm-cards').getPublicUrl(ktmPath).data.publicUrl;
      }
    }

    // 3. Validasi Ketat 1 Akun = 1 Identitas + Evaluasi Auto-Verifikasi di Server
    let autoVerified = Boolean(!isMahasiswa || (user.ktmVerified && !ktmFile));
    let serverUpdated = false;
    try {
      const nimCheckRes = await fetch('/api/verify-nim-claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: form.identifier.trim(),
          name: form.name.trim(),
          phone: form.phone.trim(),
          department: form.department.trim(),
          ktmUrl: finalKtmUrl,
          isNewKtmUpload: Boolean(ktmFile),
          ocrNim: ocrData?.nim || '',
          ocrName: ocrData?.nama || '',
          rawOcrText: ocrData?.rawText || '',
        }),
      });

      const nimCheck = await nimCheckRes.json();
      if (!nimCheckRes.ok || !nimCheck.allowed) {
        setSubmitting(false);
        showToast(
          'Identitas Ditolak (1 Akun = 1 Identitas)',
          nimCheck.message || 'Nomor identitas atau nomor WhatsApp sudah terdaftar di akun lain.',
          'error'
        );
        return;
      }
      autoVerified = Boolean(nimCheck.autoVerified);
      serverUpdated = Boolean(nimCheck.serverUpdated);
    } catch (checkErr) {
      setSubmitting(false);
      showToast(
        'Gagal Memverifikasi Identitas',
        checkErr instanceof Error ? checkErr.message : 'Tidak dapat terhubung ke server verifikasi.',
        'error'
      );
      return;
    }

    // 4. Simpan perubahan profil
    const finalVerified = Boolean((user.ktmVerified && !ktmFile) || autoVerified);
    const saved = await updateProfile({
      password: passwordRequired ? form.password : undefined,
      name: isIdentityLocked ? user.name : form.name.trim(),
      identifier: isIdentityLocked ? user.identifier : form.identifier.trim(),
      department: form.department.trim(),
      emailPersonal: form.emailPersonal.trim(),
      phone: form.phone.trim(),
      avatarUrl: finalAvatarUrl,
      ktmUrl: isMahasiswa ? finalKtmUrl || undefined : undefined,
      ktmVerified: isMahasiswa ? finalVerified : undefined,
      skipKtmVerifiedUpdate: serverUpdated,
    });

    setSubmitting(false);

    if (saved) {
      if (isMahasiswa && !finalVerified) {
        showToast(
          'Berkas KTM Tersimpan',
          'Dokumen KTM/SIAKAD Anda telah disimpan dan masuk antrean tinjauan Admin kampus.',
          'info'
        );
      }
      router.push(user.role === 'SATPAM' ? '/satpam' : user.role === 'SUPERADMIN' ? '/admin' : '/');
    }
  };

  const idLabel = isMahasiswa ? 'Nomor Induk Mahasiswa (NIM)' : user.idType || 'Nomor Identitas';
  const deptLabel = isMahasiswa ? 'Program Studi / Jurusan' : 'Unit / Bagian / Prodi';

  return (
    <div className="flex-1 p-4 space-y-4 lg:mx-auto lg:max-w-3xl">
      {!mustReplacePassword && !isOnboarding && (
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => router.push('/')}
            className="inline-flex items-center gap-1 min-h-11 px-1 text-xs font-semibold text-slate-700 hover:text-blue-700 rounded-lg focus-visible:outline-2 focus-visible:outline-blue-700"
          >
            <ArrowLeft className="w-4 h-4" /> Kembali ke Beranda
          </button>
          <button
            type="button"
            onClick={() => router.push('/klaim?tab=notifikasi')}
            className="inline-flex items-center gap-1.5 min-h-11 text-xs font-bold text-blue-800 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 px-3.5 py-2 rounded-xl border border-blue-200 transition shadow-xs focus-visible:outline-2 focus-visible:outline-blue-700"
          >
            <Bell className="w-3.5 h-3.5" /> Pusat Pemberitahuan
          </button>
        </div>
      )}

      {/* Kartu status akun */}
      <div className="bg-blue-700 rounded-2xl p-4 text-white shadow">
        <div className="flex items-center gap-3">
          {avatarPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarPreview}
              alt="Foto profil"
              className="w-12 h-12 rounded-xl object-cover border border-white/30"
            />
          ) : (
            <div className="w-12 h-12 rounded-xl border border-white/30 flex items-center justify-center bg-white/10">
              <Camera className="w-5 h-5 text-white/80" />
            </div>
          )}
          <div className="min-w-0">
            <h2 className="text-base font-black truncate">{form.name || user.name}</h2>
            <div className="text-[11px] text-blue-100 flex flex-wrap items-center gap-1.5 mt-0.5">
              <span>{form.identifier || `${user.idType} Belum Diisi`}</span>
              <span>·</span>
              <span>{user.roleLabel}</span>
              {isMahasiswa && (
                user.ktmVerified ? (
                  <span className="inline-flex items-center gap-1 bg-emerald-500/25 text-emerald-100 px-2 py-0.5 rounded text-[10px] font-bold border border-emerald-400/30">
                    <CheckCircle2 className="w-3 h-3 text-emerald-200" /> Identitas Terverifikasi
                  </span>
                ) : user.ktmUrl || ktmPreview ? (
                  <span className="inline-flex items-center gap-1 bg-amber-400/25 text-amber-100 px-2 py-0.5 rounded text-[10px] font-bold border border-amber-300/30">
                    <ShieldAlert className="w-3 h-3 text-amber-200" /> Menunggu Verifikasi Admin
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 bg-white/15 text-white px-2 py-0.5 rounded text-[10px] font-semibold">
                    Belum Verifikasi Identitas
                  </span>
                )
              )}
            </div>
          </div>
        </div>
      </div>

      {isMahasiswa && user.ktmRejected && !user.ktmUrl && !ktmFile && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 shadow-xs flex items-start gap-3">
          <div className="p-2 bg-rose-700 text-white rounded-xl shrink-0 mt-0.5">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xs font-black text-rose-950 uppercase tracking-wider">
              Berkas KTM Sebelumnya Ditolak Admin
            </h3>
            <p className="text-xs text-rose-900 mt-0.5 leading-relaxed">
              Foto KTM/SIAKAD sebelumnya belum dapat diverifikasi karena kurang jelas atau tidak sesuai data. Silakan unggah ulang foto yang jelas dan terbaca.
            </p>
          </div>
        </div>
      )}

      {isOnboarding && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-blue-600 rounded-xl text-white shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-black text-blue-950 uppercase tracking-wider">
                Verifikasi Identitas (1 Akun = 1 Identitas)
              </h3>
              <p className="text-xs text-blue-900 mt-0.5 leading-relaxed">
                Unggah <strong>foto fisik KTM</strong> atau <strong>screenshot halaman Biodata SIAKAD</strong> Anda. Jika Nama dan NIM terbaca cocok, akun Anda langsung terverifikasi otomatis tanpa menunggu Admin.
              </p>
            </div>
          </div>
        </div>
      )}

      {isMahasiswa && user.ktmUrl && !user.ktmVerified && !isOnboarding && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 shadow-xs flex items-start gap-3">
          <div className="p-2 bg-amber-600 text-white rounded-xl shrink-0 mt-0.5">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xs font-black text-amber-950 uppercase tracking-wider">
              Menunggu Verifikasi Admin
            </h3>
            <p className="text-xs text-amber-900 mt-0.5 leading-relaxed">
              Dokumen identitas Anda sedang dalam antrean tinjauan Admin. Anda juga bisa mengunggah ulang foto KTM atau screenshot Biodata SIAKAD yang lebih jelas untuk mencoba verifikasi otomatis.
            </p>
          </div>
        </div>
      )}

      {isMahasiswa && user.ktmVerified && !isOnboarding && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 shadow-xs flex items-start gap-3">
          <div className="p-2 bg-emerald-700 text-white rounded-xl shrink-0 mt-0.5">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xs font-black text-emerald-950 uppercase tracking-wider">
              Identitas Terverifikasi Resmi
            </h3>
            <p className="text-xs text-emerald-900 mt-0.5 leading-relaxed">
              Nama dan NIM Anda telah dikunci sesuai dokumen resmi untuk memudahkan verifikasi saat serah terima barang.
            </p>
          </div>
        </div>
      )}

      {mustReplacePassword && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 flex gap-2">
          <ShieldAlert className="w-4 h-4 text-amber-800 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-900 leading-relaxed">
            Ganti kata sandi bawaan ({DEFAULT_PASSWORD}) untuk mulai menggunakan akun.
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {isMahasiswa && (
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-blue-50 text-blue-700">
                  <GraduationCap className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                    KTM atau Screenshot Biodata SIAKAD *
                  </h3>
                  <p className="text-xs text-slate-600">
                    Pilih salah satu: foto fisik KTM atau tangkapan layar menu Biodata SIAKAD
                  </p>
                </div>
              </div>

              {user.ktmVerified ? (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-900 bg-emerald-100 px-2.5 py-1 rounded-full shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" /> Terverifikasi
                </span>
              ) : ktmPreview ? (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-900 bg-amber-100 px-2.5 py-1 rounded-full shrink-0">
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-700" /> Belum Diverifikasi
                </span>
              ) : (
                <span className="text-xs text-slate-700 font-semibold shrink-0">Wajib</span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
              <div className="relative aspect-[16/10] rounded-xl overflow-hidden border-2 border-dashed border-slate-300 bg-slate-50 flex flex-col items-center justify-center p-3 text-center">
                {ktmPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={ktmPreview}
                    alt="Pratinjau dokumen identitas"
                    className="w-full h-full object-cover rounded-lg"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-slate-600 py-4">
                    <UploadCloud className="w-8 h-8 mb-2 stroke-[1.5]" />
                    <p className="text-xs font-semibold text-slate-800">Belum ada dokumen</p>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      Format JPG/PNG/WEBP, maks. 5 MB
                    </p>
                  </div>
                )}

                {scanningDoc && (
                  <div className="absolute inset-0 bg-slate-900/80 flex flex-col items-center justify-center text-white p-3 text-center">
                    <Loader2 className="w-6 h-6 animate-spin mb-2" />
                    <p className="text-xs font-bold">
                      Membaca Nama, NIM &amp; Prodi... {scanProgress > 0 ? `${scanProgress}%` : ''}
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-2.5">
                <label className="inline-flex items-center justify-center gap-2 w-full min-h-11 px-4 py-2.5 rounded-xl border border-blue-600 bg-blue-50 hover:bg-blue-100 text-blue-900 text-xs font-bold cursor-pointer transition focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-blue-700">
                  <UploadCloud className="w-4 h-4" />
                  <span>
                    {scanningDoc
                      ? 'Memindai Dokumen...'
                      : ktmPreview
                        ? 'Ganti Foto KTM / SS SIAKAD'
                        : 'Unggah Foto KTM / SS SIAKAD'}
                  </span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleKtmChange}
                    disabled={scanningDoc}
                    className="sr-only"
                  />
                </label>

                <p className="text-xs text-slate-600 leading-relaxed">
                  Pastikan tulisan <strong>Nama</strong>, <strong>NIM</strong>, dan <strong>Program Studi</strong> terlihat jelas pada foto KTM atau screenshot halaman <code>Biodata Saya</code> di SIAKAD.
                </p>

                {ocrData && (ocrData.nim || ocrData.nama || ocrData.jurusan) && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 text-xs text-emerald-950 space-y-0.5">
                    <p className="font-bold flex items-center gap-1.5">
                      <Scan className="w-3.5 h-3.5 text-emerald-700" />
                      Terbaca dari {ocrData.documentType === 'siakad' ? 'Biodata SIAKAD' : 'KTM'}:
                    </p>
                    {ocrData.nama && <p>Nama: <strong>{ocrData.nama}</strong></p>}
                    {ocrData.nim && <p>NIM: <strong className="font-mono">{ocrData.nim}</strong></p>}
                    {ocrData.jurusan && <p>Prodi: <strong>{ocrData.jurusan}</strong></p>}
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center gap-1.5 mb-3">
            <Camera className="w-4 h-4 text-blue-700" />
            <h3 className="text-xs font-extrabold text-slate-900">
              Foto Profil / Foto Wajah *
            </h3>
          </div>

          <div className="flex items-center gap-3">
            {avatarPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarPreview}
                alt="Pratinjau foto wajah"
                className="w-20 h-20 rounded-2xl object-cover border border-slate-200"
              />
            ) : (
              <div className="w-20 h-20 rounded-2xl border-2 border-dashed border-slate-300 flex items-center justify-center bg-slate-50">
                <Camera className="w-6 h-6 text-slate-500" />
              </div>
            )}

            <div className="flex-1">
              <label className="inline-flex items-center min-h-11 px-4 py-2 rounded-xl border border-blue-300 bg-blue-50 text-blue-900 text-xs font-bold cursor-pointer hover:bg-blue-100 transition focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-blue-700">
                Pilih Foto Profil
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleAvatarChange}
                  className="sr-only"
                />
              </label>
              <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                Foto profil tampil pada informasi pelapor barang dan membantu pencocokan identitas saat serah terima.
              </p>
            </div>
          </div>
        </section>

        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <UserCheck className="w-4 h-4 text-blue-700" />
              <h3 className="text-xs font-extrabold text-slate-900">
                Biodata {user.roleLabel}
              </h3>
            </div>
            {isIdentityLocked && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-lg">
                <Lock className="w-3 h-3" /> Identitas Terkunci
              </span>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="acc-identifier" className="block text-xs font-bold text-slate-800">
                {idLabel} *
              </label>
              {isMahasiswa && user.ktmVerified && (
                <span className="text-[11px] text-emerald-800 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Terverifikasi
                </span>
              )}
            </div>
            <div className="relative">
              <Hash className="w-4 h-4 text-slate-600 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="acc-identifier"
                type="text"
                required
                readOnly={isIdentityLocked}
                value={form.identifier}
                onChange={(e) => setForm({ ...form, identifier: e.target.value })}
                placeholder="Contoh: 47125005"
                className={`w-full min-h-11 pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-mono font-medium focus:outline-none focus:ring-2 focus:ring-blue-700 ${
                  isIdentityLocked ? 'bg-slate-100 text-slate-700 cursor-not-allowed' : 'bg-white text-slate-900'
                }`}
              />
            </div>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              {isIdentityLocked
                ? 'Nomor identitas terkunci sesuai data resmi kampus. Hubungi Admin bila perlu perubahan.'
                : 'Setiap identitas hanya dapat terhubung ke 1 akun untuk mencegah akun ganda.'}
            </p>
          </div>

          <div>
            <label htmlFor="acc-name" className="block text-xs font-bold text-slate-800 mb-1">
              Nama Lengkap *
            </label>
            <input
              id="acc-name"
              type="text"
              required
              readOnly={isIdentityLocked}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Nama lengkap sesuai identitas resmi"
              className={`w-full min-h-11 px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-blue-700 ${
                isIdentityLocked ? 'bg-slate-100 text-slate-700 cursor-not-allowed' : 'bg-white text-slate-900'
              }`}
            />
          </div>

          <div>
            <label htmlFor="acc-dept" className="block text-xs font-bold text-slate-800 mb-1">
              {deptLabel} *
            </label>
            <div className="relative">
              <GraduationCap className="w-4 h-4 text-slate-600 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="acc-dept"
                type="text"
                required
                value={form.department}
                onChange={(e) => setForm({ ...form, department: e.target.value })}
                placeholder={isMahasiswa ? 'Contoh: D4 Teknik Komputer dan Jaringan' : 'Contoh: Keamanan Kampus'}
                className="w-full min-h-11 pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-700"
              />
            </div>
          </div>

          <div>
            <label htmlFor="acc-email" className="block text-xs font-bold text-slate-800 mb-1">
              Email Aktif *
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-600 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="acc-email"
                type="email"
                required
                value={form.emailPersonal}
                onChange={(e) => setForm({ ...form, emailPersonal: e.target.value })}
                placeholder="nama@gmail.com"
                className="w-full min-h-11 pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-700"
              />
            </div>
          </div>

          <div>
            <label htmlFor="acc-phone" className="block text-xs font-bold text-slate-800 mb-1">
              Nomor WhatsApp Aktif *
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-slate-600 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="acc-phone"
                type="tel"
                inputMode="tel"
                required
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="0812-3456-7890"
                className="w-full min-h-11 pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-700"
              />
            </div>
          </div>
        </section>

        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <KeyRound className="w-4 h-4 text-blue-700" />
              <h3 className="text-xs font-extrabold text-slate-900">Keamanan &amp; Kata Sandi</h3>
            </div>
            {!mustReplacePassword && (
              <button
                type="button"
                onClick={() => {
                  const next = !wantChangePassword;
                  setWantChangePassword(next);
                  if (!next) {
                    setForm((prev) => ({ ...prev, password: '', confirmPassword: '' }));
                    setShowPassword(false);
                    setShowConfirmPassword(false);
                  }
                }}
                className="min-h-11 px-2 text-xs font-bold text-blue-700 underline rounded-lg focus-visible:outline-2 focus-visible:outline-blue-700"
              >
                {wantChangePassword ? 'Batal atur' : 'Atur / ganti kata sandi'}
              </button>
            )}
          </div>

          {passwordRequired ? (
            <>
              <div>
                <label htmlFor="acc-pass" className="block text-xs font-bold text-slate-800 mb-1">
                  Kata Sandi Baru * (minimal 8 karakter)
                </label>
                <div className="relative">
                  <input
                    id="acc-pass"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder="Buat kata sandi pribadi..."
                    className="w-full min-h-11 pl-3.5 pr-12 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-700"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Sembunyikan kata sandi baru' : 'Tampilkan kata sandi baru'}
                    className="absolute right-1 top-1/2 -translate-y-1/2 min-h-11 min-w-11 inline-flex items-center justify-center text-slate-600 hover:text-slate-900 rounded-lg focus-visible:outline-2 focus-visible:outline-blue-700"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label htmlFor="acc-pass2" className="block text-xs font-bold text-slate-800 mb-1">
                  Ulangi Kata Sandi Baru *
                </label>
                <div className="relative">
                  <input
                    id="acc-pass2"
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={form.confirmPassword}
                    onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                    placeholder="Ketik ulang kata sandi baru..."
                    className="w-full min-h-11 pl-3.5 pr-12 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-700"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    aria-label={showConfirmPassword ? 'Sembunyikan konfirmasi sandi' : 'Tampilkan konfirmasi sandi'}
                    className="absolute right-1 top-1/2 -translate-y-1/2 min-h-11 min-w-11 inline-flex items-center justify-center text-slate-600 hover:text-slate-900 rounded-lg focus-visible:outline-2 focus-visible:outline-blue-700"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <p className="text-xs text-slate-600">
              Akun terhubung dengan Google atau kata sandi kampus aktif.
            </p>
          )}
        </section>

        <button
          type="submit"
          disabled={submitting || scanningDoc}
          className="w-full min-h-12 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold text-xs py-3.5 rounded-xl shadow-sm transition flex items-center justify-center gap-2"
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Menyimpan Profil...
            </>
          ) : (
            <>
              <ShieldCheck className="w-4 h-4" />{' '}
              {isMahasiswa ? 'Simpan & Verifikasi Identitas' : 'Simpan Profil'}
            </>
          )}
        </button>
      </form>
    </div>
  );
}
