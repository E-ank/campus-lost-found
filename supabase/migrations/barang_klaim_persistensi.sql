-- =====================================================================
-- MIGRASI: PERSISTENSI BARANG & KLAIM + AUTO-ARSIP 7 HARI
-- Idempoten: aman dijalankan berulang kali di Supabase SQL Editor.
--
-- Aturan utama:
--   * Barang tampil di beranda publik maksimal 7 hari (expires_at).
--   * Setelah diserahkan (status "Selesai") barang langsung diarsipkan.
--   * Barang yang sudah diarsipkan TIDAK hilang: pelapor (penemu) dan
--     pengklaim tetap melihatnya di halaman riwayat masing-masing.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. FUNGSI BANTU UNTUK RLS
--    Dibuat SECURITY DEFINER agar tidak terjadi rekursi antar policy.
-- ---------------------------------------------------------------------
create or replace function public.is_staff()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (select p.role in ('SATPAM', 'SUPERADMIN') from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

create or replace function public.is_item_owner(p_item_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.items i
    where i.id = p_item_id and i.reporter_user_id = auth.uid()
  );
$$;

create or replace function public.has_claimed_item(p_item_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.claims c
    where c.item_id = p_item_id and c.claimant_user_id = auth.uid()
  );
$$;

create or replace function public.is_claim_participant(p_claim_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.claims c
    join public.items i on i.id = c.item_id
    where c.id = p_claim_id
      and (c.claimant_user_id = auth.uid() or i.reporter_user_id = auth.uid())
  );
$$;

-- ---------------------------------------------------------------------
-- 1. TABEL BARANG
-- ---------------------------------------------------------------------
create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  type text not null,                     -- FOUND | LOST
  title text not null,
  category text not null,
  location text not null,
  item_date text not null default '-',
  status text not null default 'Dicari',
  is_sensitive boolean not null default false,
  storage_type text not null default 'NONE',
  security_post text not null default '-',
  locker_code text not null default '-',
  description text not null default '',
  secret_question text not null default '',
  secret_answer_hint text not null default '',
  reporter_name text not null default '',
  reporter_id text not null default '-',
  reporter_phone text not null default '-',
  reporter_user_id uuid not null references public.profiles (id) on delete cascade,
  visual_theme text not null default 'tumbler',
  is_spam_reported boolean not null default false,
  handover_info jsonb,
  created_at timestamptz not null default now(),
  -- Batas tampil di beranda publik: 7 hari sejak laporan dibuat.
  expires_at timestamptz not null default (now() + interval '7 days'),
  -- Terisi saat barang selesai dikembalikan / diarsipkan manual.
  archived_at timestamptz
);

create index if not exists items_created_at_idx on public.items (created_at desc);
create index if not exists items_reporter_user_idx on public.items (reporter_user_id);

-- ---------------------------------------------------------------------
-- 2. TABEL KLAIM
-- ---------------------------------------------------------------------
create table if not exists public.claims (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items (id) on delete cascade,
  item_title text not null default '',
  claimant_name text not null default '',
  claimant_id text not null default '-',
  claimant_role text not null default '',
  claimant_dept text not null default '-',
  claimant_user_id uuid not null references public.profiles (id) on delete cascade,
  secret_question text not null default '',
  answer text not null default '',
  additional_notes text not null default '',
  has_proof_photo boolean not null default false,
  proof_photo_name text,
  status text not null default 'PENDING',
  ticket_code text,
  storage_type text not null default 'NONE',
  security_post text not null default '-',
  finder_phone text not null default '-',
  created_at timestamptz not null default now()
);

create index if not exists claims_item_idx on public.claims (item_id);
create index if not exists claims_claimant_user_idx on public.claims (claimant_user_id);

-- ---------------------------------------------------------------------
-- 3. TABEL PESAN CHAT
-- ---------------------------------------------------------------------
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.claims (id) on delete cascade,
  sender_user_id uuid not null references public.profiles (id) on delete cascade,
  sender_id text not null default '-',
  sender_name text not null default '',
  text text not null,
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_claim_idx on public.chat_messages (claim_id, created_at);

-- ---------------------------------------------------------------------
-- 4. ARSIP OTOMATIS SAAT STATUS BERUBAH MENJADI "Selesai"
-- ---------------------------------------------------------------------
create or replace function public.archive_item_on_done()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'Selesai' and (old.status is distinct from 'Selesai') then
    new.archived_at := coalesce(new.archived_at, now());
  end if;
  return new;
end;
$$;

drop trigger if exists items_archive_on_done on public.items;
create trigger items_archive_on_done
  before update on public.items
  for each row execute function public.archive_item_on_done();

-- ---------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY
-- ---------------------------------------------------------------------
alter table public.items enable row level security;
alter table public.claims enable row level security;
alter table public.chat_messages enable row level security;

-- --- items ---
drop policy if exists items_select on public.items;
create policy items_select
  on public.items for select
  using (
    is_staff()
    or reporter_user_id = auth.uid()
    or has_claimed_item(id)
    or (archived_at is null and expires_at > now())
  );

drop policy if exists items_insert on public.items;
create policy items_insert
  on public.items for insert
  with check (reporter_user_id = auth.uid());

drop policy if exists items_update on public.items;
create policy items_update
  on public.items for update
  using (is_staff() or reporter_user_id = auth.uid())
  with check (is_staff() or reporter_user_id = auth.uid());

-- --- claims ---
drop policy if exists claims_select on public.claims;
create policy claims_select
  on public.claims for select
  using (
    is_staff()
    or claimant_user_id = auth.uid()
    or is_item_owner(item_id)
  );

drop policy if exists claims_insert on public.claims;
create policy claims_insert
  on public.claims for insert
  with check (claimant_user_id = auth.uid());

drop policy if exists claims_update on public.claims;
create policy claims_update
  on public.claims for update
  using (is_staff() or is_item_owner(item_id))
  with check (is_staff() or is_item_owner(item_id));

-- --- chat_messages ---
drop policy if exists chat_select on public.chat_messages;
create policy chat_select
  on public.chat_messages for select
  using (is_staff() or is_claim_participant(claim_id));

drop policy if exists chat_insert on public.chat_messages;
create policy chat_insert
  on public.chat_messages for insert
  with check (sender_user_id = auth.uid() and is_claim_participant(claim_id));

-- ---------------------------------------------------------------------
-- 6. HAK AKSES DASAR
-- ---------------------------------------------------------------------
grant select on public.items to anon, authenticated;
grant insert, update on public.items to authenticated;
grant select, insert, update on public.claims to authenticated;
grant select, insert on public.chat_messages to authenticated;
