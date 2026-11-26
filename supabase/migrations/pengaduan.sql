-- =====================================================================
-- MIGRASI: LAPORAN PENGADUAN
-- Idempoten: aman dijalankan berulang kali di Supabase SQL Editor.
--
-- Isi migrasi ini:
--   1. Tabel `complaints` untuk laporan pengaduan pengguna.
--   2. RLS: pelapor melihat miliknya sendiri, Admin/Satpam melihat semua
--      dan hanya Admin/Satpam yang boleh mengubah status.
--   3. Bucket privat `complaint-photos` + policy unggah/baca foto bukti.
--   4. Realtime untuk daftar pengaduan di dashboard petugas.
--
-- Catatan: tabel chat lama (`chat_messages`, `chat_reads`) sengaja tidak
-- dihapus di sini. Fitur chat sudah dilepas dari aplikasi, tetapi data
-- lama tetap disimpan agar tidak hilang tanpa persetujuan pemilik data.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. FUNGSI BANTU: CEK PERAN PETUGAS
--    Disalin dengan `create or replace` supaya migrasi ini tetap aman
--    bila dijalankan pada database yang belum punya fungsi is_staff().
-- ---------------------------------------------------------------------
create or replace function public.is_staff()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (select p.role in ('SATPAM', 'SUPERADMIN') from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

-- ---------------------------------------------------------------------
-- 1. TABEL PENGADUAN
-- ---------------------------------------------------------------------
create table if not exists public.complaints (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  -- Salinan identitas saat laporan dibuat, agar riwayat tetap terbaca
  -- meskipun biodata pengguna berubah di kemudian hari.
  reporter_name text not null default '',
  reporter_identifier text not null default '-',
  category text not null,
  description text not null check (char_length(description) between 20 and 1000),
  incident_date date not null,
  -- Path objek di bucket privat `complaint-photos`, bukan URL publik.
  photo_path text,
  status text not null default 'Menunggu'
    check (status in ('Menunggu', 'Diproses', 'Selesai', 'Ditolak')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists complaints_created_at_idx
  on public.complaints (created_at desc);
create index if not exists complaints_reporter_idx
  on public.complaints (reporter_id);
create index if not exists complaints_status_idx
  on public.complaints (status);

-- ---------------------------------------------------------------------
-- 1b. IDENTITAS PELAPOR DIISI DARI PROFIL
--     Nilai dari klien diabaikan agar nama/NIM tidak bisa dipalsukan.
--     Salinan tetap disimpan agar riwayat tidak berubah saat biodata diedit.
-- ---------------------------------------------------------------------
create or replace function public.set_complaint_reporter()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_identifier text;
begin
  select p.name, p.identifier
    into v_name, v_identifier
    from public.profiles p
   where p.id = new.reporter_id;

  if v_name is not null then
    new.reporter_name := v_name;
  end if;
  if v_identifier is not null then
    new.reporter_identifier := v_identifier;
  end if;

  return new;
end;
$$;

drop trigger if exists complaints_set_reporter on public.complaints;
create trigger complaints_set_reporter
  before insert on public.complaints
  for each row execute function public.set_complaint_reporter();

-- ---------------------------------------------------------------------
-- 2. TIMESTAMP UPDATE OTOMATIS
-- ---------------------------------------------------------------------
create or replace function public.touch_complaint_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists complaints_touch_updated_at on public.complaints;
create trigger complaints_touch_updated_at
  before update on public.complaints
  for each row execute function public.touch_complaint_updated_at();

-- ---------------------------------------------------------------------
-- 3. ROW LEVEL SECURITY
-- ---------------------------------------------------------------------
alter table public.complaints enable row level security;

drop policy if exists complaints_select on public.complaints;
create policy complaints_select
  on public.complaints for select to authenticated
  using (reporter_id = auth.uid() or public.is_staff());

drop policy if exists complaints_insert on public.complaints;
create policy complaints_insert
  on public.complaints for insert to authenticated
  with check (reporter_id = auth.uid());

drop policy if exists complaints_update_staff on public.complaints;
create policy complaints_update_staff
  on public.complaints for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- Petugas hanya perlu membaca semua laporan dan mengubah status.
-- Anon tidak diberi akses langsung; RLS tetap menjadi lapisan utama.
revoke all on public.complaints from anon;
revoke delete on public.complaints from authenticated;
grant select, insert, update on public.complaints to authenticated;

-- ---------------------------------------------------------------------
-- 4. STORAGE BUCKET FOTO BUKTI (PRIVAT)
--    Foto hanya bisa dibaca pelapor pemilik folder atau petugas.
--    Aplikasi menampilkan foto lewat signed URL berumur 1 jam.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'complaint-photos',
  'complaint-photos',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = false,
      file_size_limit = 5242880,
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists complaint_photos_insert_own on storage.objects;
create policy complaint_photos_insert_own
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'complaint-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists complaint_photos_read on storage.objects;
create policy complaint_photos_read
  on storage.objects for select to authenticated
  using (
    bucket_id = 'complaint-photos'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_staff()
    )
  );

drop policy if exists complaint_photos_delete_own on storage.objects;
create policy complaint_photos_delete_own
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'complaint-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ---------------------------------------------------------------------
-- 5. REALTIME UNTUK DASHBOARD PETUGAS
--    Bila tabel sudah terdaftar, blok ini tidak melakukan apa-apa.
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1
       from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'complaints'
     )
  then
    alter publication supabase_realtime add table public.complaints;
  end if;
end $$;
