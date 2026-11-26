-- =====================================================================
-- MIGRASI: PANEL ADMIN (DATA MASTER & STATUS AKUN)
-- Idempoten: aman dijalankan berulang kali di Supabase SQL Editor.
--
-- Isi migrasi ini:
--   1. Tabel `locations` dan `categories` untuk data master kampus.
--   2. RLS: semua orang boleh membaca, hanya Superadmin yang boleh
--      menambah dan menghapus.
--   3. Data awal lokasi dan kategori agar form laporan langsung siap.
--   4. Kolom `profiles.is_active` + trigger yang mencegah pengguna
--      menaikkan peran, mengaktifkan diri sendiri, atau mengunci
--      Superadmin terakhir.
--
-- Catatan: sensor barang memakai kolom `items.is_sensitive` yang sudah
-- ada. Policy `items_update` sudah mengizinkan Satpam dan Superadmin,
-- jadi tidak perlu tabel baru untuk sensor.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. FUNGSI BANTU: CEK PERAN SUPERADMIN
--    SECURITY DEFINER agar policy tidak memicu rekursi RLS profiles.
-- ---------------------------------------------------------------------
create or replace function public.is_superadmin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (select p.role = 'SUPERADMIN' from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

-- ---------------------------------------------------------------------
-- 1. TABEL LOKASI
-- ---------------------------------------------------------------------
create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  name text not null
    check (name = btrim(name) and char_length(name) between 1 and 80),
  created_at timestamptz not null default now()
);

-- Nama lokasi tidak boleh sama tanpa membedakan huruf besar/kecil.
create unique index if not exists locations_name_key
  on public.locations (lower(name));

-- ---------------------------------------------------------------------
-- 2. TABEL KATEGORI
-- ---------------------------------------------------------------------
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null
    check (name = btrim(name) and char_length(name) between 1 and 80),
  created_at timestamptz not null default now()
);

create unique index if not exists categories_name_key
  on public.categories (lower(name));

-- ---------------------------------------------------------------------
-- 3. ROW LEVEL SECURITY
-- ---------------------------------------------------------------------
alter table public.locations enable row level security;
alter table public.categories enable row level security;

drop policy if exists locations_select on public.locations;
create policy locations_select
  on public.locations for select
  using (true);

drop policy if exists locations_insert_superadmin on public.locations;
create policy locations_insert_superadmin
  on public.locations for insert to authenticated
  with check (public.is_superadmin());

drop policy if exists locations_delete_superadmin on public.locations;
create policy locations_delete_superadmin
  on public.locations for delete to authenticated
  using (public.is_superadmin());

drop policy if exists categories_select on public.categories;
create policy categories_select
  on public.categories for select
  using (true);

drop policy if exists categories_insert_superadmin on public.categories;
create policy categories_insert_superadmin
  on public.categories for insert to authenticated
  with check (public.is_superadmin());

drop policy if exists categories_delete_superadmin on public.categories;
create policy categories_delete_superadmin
  on public.categories for delete to authenticated
  using (public.is_superadmin());

-- ---------------------------------------------------------------------
-- 4. HAK AKSES DASAR
-- ---------------------------------------------------------------------
grant select on public.locations to anon, authenticated;
grant select on public.categories to anon, authenticated;
grant insert, delete on public.locations to authenticated;
grant insert, delete on public.categories to authenticated;

-- ---------------------------------------------------------------------
-- 5. DATA AWAL
--    `on conflict do nothing` menjaga data yang sudah diubah admin.
-- ---------------------------------------------------------------------
insert into public.locations (name) values
  ('Gedung A'),
  ('Perpustakaan'),
  ('Kantin'),
  ('Parkiran'),
  ('Masjid'),
  ('Lab Komputer')
on conflict do nothing;

insert into public.categories (name) values
  ('Identitas/KTM'),
  ('Elektronik'),
  ('Kunci'),
  ('Dompet'),
  ('Lainnya')
on conflict do nothing;

-- ---------------------------------------------------------------------
-- 6. STATUS AKTIF AKUN
--    Akun nonaktif tidak boleh login. Hanya Superadmin yang boleh
--    mengubah status ini lewat API server (Service Role Key).
-- ---------------------------------------------------------------------
alter table public.profiles
  add column if not exists is_active boolean not null default true;

-- Policy `profiles_update_self` mengizinkan pemilik mengubah barisnya
-- sendiri. Trigger ini menutup celah agar pemilik tidak dapat menaikkan
-- perannya sendiri atau mengaktifkan kembali akun yang dinonaktifkan.
-- Permintaan Service Role tidak memiliki auth.uid(), sehingga API admin
-- tetap dapat mengubah kolom tersebut.
create or replace function public.protect_profile_privileged_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() = old.id
     and not public.is_superadmin()
     and (
       new.role is distinct from old.role
       or new.role_label is distinct from old.role_label
       or new.is_active is distinct from old.is_active
     )
  then
    raise exception 'Peran dan status akun hanya dapat diubah oleh Superadmin.';
  end if;

  -- Jaring pengaman: Superadmin terakhir tidak boleh mengunci dirinya
  -- sendiri lewat klien langsung. API admin memakai Service Role sehingga
  -- auth.uid() bernilai null dan tidak terkena aturan ini.
  if auth.uid() = old.id
     and old.role = 'SUPERADMIN'
     and old.is_active
     and (new.role <> 'SUPERADMIN' or new.is_active = false)
     and not exists (
       select 1
       from public.profiles p
       where p.role = 'SUPERADMIN'
         and p.is_active
         and p.id <> old.id
     )
  then
    raise exception 'Superadmin terakhir tidak dapat menurunkan atau menonaktifkan dirinya sendiri.';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_profile_privileged_fields on public.profiles;
create trigger protect_profile_privileged_fields
  before update on public.profiles
  for each row execute function public.protect_profile_privileged_fields();
