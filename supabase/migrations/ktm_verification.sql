-- =====================================================================
-- MIGRASI: VERIFIKASI IDENTITAS MAHASISWA & KTM
-- Idempoten: aman dijalankan berulang di Supabase SQL Editor.
-- =====================================================================

-- 1. Tambah kolom ktm_url dan ktm_verified ke tabel profiles
alter table public.profiles add column if not exists ktm_url text;
alter table public.profiles add column if not exists ktm_verified boolean not null default false;

-- 2. Bucket storage untuk foto KTM mahasiswa
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ktm-cards',
  'ktm-cards',
  true,
  5242880, -- 5 MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Policy: Authenticated users can upload their own KTM
drop policy if exists ktm_cards_insert_own on storage.objects;
create policy ktm_cards_insert_own
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'ktm-cards'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy: Authenticated users can update/overwrite their own KTM
drop policy if exists ktm_cards_update_own on storage.objects;
create policy ktm_cards_update_own
  on storage.objects for update to authenticated
  using (
    bucket_id = 'ktm-cards'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'ktm-cards'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy: Read access for authenticated or public display
drop policy if exists ktm_cards_read on storage.objects;
create policy ktm_cards_read
  on storage.objects for select
  using (bucket_id = 'ktm-cards');
