'use client';

import { useState } from 'react';
import {
  AlertCircle,
  ClipboardList,
  History,
  ImageOff,
  Inbox,
  RefreshCw,
  Send,
  UserCheck,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import ComplaintQueue from '@/components/ui/ComplaintQueue';
import ComplaintStatusBadge from '@/components/ui/ComplaintStatusBadge';
import PhotoCapture from '@/components/ui/PhotoCapture';
import {
  COMPLAINT_CATEGORIES,
  COMPLAINT_DESCRIPTION_MAX,
  COMPLAINT_DESCRIPTION_MIN,
} from '@/lib/complaints';
import type { ComplaintFormState } from '@/types';

type PengaduanTab = 'BUAT' | 'RIWAYAT' | 'ANTREAN';

const EMPTY_FORM: ComplaintFormState = {
  category: '',
  incidentDate: '',
  description: '',
  photoFile: null,
};

function todayInputValue(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

// Halaman pengaduan: pelapor mengirim laporan dan memantau statusnya.
// Admin dan Satpam mendapat tab antrean yang sama untuk menindaklanjuti.
export default function PengaduanView() {
  const { currentUser, myComplaints, complaintsError, refreshData, submitComplaint } = useApp();
  const isStaff =
    currentUser?.role === 'SATPAM' || currentUser?.role === 'SUPERADMIN';

  const [tab, setTab] = useState<PengaduanTab>(isStaff ? 'ANTREAN' : 'BUAT');
  const [form, setForm] = useState<ComplaintFormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    const saved = await submitComplaint(form);
    setSubmitting(false);

    if (saved) {
      setForm(EMPTY_FORM);
      setTab('RIWAYAT');
    }
  };

  return (
    <div className="flex-1 p-4 space-y-4 lg:mx-auto lg:max-w-5xl">
      <div className="bg-blue-700 rounded-2xl p-4 text-white shadow">
        <h1 className="text-base font-black">
          Pengaduan Kampus
        </h1>
        <p className="text-xs text-blue-100 mt-0.5">
          Laporkan masalah fasilitas, keamanan, atau kebersihan kampus.
        </p>
      </div>

      <div
        className={`grid gap-1 bg-slate-200 p-1 rounded-xl ${
          isStaff ? 'grid-cols-3' : 'grid-cols-2'
        }`}
      >
        {isStaff && (
          <button
            type="button"
            onClick={() => setTab('ANTREAN')}
            className={`min-h-11 px-1 rounded-lg text-[11px] font-bold transition ${
              tab === 'ANTREAN' ? 'bg-white text-blue-800 shadow-sm' : 'text-slate-600'
            }`}
          >
            Antrean Masuk
          </button>
        )}
        <button
          type="button"
          onClick={() => setTab('BUAT')}
          className={`min-h-11 px-1 rounded-lg text-[11px] font-bold transition ${
            tab === 'BUAT' ? 'bg-white text-blue-800 shadow-sm' : 'text-slate-600'
          }`}
        >
          Buat Pengaduan
        </button>
        <button
          type="button"
          onClick={() => setTab('RIWAYAT')}
          className={`min-h-11 px-1 rounded-lg text-[11px] font-bold transition ${
            tab === 'RIWAYAT' ? 'bg-white text-blue-800 shadow-sm' : 'text-slate-600'
          }`}
        >
          Riwayat Saya
        </button>
      </div>

      {tab === 'ANTREAN' && isStaff && <ComplaintQueue />}

      {tab === 'BUAT' && (
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-3.5"
        >
          <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-900 border-b border-slate-100 pb-2">
            <ClipboardList className="w-4 h-4 text-blue-700" />
            <span>Formulir Pengaduan</span>
          </div>

          {currentUser && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
              <p className="flex items-center gap-1.5 text-[10px] font-bold text-blue-800 uppercase tracking-wider">
                <UserCheck className="w-3.5 h-3.5" /> Identitas Pelapor
              </p>
              <p className="text-xs font-extrabold text-slate-900 mt-1">
                {currentUser.name}
              </p>
              <p className="text-[11px] text-slate-600 font-mono">
                {currentUser.idType}: {currentUser.identifier}
              </p>
            </div>
          )}

          <div>
            <label
              htmlFor="complaint-category"
              className="block text-xs font-bold text-slate-800 mb-1"
            >
              Kategori *
            </label>
            <select
              id="complaint-category"
              required
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full min-h-11 px-3 rounded-xl border border-slate-300 bg-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="" disabled>
                Pilih kategori pengaduan
              </option>
              {COMPLAINT_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="complaint-date"
              className="block text-xs font-bold text-slate-800 mb-1"
            >
              Tanggal Kejadian *
            </label>
            <input
              id="complaint-date"
              type="date"
              required
              max={todayInputValue()}
              value={form.incidentDate}
              onChange={(e) => setForm({ ...form, incidentDate: e.target.value })}
              className="w-full min-h-11 px-3 rounded-xl border border-slate-300 bg-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div>
            <label
              htmlFor="complaint-description"
              className="block text-xs font-bold text-slate-800 mb-1"
            >
              Deskripsi Kejadian *
            </label>
            <textarea
              id="complaint-description"
              rows={5}
              required
              minLength={COMPLAINT_DESCRIPTION_MIN}
              maxLength={COMPLAINT_DESCRIPTION_MAX}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Jelaskan lokasi dan detail kejadian..."
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
            <div className="flex items-center justify-between gap-2 mt-1">
              <p className="text-xs text-slate-600">
                Min. {COMPLAINT_DESCRIPTION_MIN} karakter
              </p>
              <p
                className={`text-xs font-bold shrink-0 ${
                  form.description.trim().length < COMPLAINT_DESCRIPTION_MIN
                    ? 'text-amber-700'
                    : 'text-slate-600'
                }`}
              >
                {form.description.trim().length}/{COMPLAINT_DESCRIPTION_MAX}
              </p>
            </div>
          </div>

          <PhotoCapture
            file={form.photoFile}
            onChange={(photoFile) => setForm({ ...form, photoFile })}
            label="Foto Bukti"
            optional
            accent="blue"
            hint="Format JPG/PNG/WebP, maks. 2 MB."
          />

          <button
            type="submit"
            disabled={submitting}
            aria-busy={submitting}
            className="min-h-11 w-full bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5 transition active:scale-95"
          >
            <Send className="w-4 h-4" />
            {submitting ? 'Mengirim...' : 'Kirim Pengaduan'}
          </button>
        </form>
      )}

      {tab === 'RIWAYAT' && (
        <div className="space-y-3">
          <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-900">
            <History className="w-4 h-4 text-blue-700" />
            <span>Riwayat Pengaduan</span>
          </div>

          {complaintsError ? (
            <div className="bg-white rounded-2xl p-6 border border-rose-200 shadow-sm text-center space-y-3">
              <AlertCircle className="w-9 h-9 text-rose-600 mx-auto" />
              <p className="text-sm font-bold text-slate-900">Riwayat pengaduan belum bisa dimuat</p>
              <button
                type="button"
                onClick={() => void refreshData()}
                className="min-h-11 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl inline-flex items-center justify-center gap-1.5 transition"
              >
                <RefreshCw className="w-4 h-4" /> Coba Lagi
              </button>
            </div>
          ) : myComplaints.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 border border-slate-100 shadow-sm text-center">
              <Inbox className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-800">Belum ada pengaduan</p>
              <button
                type="button"
                onClick={() => setTab('BUAT')}
                className="min-h-11 mt-3 px-4 bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs rounded-xl transition active:scale-95"
              >
                Buat Pengaduan
              </button>
            </div>
          ) : (
            myComplaints.map((complaint) => (
              <article
                key={complaint.id}
                className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                      {complaint.category}
                    </span>
                    <p className="text-xs text-slate-600 mt-1">
                      Dikirim {complaint.createdAt}
                    </p>
                  </div>
                  <ComplaintStatusBadge status={complaint.status} />
                </div>

                <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  Kejadian {complaint.incidentDateLabel}
                </p>
                <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line">
                  {complaint.description}
                </p>

                {complaint.photoUrl ? (
                  <a
                    href={complaint.photoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={complaint.photoUrl}
                      alt={`Foto bukti pengaduan ${complaint.category}`}
                      className="w-full max-w-[280px] aspect-video object-cover rounded-xl border border-slate-200 hover:opacity-90"
                    />
                    <span className="inline-block text-xs font-bold text-blue-700 mt-1">
                      Buka foto ukuran penuh
                    </span>
                  </a>
                ) : complaint.photoPath ? (
                  <p className="flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-2.5">
                    <ImageOff className="w-3.5 h-3.5" /> Foto bukti tidak dapat dimuat
                    saat ini.
                  </p>
                ) : null}
              </article>
            ))
          )}
        </div>
      )}
    </div>
  );
}
