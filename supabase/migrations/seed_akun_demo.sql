-- =====================================================================
-- SEED DATA: BUAT AKUN DEMO UNTUK LOGIN PERTAMA KALI
-- Jalankan SETELAH siakad_auth_profiles.sql berhasil dieksekusi.
-- Idempoten: aman dijalankan berulang (skip jika email sudah ada).
--
-- Kata sandi bawaan semua akun: Kampus#2026
-- Email sintetis: {identifier}@kampus.local
-- =====================================================================

-- Aktifkan extension untuk hashing password
create extension if not exists pgcrypto;

-- Helper function untuk membuat auth user dari SQL.
create or replace function public.seed_create_user(
  p_email text,
  p_password text,
  p_identifier text,
  p_name text,
  p_role text,
  p_role_label text,
  p_id_type text,
  p_department text,
  p_must_change boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  -- Cek apakah email sudah ada di auth.users
  select id into v_user_id from auth.users where email = p_email limit 1;

  if v_user_id is null then
    v_user_id := gen_random_uuid();
    insert into auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change_token_current,
      email_change_token_new,
      recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000',
      v_user_id,
      'authenticated',
      'authenticated',
      p_email,
      crypt(p_password, gen_salt('bf')),
      now(),
      jsonb_build_object('provider', 'email', 'providers', '["email"]'),
      jsonb_build_object(
        'identifier', p_identifier,
        'name', p_name,
        'role', p_role,
        'role_label', p_role_label,
        'id_type', p_id_type,
        'department', p_department,
        'must_change_password', p_must_change
      ),
      now(),
      now(),
      '',
      '',
      '',
      ''
    );

    -- Buat identity record agar login dengan email/password bekerja
    insert into auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    ) values (
      gen_random_uuid(),
      v_user_id,
      jsonb_build_object('sub', v_user_id::text, 'email', p_email),
      'email',
      now(),
      now(),
      now()
    );
  end if;

  return v_user_id;
end;
$$;

-- =====================================================================
-- DATA AKUN
-- =====================================================================

-- 1. SUPERADMIN (Anda sendiri - eank)
--    Login: eank / Kampus#2026
select public.seed_create_user(
  'eank@kampus.local',
  'Kampus#2026',
  'EANK',
  'Admin Kampus',
  'SUPERADMIN',
  'Superadmin',
  'NIDN',
  'Biro Administrasi Akademik',
  false
);

-- 2. SATPAM
--    Login: SEC-01 / Kampus#2026
select public.seed_create_user(
  'sec-01@kampus.local',
  'Kampus#2026',
  'SEC-01',
  'Pak Hendra Wijaya',
  'SATPAM',
  'Petugas Satpam',
  'ID Petugas',
  'Keamanan Kampus',
  false
);

--    Login: SEC-02 / Kampus#2026
select public.seed_create_user(
  'sec-02@kampus.local',
  'Kampus#2026',
  'SEC-02',
  'Pak Bambang Susilo',
  'SATPAM',
  'Petugas Satpam',
  'ID Petugas',
  'Keamanan Kampus',
  false
);

-- 3. MAHASISWA
--    Login: 240501101 / Kampus#2026
select public.seed_create_user(
  '240501101@kampus.local',
  'Kampus#2026',
  '240501101',
  'Ahmad Fauzan',
  'MAHASISWA',
  'Mahasiswa',
  'NIM',
  'S1 Teknik Informatika',
  true
);

--    Login: 240501102 / Kampus#2026
select public.seed_create_user(
  '240501102@kampus.local',
  'Kampus#2026',
  '240501102',
  'Siti Nurhaliza',
  'MAHASISWA',
  'Mahasiswa',
  'NIM',
  'S1 Manajemen',
  true
);

--    Login: 230104091 / Kampus#2026
select public.seed_create_user(
  '230104091@kampus.local',
  'Kampus#2026',
  '230104091',
  'Budi Santoso',
  'MAHASISWA',
  'Mahasiswa',
  'NIM',
  'S1 Hukum',
  true
);

-- =====================================================================
-- Bersihkan helper function setelah dipakai
-- =====================================================================
drop function if exists public.seed_create_user;