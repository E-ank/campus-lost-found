-- =====================================================================
-- MIGRASI: PENGUATAN KEAMANAN MENYELURUH (PROFIL, KTM, BARANG, KLAIM, PUSH)
-- Idempoten: aman dijalankan berulang kali di Supabase SQL Editor.
-- =====================================================================

-- 1. Pastikan kolom wajib tersedia sebelum fungsi/view/trigger dibuat.
alter table public.items add column if not exists photo_url text;
alter table public.profiles add column if not exists ktm_url text;
alter table public.profiles add column if not exists ktm_verified boolean not null default false;

-- 2. Fungsi pembantu otorisasi (hanya pengguna dengan is_active = true).
create or replace function public.is_staff()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (
      select p.role in ('SATPAM', 'SUPERADMIN') and coalesce(p.is_active, true)
      from public.profiles p
      where p.id = auth.uid()
    ),
    false
  );
$$;

create or replace function public.is_superadmin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (
      select p.role = 'SUPERADMIN' and coalesce(p.is_active, true)
      from public.profiles p
      where p.id = auth.uid()
    ),
    false
  );
$$;

create or replace function public.is_verified_or_non_student()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (
      select coalesce(p.is_active, true)
        and (p.role <> 'MAHASISWA' or coalesce(p.ktm_verified, false))
      from public.profiles p
      where p.id = auth.uid()
    ),
    false
  );
$$;

-- 3. Indeks unik parsial untuk identifier agar pengguna Google OAuth baru ('-') tidak bentrok.
drop index if exists public.profiles_identifier_key;
create unique index if not exists profiles_identifier_key
  on public.profiles (upper(identifier))
  where identifier is not null and btrim(identifier) <> '' and identifier <> '-';

-- 4. Cegah eskalasi peran pada pendaftaran baru dan kunci kolom sensitif profil.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_must_change boolean;
  v_identifier text;
begin
  v_must_change := coalesce((new.raw_user_meta_data ->> 'must_change_password')::boolean, false);
  v_identifier := coalesce(nullif(btrim(new.raw_user_meta_data ->> 'identifier'), ''), '-');

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
    profile_completed,
    is_active,
    ktm_verified
  )
  values (
    new.id,
    'MAHASISWA',
    'Mahasiswa',
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'name'), ''), split_part(new.email, '@', 1), 'Mahasiswa'),
    v_identifier,
    'NIM',
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'department'), ''), 'Belum diisi'),
    'bg-blue-600',
    v_must_change,
    case when v_must_change or v_identifier = '-' then false else true end,
    true,
    false
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create or replace function public.protect_profile_privileged_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() = old.id and not public.is_superadmin() then
    if new.role is distinct from old.role
       or new.role_label is distinct from old.role_label
       or new.is_active is distinct from old.is_active
       or new.ktm_verified is distinct from old.ktm_verified
    then
      raise exception 'Peran, status aktif, dan verifikasi KTM hanya dapat diubah oleh sistem atau Superadmin.';
    end if;

    if coalesce(old.ktm_verified, false) = true
       and (
         new.identifier is distinct from old.identifier
         or new.name is distinct from old.name
         or new.ktm_url is distinct from old.ktm_url
       )
    then
      raise exception 'Identitas akun yang sudah terverifikasi terkunci permanen.';
    end if;
  end if;

  if auth.uid() = old.id
     and old.role = 'SUPERADMIN'
     and coalesce(old.is_active, true)
     and (new.role <> 'SUPERADMIN' or new.is_active = false)
     and not exists (
       select 1
       from public.profiles p
       where p.role = 'SUPERADMIN'
         and coalesce(p.is_active, true)
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

-- 5. Tutup akses baca PII anon pada profiles dan sediakan view public_profiles minimal.
revoke select on public.profiles from anon;

drop policy if exists profiles_read_all on public.profiles;
drop policy if exists profiles_read_own_or_staff on public.profiles;
create policy profiles_read_own_or_staff
  on public.profiles for select to authenticated
  using (auth.uid() = id or public.is_staff());

drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self
  on public.profiles for insert to authenticated
  with check (
    auth.uid() = id
    and role = 'MAHASISWA'
    and coalesce(is_active, true) = true
    and coalesce(ktm_verified, false) = false
  );

create or replace view public.public_profiles as
select id, avatar_url
from public.profiles;

grant select on public.public_profiles to anon, authenticated;

-- 6. View publik aman untuk items (menyembunyikan secret_answer_hint, foto sensitif, dan nomor HP pelapor).
create or replace view public.items_public as
select
  i.id,
  i.type,
  i.title,
  i.category,
  i.location,
  i.item_date,
  i.status,
  i.is_sensitive,
  i.storage_type,
  i.security_post,
  i.locker_code,
  i.description,
  i.secret_question,
  case
    when public.is_staff() or i.reporter_user_id = auth.uid() then i.secret_answer_hint
    else ''
  end as secret_answer_hint,
  i.reporter_name,
  i.reporter_id,
  case
    when public.is_staff()
      or i.reporter_user_id = auth.uid()
      or (
        i.storage_type = 'FINDER'
        and exists (
          select 1
          from public.claims c
          where c.item_id = i.id
            and c.claimant_user_id = auth.uid()
            and c.status in ('APPROVED', 'SELESAI')
        )
      )
    then i.reporter_phone
    else '-'
  end as reporter_phone,
  i.reporter_user_id,
  i.visual_theme,
  i.is_spam_reported,
  i.handover_info,
  i.created_at,
  i.expires_at,
  i.archived_at,
  case
    when i.is_sensitive and not (public.is_staff() or i.reporter_user_id = auth.uid()) then null
    else i.photo_url
  end as photo_url
from public.items i
where
  public.is_staff()
  or i.reporter_user_id = auth.uid()
  or public.has_claimed_item(i.id)
  or (i.archived_at is null and i.expires_at > now());

grant select on public.items_public to anon, authenticated;

revoke select on public.items from anon;
drop policy if exists items_select on public.items;
create policy items_select
  on public.items for select to authenticated
  using (
    public.is_staff()
    or reporter_user_id = auth.uid()
  );

-- Trigger keamanan tulis pada tabel items.
create or replace function public.enforce_item_insert_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_staff() then
    if not public.is_verified_or_non_student() then
      raise exception 'Akun mahasiswa harus aktif dan terverifikasi KTM sebelum membuat laporan.';
    end if;
    new.reporter_user_id := auth.uid();
    new.is_spam_reported := false;
    new.handover_info := null;
  end if;
  return new;
end;
$$;

drop trigger if exists items_enforce_insert on public.items;
create trigger items_enforce_insert
  before insert on public.items
  for each row execute function public.enforce_item_insert_guard();

create or replace function public.protect_item_update_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_staff() then
    if old.status = 'Selesai' then
      raise exception 'Laporan yang sudah selesai diserahkan tidak dapat diubah.';
    end if;

    if new.reporter_user_id is distinct from old.reporter_user_id then
      raise exception 'Pemilik laporan tidak dapat diubah.';
    end if;

    if new.is_spam_reported is distinct from old.is_spam_reported then
      raise exception 'Status moderasi spam hanya dapat diubah oleh petugas.';
    end if;

    if old.is_sensitive = true and new.is_sensitive = false then
      raise exception 'Sensor dokumen sensitif hanya dapat dibuka oleh petugas.';
    end if;

    if new.handover_info is distinct from old.handover_info
       and not (old.storage_type = 'FINDER' and new.status = 'Selesai')
    then
      raise exception 'Data serah terima tidak dapat diubah langsung.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists items_protect_update on public.items;
create trigger items_protect_update
  before update on public.items
  for each row execute function public.protect_item_update_guard();

drop policy if exists items_delete on public.items;
create policy items_delete
  on public.items for delete to authenticated
  using (
    public.is_staff()
    or (reporter_user_id = auth.uid() and status <> 'Selesai')
  );

-- 7. Trigger & RLS klaim untuk mencegah self-claim, status palsu, atau klaim ganda.
create or replace function public.enforce_claim_insert_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item record;
begin
  if auth.uid() is not null then
    if not public.is_staff() and not public.is_verified_or_non_student() then
      raise exception 'Akun mahasiswa harus aktif dan terverifikasi KTM sebelum mengajukan klaim atau temuan.';
    end if;

    select id, type, status, reporter_user_id
      into v_item
      from public.items
     where id = new.item_id;

    if v_item.id is null then
      raise exception 'Laporan barang tidak ditemukan.';
    end if;

    if v_item.status = 'Selesai' then
      raise exception 'Laporan barang ini sudah selesai diserahkan.';
    end if;

    if v_item.type = 'FOUND' and v_item.reporter_user_id = auth.uid() then
      raise exception 'Pelapor tidak dapat mengklaim barang yang dilaporkan sendiri.';
    end if;

    if exists (
      select 1
      from public.claims c
      where c.item_id = new.item_id
        and c.claimant_user_id = auth.uid()
        and c.status in ('PENDING', 'APPROVED')
    ) then
      raise exception 'Anda sudah memiliki pengajuan aktif untuk barang ini.';
    end if;

    new.claimant_user_id := auth.uid();
    new.status := 'PENDING';
    new.ticket_code := null;
  end if;

  return new;
end;
$$;

drop trigger if exists claims_enforce_insert on public.claims;
create trigger claims_enforce_insert
  before insert on public.claims
  for each row execute function public.enforce_claim_insert_guard();

drop policy if exists claims_insert on public.claims;
create policy claims_insert
  on public.claims for insert to authenticated
  with check (claimant_user_id = auth.uid());

drop policy if exists claims_update on public.claims;
create policy claims_update
  on public.claims for update to authenticated
  using (
    public.is_staff()
    or (
      public.is_item_owner(item_id)
      and exists (
        select 1
        from public.items i
        where i.id = claims.item_id
          and (i.type = 'LOST' or i.storage_type = 'FINDER')
      )
    )
  )
  with check (
    public.is_staff()
    or (
      public.is_item_owner(item_id)
      and exists (
        select 1
        from public.items i
        where i.id = claims.item_id
          and (i.type = 'LOST' or i.storage_type = 'FINDER')
      )
    )
  );

-- 8. Pengaduan: wajib berstatus Menunggu, tanggal <= hari ini, dan akun aktif terverifikasi.
do $$
begin
  if to_regclass('public.complaints') is not null then
    execute 'drop policy if exists complaints_insert on public.complaints';
    execute $pol$
      create policy complaints_insert
        on public.complaints for insert to authenticated
        with check (
          reporter_id = auth.uid()
          and status = 'Menunggu'
          and incident_date <= current_date
          and public.is_verified_or_non_student()
        )
    $pol$;
  end if;
end
$$;

-- 9. Push subscriptions: klien hanya boleh membaca/menghapus baris miliknya sendiri (tulis via server).
do $$
begin
  if to_regclass('public.push_subscriptions') is not null then
    execute 'alter table public.push_subscriptions enable row level security';
    execute 'drop policy if exists push_subscriptions_all on public.push_subscriptions';
    execute 'drop policy if exists push_subscriptions_own on public.push_subscriptions';
    execute 'drop policy if exists push_subscriptions_read_own on public.push_subscriptions';
    execute 'drop policy if exists push_subscriptions_delete_own on public.push_subscriptions';
    execute 'create policy push_subscriptions_read_own on public.push_subscriptions for select to authenticated using (user_id = auth.uid())';
    execute 'create policy push_subscriptions_delete_own on public.push_subscriptions for delete to authenticated using (user_id = auth.uid())';
  end if;
end
$$;

-- 10. Batasi chat_reads (jika tabel masih ada) hanya untuk peserta klaim.
do $$
begin
  if to_regclass('public.chat_reads') is not null then
    execute 'drop policy if exists chat_reads_insert on public.chat_reads';
    execute 'drop policy if exists chat_reads_update on public.chat_reads';
    execute 'create policy chat_reads_insert on public.chat_reads for insert to authenticated with check (user_id = auth.uid() and public.is_claim_participant(claim_id))';
    execute 'create policy chat_reads_update on public.chat_reads for update to authenticated using (user_id = auth.uid() and public.is_claim_participant(claim_id))';
  end if;
end
$$;

-- 11. Perketat bucket storage (avatars, item-photos, handover).
update storage.buckets
   set file_size_limit = 5242880,
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
 where id = 'avatars';

drop policy if exists item_photos_insert_own on storage.objects;
create policy item_photos_insert_own
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'item-photos'
    and (storage.foldername(name))[1] = 'items'
    and (
      (storage.foldername(name))[2] = auth.uid()::text
      or public.is_staff()
    )
  );

drop policy if exists handover_insert_authenticated on storage.objects;
create policy handover_insert_authenticated
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'handover'
    and (
      ((storage.foldername(name))[1] = 'satpam' and public.is_staff())
      or (
        (storage.foldername(name))[1] = 'finder'
        and exists (
          select 1
          from public.items i
          where i.id::text = (storage.foldername(name))[2]
            and i.reporter_user_id = auth.uid()
            and i.storage_type = 'FINDER'
        )
      )
    )
  );
