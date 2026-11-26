-- =====================================================================
-- AKTIFKAN SUPABASE REALTIME REPLICATION (IDEMPOTEN / AMAN DIJALANKAN)
-- Jalankan skrip ini di SQL Editor dashboard Supabase Anda:
-- https://supabase.com/dashboard/project/jpmqrpnxcwdiayzhqavu/sql
-- =====================================================================

DO $$
BEGIN
  -- 1. Tambahkan tabel items jika belum terdaftar
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'items'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.items;
  END IF;

  -- 2. Tambahkan tabel claims jika belum terdaftar
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'claims'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.claims;
  END IF;

  -- 3. Tambahkan tabel complaints jika belum terdaftar
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'complaints'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.complaints;
  END IF;
END $$;

-- 4. Atur replica identity full agar payload perubahan status dan data lengkap terkirim
ALTER TABLE public.items REPLICA IDENTITY FULL;
ALTER TABLE public.claims REPLICA IDENTITY FULL;
ALTER TABLE public.complaints REPLICA IDENTITY FULL;
