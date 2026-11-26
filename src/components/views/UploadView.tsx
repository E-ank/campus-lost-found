'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Loader2, PackageCheck, Search, ShieldAlert } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import PhotoCapture from '@/components/ui/PhotoCapture';
import { SECURITY_POST_OPTIONS } from '@/lib/campus';
import type { Item, UploadFormState } from '@/types';

interface UploadViewProps {
  editItemId?: string;
}

export default function UploadView({ editItemId }: UploadViewProps) {
  const router = useRouter();
  const {
    currentUser,
    items,
    dataLoading,
    locations,
    categories,
    reportItem,
    updateReport,
  } = useApp();

  const isEditMode = Boolean(editItemId);
  const editingItem = editItemId ? items.find((item) => item.id === editItemId) : undefined;

  if (isEditMode && !editingItem) {
    if (dataLoading) {
      return (
        <div className="flex-1 p-4 lg:mx-auto lg:max-w-3xl">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 text-center">
            <p className="text-xs font-bold text-slate-600 uppercase tracking-widest">
              Memuat data laporan...
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="flex-1 p-4 lg:mx-auto lg:max-w-3xl">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 text-center space-y-4">
          <p className="text-sm font-semibold text-slate-800">
            Laporan tidak ditemukan atau sudah dihapus.
          </p>
          <button
            type="button"
            onClick={() => router.push('/')}
            className="w-full min-h-11 bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs py-3 rounded-xl shadow-md transition"
          >
            Kembali ke Beranda
          </button>
        </div>
      </div>
    );
  }

  // Laporan yang sudah selesai diserahkan tidak dapat disunting lagi.
  if (isEditMode && editingItem && editingItem.status === 'Selesai') {
    return (
      <div className="flex-1 p-4 lg:mx-auto lg:max-w-3xl">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 text-center space-y-4">
          <p className="text-sm font-bold text-slate-900">
            Laporan yang sudah selesai diserahkan tidak dapat disunting.
          </p>
          <button
            type="button"
            onClick={() => router.push(`/barang/${editingItem.id}`)}
            className="w-full min-h-11 bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs py-3 rounded-xl transition"
          >
            Kembali ke Detail Barang
          </button>
        </div>
      </div>
    );
  }

  // Otorisasi sunting: hanya pelapor pemilik atau Satpam/Superadmin.
  if (isEditMode && editingItem && currentUser) {
    const isStaff = currentUser.role === 'SATPAM' || currentUser.role === 'SUPERADMIN';
    if (editingItem.reporterUserId !== currentUser.id && !isStaff) {
      return (
        <div className="flex-1 p-4 lg:mx-auto lg:max-w-3xl">
          <div className="bg-white rounded-2xl border border-rose-200 shadow-sm p-6 text-center space-y-4">
            <p className="text-sm font-bold text-slate-900">
              Anda tidak memiliki izin untuk menyunting laporan ini.
            </p>
            <button
              type="button"
              onClick={() => router.push(`/barang/${editingItem.id}`)}
              className="w-full min-h-11 bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs py-3 rounded-xl transition"
            >
              Kembali ke Detail Barang
            </button>
          </div>
        </div>
      );
    }
  }

  return (
    <UploadFormInner
      key={editingItem?.id ?? 'new-report'}
      editItemId={editItemId}
      editingItem={editingItem}
      locations={locations}
      categories={categories}
      currentUserName={currentUser?.name}
      reportItem={reportItem}
      updateReport={updateReport}
    />
  );
}

function UploadFormInner({
  editItemId,
  editingItem,
  locations,
  categories,
  currentUserName,
  reportItem,
  updateReport,
}: {
  editItemId?: string;
  editingItem?: Item;
  locations: string[];
  categories: string[];
  currentUserName?: string;
  reportItem: (form: UploadFormState) => Promise<string | null>;
  updateReport: (itemId: string, form: UploadFormState) => Promise<boolean>;
}) {
  const router = useRouter();
  const isEditMode = Boolean(editItemId && editingItem);

  const [uploadForm, setUploadForm] = useState<UploadFormState>(() => {
    if (editingItem) {
      return {
        type: editingItem.type,
        title: editingItem.title,
        category: editingItem.category,
        location: editingItem.location,
        datetime: editingItem.date,
        description: editingItem.description,
        storageType: editingItem.storageType === 'NONE' ? 'SATPAM' : editingItem.storageType,
        securityPost:
          editingItem.securityPost && editingItem.securityPost !== '-'
            ? editingItem.securityPost
            : SECURITY_POST_OPTIONS[0],
        secretQuestion: editingItem.secretQuestion,
        secretAnswerHint: editingItem.secretAnswerHint,
        isSensitive: editingItem.isSensitive,
        photoFile: null,
      };
    }

    return {
      type: 'FOUND',
      title: '',
      category: categories[0] ?? '',
      location: locations[0] ?? '',
      datetime: '',
      description: '',
      storageType: 'SATPAM',
      securityPost: SECURITY_POST_OPTIONS[0],
      secretQuestion: '',
      secretAnswerHint: '',
      isSensitive: false,
      photoFile: null,
    };
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Isi waktu kejadian setelah mount (async) agar bebas hydration mismatch.
  useEffect(() => {
    if (isEditMode) return;
    const id = window.setTimeout(() => {
      setUploadForm((prev) =>
        prev.datetime
          ? prev
          : {
              ...prev,
              datetime:
                'Hari ini, ' +
                new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) +
                ' WIB',
            }
      );
    }, 0);
    return () => window.clearTimeout(id);
  }, [isEditMode]);

  const categoryOptions =
    uploadForm.category && !categories.includes(uploadForm.category)
      ? [uploadForm.category, ...categories]
      : categories;
  const locationOptions =
    uploadForm.location && !locations.includes(uploadForm.location)
      ? [uploadForm.location, ...locations]
      : locations;

  const effectiveCategory = uploadForm.category || categoryOptions[0] || '';
  const effectiveLocation = uploadForm.location || locationOptions[0] || '';

  const postOptions = SECURITY_POST_OPTIONS.includes(
    uploadForm.securityPost as (typeof SECURITY_POST_OPTIONS)[number]
  )
    ? [...SECURITY_POST_OPTIONS]
    : [uploadForm.securityPost, ...SECURITY_POST_OPTIONS];

  const handleUploadSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    const normalizedForm: UploadFormState = {
      ...uploadForm,
      category: effectiveCategory,
      location: effectiveLocation,
    };
    try {
      if (isEditMode && editItemId) {
        const berhasil = await updateReport(editItemId, normalizedForm);
        if (berhasil) router.push('/barang/' + editItemId);
        return;
      }

      const idBaru = await reportItem(normalizedForm);
      if (idBaru !== null) {
        router.push('/barang/' + idBaru);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex-1 p-4 space-y-4 lg:mx-auto lg:max-w-3xl">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => router.push(isEditMode && editItemId ? `/barang/${editItemId}` : '/')}
          className="inline-flex items-center gap-1 min-h-11 px-1 text-xs font-semibold text-slate-700 hover:text-blue-700 rounded-lg focus-visible:outline-2 focus-visible:outline-blue-700"
        >
          <ChevronLeft className="w-4 h-4" /> {isEditMode ? 'Kembali ke Detail' : 'Kembali'}
        </button>
        <span className="text-[11px] font-bold text-blue-800 bg-blue-50 px-3 py-1 rounded-full">
          Pelapor: {currentUserName}
        </span>
      </div>

      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-sm">
        <h2 className="text-sm font-extrabold text-slate-900 mb-3">
          {isEditMode ? 'Sunting Laporan' : 'Lapor Barang'}
        </h2>

        <div className="grid grid-cols-2 gap-2 mb-4">
          <button
            type="button"
            disabled={isEditMode}
            onClick={() => setUploadForm({ ...uploadForm, type: 'FOUND' })}
            className={`min-h-11 p-3 rounded-xl border text-left transition focus-visible:outline-2 focus-visible:outline-blue-700 ${
              uploadForm.type === 'FOUND'
                ? 'bg-blue-50 border-blue-600 ring-1 ring-blue-600'
                : 'bg-slate-50 border-slate-200'
            } ${isEditMode ? 'cursor-not-allowed opacity-75' : ''}`}
          >
            <PackageCheck
              className={`w-5 h-5 mb-1 ${
                uploadForm.type === 'FOUND' ? 'text-blue-700' : 'text-slate-600'
              }`}
            />
            <p className="text-xs font-bold text-slate-900">Barang Temuan</p>
            <p className="text-[11px] text-slate-600">Ada di penemu / pos</p>
          </button>

          <button
            type="button"
            disabled={isEditMode}
            onClick={() => setUploadForm({ ...uploadForm, type: 'LOST' })}
            className={`min-h-11 p-3 rounded-xl border text-left transition focus-visible:outline-2 focus-visible:outline-rose-700 ${
              uploadForm.type === 'LOST'
                ? 'bg-rose-50 border-rose-600 ring-1 ring-rose-600'
                : 'bg-slate-50 border-slate-200'
            } ${isEditMode ? 'cursor-not-allowed opacity-75' : ''}`}
          >
            <Search
              className={`w-5 h-5 mb-1 ${
                uploadForm.type === 'LOST' ? 'text-rose-700' : 'text-slate-600'
              }`}
            />
            <p className="text-xs font-bold text-slate-900">Barang Hilang</p>
            <p className="text-[11px] text-slate-600">Sedang dicari</p>
          </button>
        </div>

        <form onSubmit={handleUploadSubmit} className="space-y-3.5">
          <div>
            <label htmlFor="upload-title" className="block text-xs font-bold text-slate-800 mb-1">
              Nama Barang *
            </label>
            <input
              id="upload-title"
              type="text"
              required
              value={uploadForm.title}
              onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })}
              placeholder="Nama barang..."
              className="w-full min-h-11 px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label htmlFor="upload-category" className="block text-xs font-bold text-slate-800 mb-1">
                Kategori *
              </label>
              <select
                id="upload-category"
                value={effectiveCategory}
                onChange={(e) => setUploadForm({ ...uploadForm, category: e.target.value })}
                className="w-full min-h-11 px-2.5 py-2 rounded-xl border border-slate-300 text-xs bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                {categoryOptions.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="upload-location" className="block text-xs font-bold text-slate-800 mb-1">
                Lokasi *
              </label>
              <select
                id="upload-location"
                value={effectiveLocation}
                onChange={(e) => setUploadForm({ ...uploadForm, location: e.target.value })}
                className="w-full min-h-11 px-2.5 py-2 rounded-xl border border-slate-300 text-xs bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                {locationOptions.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="upload-datetime" className="block text-xs font-bold text-slate-800 mb-1">
              Waktu Kejadian *
            </label>
            <input
              id="upload-datetime"
              type="text"
              required
              value={uploadForm.datetime}
              onChange={(e) => setUploadForm({ ...uploadForm, datetime: e.target.value })}
              placeholder="Contoh: Hari ini, 14:00 WIB"
              className="w-full min-h-11 px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div>
            <label htmlFor="upload-desc" className="block text-xs font-bold text-slate-800 mb-1">
              Deskripsi *
            </label>
            <textarea
              id="upload-desc"
              rows={3}
              required
              value={uploadForm.description}
              onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })}
              placeholder={
                uploadForm.type === 'FOUND'
                  ? 'Jelaskan lokasi ditemukan secara ringkas.'
                  : 'Jelaskan ciri barang dan lokasi terakhir terlihat.'
              }
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div>
            <PhotoCapture
              file={uploadForm.photoFile}
              onChange={(f) => setUploadForm({ ...uploadForm, photoFile: f })}
              existingPhotoUrl={editingItem?.photoUrl ?? null}
              label="Foto Barang"
              optional
              accent="blue"
              previewMax="max-w-[220px]"
              hint="Kamera atau galeri. JPG/PNG/WebP, maksimal 2 MB."
            />
          </div>

          {uploadForm.type === 'FOUND' && (
            <div className="bg-blue-50/90 border border-blue-200 rounded-2xl p-3.5 space-y-3">
              <div className="flex items-center gap-1.5 text-blue-900 font-extrabold text-xs">
                <ShieldAlert className="w-4 h-4 text-blue-700 shrink-0" />
                <span>Verifikasi Kepemilikan</span>
              </div>

              <label className="min-h-11 flex items-start gap-2.5 p-2.5 rounded-xl bg-white border border-blue-200 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={
                    effectiveCategory === 'Identitas/KTM' ||
                    effectiveCategory === 'Dompet' ||
                    uploadForm.isSensitive
                  }
                  disabled={
                    effectiveCategory === 'Identitas/KTM' || effectiveCategory === 'Dompet'
                  }
                  onChange={(e) =>
                    setUploadForm({ ...uploadForm, isSensitive: e.target.checked })
                  }
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-700"
                />
                <span className="text-slate-800 leading-snug">
                  <strong className="block text-slate-900">Sensor foto barang di beranda publik</strong>
                  <span className="text-[11px] text-slate-600">
                    Kategori Identitas/KTM dan Dompet disensor otomatis; aktifkan untuk barang lain yang menampilkan data pribadi.
                  </span>
                </span>
              </label>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">
                  Penyimpanan Fisik *
                </label>
                <div className="grid grid-cols-1 gap-2">
                  <label
                    className={`min-h-11 flex items-center gap-2.5 p-2.5 rounded-xl border text-xs cursor-pointer ${
                      uploadForm.storageType === 'SATPAM'
                        ? 'bg-white border-blue-600 font-bold text-blue-900'
                        : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                  >
                    <input
                      type="radio"
                      name="storageType"
                      checked={uploadForm.storageType === 'SATPAM'}
                      onChange={() => setUploadForm({ ...uploadForm, storageType: 'SATPAM' })}
                    />
                    <span>Dititipkan ke Pos Satpam</span>
                  </label>

                  {uploadForm.storageType === 'SATPAM' && (
                    <div className="pl-6">
                      <select
                        aria-label="Pilih pos satpam penitipan"
                        value={uploadForm.securityPost}
                        onChange={(e) =>
                          setUploadForm({ ...uploadForm, securityPost: e.target.value })
                        }
                        className="w-full min-h-11 px-2.5 py-2 rounded-lg border border-blue-300 text-xs bg-white font-semibold text-blue-900"
                      >
                        {postOptions.map((post) => (
                          <option key={post} value={post}>
                            {post}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <label
                    className={`min-h-11 flex items-center gap-2.5 p-2.5 rounded-xl border text-xs cursor-pointer ${
                      uploadForm.storageType === 'FINDER'
                        ? 'bg-white border-blue-600 font-bold text-blue-900'
                        : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                  >
                    <input
                      type="radio"
                      name="storageType"
                      checked={uploadForm.storageType === 'FINDER'}
                      onChange={() => setUploadForm({ ...uploadForm, storageType: 'FINDER' })}
                    />
                    <span>Dibawa Sendiri (kontak privat)</span>
                  </label>
                </div>
              </div>

              <div>
                <label htmlFor="upload-secret-q" className="block text-xs font-bold text-slate-800 mb-1">
                  Pertanyaan Pembuktian Pemilik *
                </label>
                <input
                  id="upload-secret-q"
                  type="text"
                  required
                  value={uploadForm.secretQuestion}
                  onChange={(e) =>
                    setUploadForm({ ...uploadForm, secretQuestion: e.target.value })
                  }
                  placeholder="Cth: Apa gantungan kunci atau goresan khas barang ini?"
                  className="w-full min-h-11 px-3 py-2 rounded-xl border border-blue-300 bg-white text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
                <p className="text-[11px] text-slate-600 mt-1">
                  Pertanyaan ini wajib dijawab calon pengklaim untuk membuktikan kepemilikan sah barang.
                </p>

                <div className="mt-2 flex flex-wrap gap-1.5">
                  {[
                    'Apa wallpaper layar HP ini?',
                    'Apa stiker di bagian belakang?',
                    'Berapa nominal uang di dalam dompet?',
                    'Apa gantungan kunci khasnya?',
                  ].map((sample, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() =>
                        setUploadForm({ ...uploadForm, secretQuestion: sample })
                      }
                      className="min-h-11 text-[11px] bg-blue-100 hover:bg-blue-200 text-blue-900 px-3 py-1.5 rounded-xl transition font-semibold"
                    >
                      + &quot;{sample}&quot;
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="upload-secret-hint" className="block text-xs font-bold text-slate-800 mb-1">
                  Catatan Ciri Khas Rahasia (Hanya untuk Anda &amp; Petugas)
                </label>
                <input
                  id="upload-secret-hint"
                  type="text"
                  value={uploadForm.secretAnswerHint}
                  onChange={(e) =>
                    setUploadForm({ ...uploadForm, secretAnswerHint: e.target.value })
                  }
                  placeholder="Catatan ciri khas untuk mencocokkan jawaban saat klaim diajukan..."
                  className="w-full min-h-11 px-3 py-2 rounded-xl border border-blue-300 bg-white text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full min-h-12 bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs py-3 rounded-xl shadow-md transition disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          >
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {isEditMode
              ? isSubmitting
                ? 'Menyimpan...'
                : 'Simpan Perubahan'
              : isSubmitting
                ? 'Mengirim...'
                : 'Kirim Laporan'}
          </button>
        </form>
      </div>
    </div>
  );
}
