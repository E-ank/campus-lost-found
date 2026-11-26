-- Perpanjang batas masa tampil laporan di database agar tidak kedaluwarsa terlalu cepat
UPDATE public.items
SET expires_at = now() + interval '30 days'
WHERE archived_at IS NULL;

-- Perbarui nilai default kolom expires_at menjadi 30 hari ke depan
ALTER TABLE public.items
ALTER COLUMN expires_at SET DEFAULT (now() + interval '30 days');
