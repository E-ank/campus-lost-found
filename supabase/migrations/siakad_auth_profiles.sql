-- =====================================================================
-- MIGRASI: AUTENTIKASI ALA SIAKAD (Lost & Found Kampus)
-- Idempoten: aman dijalankan berulang kali di Supabase SQL Editor.
--
-- Isi migrasi ini:
--   1. Tabel `profiles` + kolom tambahan untuk alur akun dari kampus.
--   2. Trigger otomatis: setiap akun baru di auth.users langsung dibuatkan profil.
--   3. RLS: profil hanya boleh dibaca semua, diubah oleh pemiliknya.
--   4. Storage bucket `avatars` + policy unggah foto wajah per pemilik.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. TABEL PROFIL
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'MAHASISWA',
  role_label text not null default 'Mahasiswa',
  name text not null default 'Tanpa Nama',
  identifier text not null default '-',
  id_type text not null default 'NIM',
  department text not null default 'Belum diisi',
  phone text not null default '-',
  avatar_bg text not null default 'bg-blue-600',
  created_at timestamptz not null default now()
);

-- Kolom baru untuk alur SIAKAD (foto wajah, gmail pribadi, status wajib ganti sandi).
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists email_personal text not null default '';
alter table public.profiles add column if not exists must_change_password boolean not null default false;
alter table public.profiles add column if not exists profile_completed boolean not null default true;
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

-- Identitas kampus tidak boleh dipakai dua akun.
create unique index if not exists profiles_identifier_key
  on public.profiles (upper(identifier));

-- ---------------------------------------------------------------------
-- 2. TRIGGER: BUAT PROFIL OTOMATIS SAAT AKUN BARU DIBUAT
--    Sumber data: user_metadata yang dikirim oleh API impor akun.
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_must_change boolean;
begin
  v_must_change := coalesce((new.raw_user_meta_data ->> 'must_change_password')::boolean, false);

  insert into public.profiles (
    id,
    role,
    role_label,
    name,
    identifier,
    id_type,
    department,
    avatar_bg,
    must_change_password,
    profile_completed
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'role', 'MAHASISWA'),
    coalesce(new.raw_user_meta_data ->> 'role_label', 'Mahasiswa'),
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'identifier', upper(split_part(new.email, '@', 1))),
    coalesce(new.raw_user_meta_data ->> 'id_type', 'NIM'),
    coalesce(new.raw_user_meta_data ->> 'department', 'Belum diisi'),
    'bg-blue-600',
    v_must_change,
    case when v_must_change then false else true end
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- 3. ROW LEVEL SECURITY
-- ---------------------------------------------------------------------
alter table public.profiles enable row level security;

drop policy if exists profiles_read_all on public.profiles;
create policy profiles_read_all
  on public.profiles for select
  using (true);

drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ---------------------------------------------------------------------
-- 4. STORAGE BUCKET FOTO WAJAH
--    Publik dibaca (agar foto wajah tampil di kartu profil),
--    hanya pemilik folder `{user_id}/...` yang boleh menulis.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

drop policy if exists avatars_read on storage.objects;
create policy avatars_read
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists avatars_insert_own on storage.objects;
create policy avatars_insert_own
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists avatars_update_own on storage.objects;
create policy avatars_update_own
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists avatars_delete_own on storage.objects;
create policy avatars_delete_own
  on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
