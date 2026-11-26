-- =====================================================================
-- BUCKET STORAGE: FOTO BARANG & FOTO SERAH TERIMA
-- ---------------------------------------------------------------------
-- Kode aplikasi mengunggah foto ke dua bucket ini, tetapi definisi bucket
-- belum ada di migrasi lain sehingga unggahan gagal dan laporan ikut gagal
-- (insertItem mengembalikan null saat upload error).
--
--   * item-photos : foto barang saat laporan dibuat
--                   path: items/<userId>/<timestamp>.<ext>
--   * handover    : foto bukti serah terima
--                   path: finder/<itemId>/... dan satpam/<itemId>/...
--
-- Keduanya publik dibaca karena URL-nya ditampilkan langsung di kartu barang.
-- Batas ukuran 2 MB mengikuti batas di sisi aplikasi (src/lib/photo.ts).
-- Aman dijalankan berulang (idempoten).
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'item-photos',
    'item-photos',
    true,
    2097152,
    array['image/jpeg', 'image/png', 'image/webp']
  ),
  (
    'handover',
    'handover',
    true,
    2097152,
    array['image/jpeg', 'image/png', 'image/webp']
  )
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------
-- item-photos: hanya pemilik folder (items/<uid>/...) yang boleh menulis.
-- ---------------------------------------------------------------------
drop policy if exists item_photos_insert_own on storage.objects;
create policy item_photos_insert_own
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'item-photos'
    and (storage.foldername(name))[1] = 'items'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

drop policy if exists item_photos_delete_own on storage.objects;
create policy item_photos_delete_own
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'item-photos'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

-- ---------------------------------------------------------------------
-- handover: diunggah penemu/penyerah (finder/...) maupun petugas (satpam/...).
-- ---------------------------------------------------------------------
drop policy if exists handover_insert_authenticated on storage.objects;
create policy handover_insert_authenticated
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'handover'
    and (storage.foldername(name))[1] in ('finder', 'satpam')
  );

drop policy if exists handover_delete_staff on storage.objects;
create policy handover_delete_staff
  on storage.objects for delete to authenticated
  using (bucket_id = 'handover' and public.is_staff());

-- ---------------------------------------------------------------------
-- Baca publik untuk kedua bucket (foto memang tampil tanpa login).
-- ---------------------------------------------------------------------
drop policy if exists item_media_public_read on storage.objects;
create policy item_media_public_read
  on storage.objects for select to public
  using (bucket_id in ('item-photos', 'handover'));
