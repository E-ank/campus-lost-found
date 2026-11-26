-- =====================================================================
-- MIGRASI: PRIVASI CHAT (Lost & Found Kampus)
-- Chat adalah percakapan privat antara PENGKLAIM dan PENEMU/PELAPOR.
-- Satpam & Superadmin TIDAK lagi bisa membaca isi chat satu sama lain.
-- Satpam tetap memverifikasi serah terima lewat formulir + foto bukti,
-- bukan lewat isi percakapan (privasi pengguna).
-- Idempoten: aman dijalankan berulang kali.
-- =====================================================================

-- Baca chat: hanya peserta klaim (pengklaim atau pelapor barang).
drop policy if exists chat_select on public.chat_messages;
create policy chat_select
  on public.chat_messages for select
  using (is_claim_participant(claim_id));

-- Kirim chat: pengirim harus peserta klaim (is_staff dihilangkan).
drop policy if exists chat_insert on public.chat_messages;
create policy chat_insert
  on public.chat_messages for insert
  with check (sender_user_id = auth.uid() and is_claim_participant(claim_id));

-- Verifikasi hasil akhir.
select 'chat_select'  as policy, proles.rolname, poles.cmd, poles.qual, poles.with_check
from pg_policies poles, pg_roles proles
where poles.tablename = 'chat_messages' and proles.rolname = 'anon';
