---
version: alpha
name: Campus Lost & Found
description: Sistem informasi kehilangan & temuan barang kampus (PNUP). Mobile-first (ponsel <1024px, desktop ≥1024px), berbasis layanan publik mahasiswa dan satpam.
colors:
  primary: "#2563eb"
  primary-deep: "#1d4ed8"
  on-primary: "#ffffff"
  background: "#f8fafc"
  surface: "#ffffff"
  ink: "#0f172a"
  muted: "#475569"
  faint: "#64748b"
  success-soft: "#d1fae5"
  success-ink: "#065f46"
  warning-soft: "#fef3c7"
  warning-ink: "#92400e"
  danger-soft: "#ffe4e6"
  danger-ink: "#9f1239"
  focus-ring: "#1d4ed8"
typography:
  h1:
    fontFamily: system-ui
    fontSize: 1.25rem
    fontWeight: 800
    lineHeight: 1.3
  h2:
    fontFamily: system-ui
    fontSize: 1rem
    fontWeight: 800
    lineHeight: 1.35
  body-md:
    fontFamily: system-ui
    fontSize: 0.875rem
    fontWeight: 400
    lineHeight: 1.6
  body-sm:
    fontFamily: system-ui
    fontSize: 0.75rem
    fontWeight: 400
    lineHeight: 1.55
  label-caps:
    fontFamily: system-ui
    fontSize: 0.625rem
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: 0.06em
rounded:
  sm: 12px
  md: 16px
  lg: 24px
spacing:
  sm: 8px
  md: 16px
  lg: 24px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.sm}"
    padding: 12px
  button-primary-hover:
    backgroundColor: "{colors.primary-deep}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.sm}"
    padding: 12px
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
  header-band:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
  meta-label:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.muted}"
    typography: "{typography.label-caps}"
  meta-timestamp:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.faint}"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
  badge-approved:
    backgroundColor: "{colors.success-soft}"
    textColor: "{colors.success-ink}"
  badge-pending:
    backgroundColor: "{colors.warning-soft}"
    textColor: "{colors.warning-ink}"
  badge-rejected:
    backgroundColor: "{colors.danger-soft}"
    textColor: "{colors.danger-ink}"
  button-primary-focus:
    backgroundColor: "{colors.focus-ring}"
    textColor: "{colors.on-primary}"
---

## Overview

Aplikasi layanan kampus yang dikerjakan cepat dan jujur: pengguna
mahasiswa melapor atau mengklaim barang dalam waktu singkat, satpam
memproses antrean. Ponsel tetap acuan pertama karena mayoritas
pengguna melapor dari tempat kejadian, tetapi tata letak yang sama
melebar ke desktop (sidebar + konten lebar) tanpa menambah gaya baru.
Tampilan memakai bahasa "utilitas biru kerajaan": satu warna inti biru,
netral slate untuk struktur, dan warna semantik khusus status.
Keramahan dibangun lewat hierarki tebal-tipis, bukan lewat dekorasi.

Arah: ENERGI 2 (tegas di elemen kerja, tenang di sekitarnya) /
RITME 2 (list seragam yang disengaja untuk pemindaian cepat, panel
detail memberi variasi) / MOTION 1 (hanya umpan balik: overlay masuk
secara halus sekali sebagai penanda perubahan keadaan, konten list
statik).

## Colors

Palet inti dibatasi 2 warna + 1 kelompok semantik, sisanya netral:

- **Primary (#2563eb, blue-600):** biru kerajaan, dipakai untuk aksi
  utama, header, dan elemen aktif. Alasannya: identitas internal yang
  sudah digunakan secara konsisten sejak awal aplikasi dan pembeda
  kuat dari latar putih/netral.
- **Primary-deep (#1d4ed8):** nada tekan (hover) dari primary.
- **On-primary (#ffffff):** teks di atas primary dan header.
- **Ink (#0f172a, slate-900):** teks utama; kontras maksimal di atas
  permukaan putih.
- **Muted (#475569, slate-600) dan Faint (#64748b, slate-500):** teks
  pendukung dan metadata; value minimal yang masih lolos WCAG AA
  (4.5:1) di atas putih. Lebih terang dari ini dilarang untuk teks.
- **Surface (#ffffff) / Background (#f8fafc, slate-50) / Border
  (#e2e8f0, slate-200):** struktur halaman tanpa ikut menyaingi aksi.
- **Semantik status (dipakai hanya untuk status, bukan dekorasi):**
  - **Success:** latar `success-soft (#d1fae5)` + teks `success-ink
    (#065f46)`; jangkar warna emerald-600 kelas Tailwind di kode.
    Klaim disetujui, serah terima selesai.
  - **Warning:** latar `warning-soft (#fef3c7)` + teks `warning-ink
    (#92400e)`; jangkar amber-700. Menunggu, perlu perhatian.
  - **Danger:** latar `danger-soft (#ffe4e6)` + teks `danger-ink
    (#9f1239)`; jangkar rose-600. Ditolak, tindakan destruktif.
  Alasannya: status harus terbaca sebagai label dalam kontras AA di
  semua latar, jadi dipasangkan lembut-gelap, bukan warna penuh.
- **Focus-ring (#1d4ed8):** cincin konsentrasi keyboard dan tap.

Larangan: gradasi biru-ungu, glow pendar, glassmorphism, dan ornamen
radial tidak dipakai sebagai karakter. Satu-satunya pengecualian yang
pernah ada (blob dekoratif hero) telah dihapus dalam pembersihan
antislop karena tanpa alasan (R-01/R-13).

## Typography

- **FontFamily `system-ui`:** aplikasi layanan internal kampus;
  keterbacaan instan di semua perangkat tanpa unduhan font (performa
  data seluler mahasiswa), bukan pernyataan gaya. Ini dipilih dengan
  sengaja dan tertulis di sini sebagai alasannya (R-06/R-31).
- **H1/H2 sangat tebal (800):** judul dan nama barang dipindai cepat
  di feed.
- **body-sm 12px:** deskripsi dan pesan; tidak boleh di bawah 12px
  untuk teks yang harus dibaca, hanya label meta boleh lebih kecil.
- **label-caps 10px + spacing 0.06em + UPPERCASE:** khusus label meta
  pendek (Lokasi, Waktu, Status tiket, label tabel satpam) supaya
  terlihat sebagai label, bukan isi. Dilarang untuk kalimat atau
  judul konten. Alasan: membedakan kategori informasi dari isinya
  secara sekilas pada layar kecil (R-06, alasan tertulis).

## Layout

Tata letak punya dua mode dengan ambang `lg` (1024px), dan keduanya
mengikuti alur kerja yang sama: daftar (feed/riwayat) → panel detail
→ tindakan.

- **Ponsel (<1024px, tetap acuan pertama):** satu kolom maksimal 28rem
  (max-w-md) terpusat; navigasi lewat bilah bawah yang menempel.
- **Desktop (≥1024px):** sidebar kiri tetap 248px, bilah atas lengket
  putih di dalam area konten, konten maksimal 1240px dengan padding
  36/28px. Navigasi pindah dari bilah bawah ke sidebar; bilah bawah
  disembunyikan. Tujuannya bukan menambah elemen, hanya
  memindahkan navigasi agar konten lebar terbaca tanpa gulir sempit.
- Feed barang memakai grid responsif: 2 kolom di ponsel, 3 kolom
  (`lg`) dan 4 kolom (`xl`) di desktop, gap 16px.
- View satu kolom (form lapor/edit, detail barang, pengaturan,
  pengaduan, riwayat klaim) dibatasi lebar bacanya (`lg:max-w-3xl`
  sampai `lg:max-w-4xl`, terpusat) supaya baris teks tidak melebar;
  dashboard petugas/admin memakai lebar penuh konten (1240px).
- Spacing sm/md/lg dipetakan ke 8/16/24px; kartu feed memakai gap 16px.
- Tap target minimum 44px untuk semua kontrol aksi (R-03).
- List seragam adalah keputusan RITME 2 yang disengaja: feed harus
  bisa dipindai satu gerakan mata; variasi diberikan oleh
  panel detail dan kartu aksi khusus.

## Elevation & Depth

- Shadow dipakai hemat sebagai penanda lapisan: header sticky (1
  bayangan lembut), kartu aksi penting (nama lembut), overlay modal
  (bayangan kuat). Item daftar normal tanpa bayangan berat.
- Alasannya: menandai ketinggian interaksi yang sedang aktif, bukan
  membuat seluruh halaman ambang (R-12).

## Shapes

- Rounded sm (12px) untuk kontrol (tombol, input), md (16px) kartu,
  lg (24px) kontainer luar dan kartu panel besar.
- Konsisten; tidak satu pun elemen pill murni kecuali badge status
  kecil yang berhenti di sisi 999px karena berbentuk label tag.

## Components

- **button-primary** {colors.primary}/{colors.on-primary}: aksi
  utama konteks (Lapor, Selesaikan). Hover = primary-deep.
- **card:** permukaan isi umum; latar putih di atas background
  slate-50 memberi pemisahan tanpa garis tambahan (R-01).
- **header-band:** biru penuh untuk pita header; satu-satunya blok
  warna besar per halaman, sebagai penanda identitas.
- **meta-label:** label meta memakai typography label-caps dengan
  warna muted (bukan lebih terang), sejalan dengan keputusan kontras.
- **sidebar & topbar (desktop saja):** sidebar putih berbatas
  slate-200; item navigasi aktif memakai latar slate-100 + teks warna
  aksen peran (bukan blok biru penuh, agar `header-band` tetap
  satu-satunya blok warna besar). Topbar putih lengket berisi pencarian
  global dan tombol aksi utama. Keduanya memakai `useNavItems` yang
  sama dengan bilah bawah ponsel, jadi tidak ada tujuan yang berbeda
  antar mode.

Gerak aplikasi terbatas pada **umpan balik keadaan**: overlay chat,
modal login, dan overlay kamera memakai fade-in masuk sekali karena
mereka menandai pergantian konteks. Konten daftar dan panel statis
tidak dianimasikan (R-19, alasan di sini).

## Do's and Don'ts

- **Do:** satu menit fokus visual per layar; kartu aksi utama.
- **Do:** teks pada media folk foto: gunakan kontras kuat, ukuran
  minimal 10px, warna tidak lebih terang dari muted/faint untuk teks
  yang harus dibaca.
- **Do:** setiap overlay/modal dapat ditutup dengan tombol X **dan
  tombol Escape**.
- **Don't:** warna biru-ungu/pink, glow, grid blueprint, emoji pada
  tombol, Ikon semata, ikon Sparkles-klise, klaim keamanan tanpa
  bukti, angka tanpa sumber.
- **Don't:** teks abu-abu terang slate-300/400 untuk teks nyata di
  atas putih; itu gagal WCAG AA.
- **Don't:** animasi pada daftar; gerak hanya untuk masuk overlay.
- **Don't:** mengklaim fitur/penghitung/kompetensi (mis.
  "terenkripsi") yang tidak dapat dibuktikan.
