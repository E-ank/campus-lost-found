-- =====================================================================
-- EDIT & HAPUS LAPORAN OLEH PEMILIK
-- ---------------------------------------------------------------------
-- Kebijakan UPDATE laporan (items_update) sudah dibuat di
-- barang_klaim_persistensi.sql: pemilik (reporter_user_id = auth.uid())
-- atau petugas boleh memperbarui barisnya. File ini hanya menambahkan
-- kemampuan HAPUS yang belum ada.
--
-- Baris klaim & pesan chat milik barang ini ikut terhapus otomatis
-- (foreign key ON DELETE CASCADE), sehingga tidak ada data menggantung.
--
-- Aman dijalankan berulang (idempoten).
-- =====================================================================

grant delete on public.items to authenticated;

drop policy if exists items_delete on public.items;
create policy items_delete
  on public.items for delete
  using (is_staff() or reporter_user_id = auth.uid());
