-- =====================================================================
-- MIGRASI: STATUS PEMBACAAN CHAT (Lost & Found Kampus, gaya WhatsApp)
--   - last_seen_at: klien penerima sudah menerima pesan -> 2 centang abu-abu
--   - last_read_at: penerima membuka chat/membaca      -> 2 centang biru
-- Satu baris per (klaim, pengguna), digabung secara atomik oleh fungsi
-- upsert_chat_read supaya nilai tidak pernah mundur (monotonik).
-- RLS: baris hanya terlihat oleh peserta klaim; tulis hanya baris sendiri.
-- Idempoten: aman dijalankan berulang kali di Supabase SQL Editor.
-- =====================================================================

create table if not exists public.chat_reads (
  claim_id uuid not null references public.claims (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  last_seen_at timestamptz,
  last_read_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (claim_id, user_id)
);

alter table public.chat_reads enable row level security;
alter table public.chat_reads replica identity full;

drop policy if exists chat_reads_select on public.chat_reads;
create policy chat_reads_select
  on public.chat_reads for select
  using (is_claim_participant(claim_id));

drop policy if exists chat_reads_insert on public.chat_reads;
create policy chat_reads_insert
  on public.chat_reads for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists chat_reads_update on public.chat_reads;
create policy chat_reads_update
  on public.chat_reads for update to authenticated
  using (user_id = auth.uid());

grant select, insert, update on public.chat_reads to authenticated;

-- Gabung atomik: p_read menandakan membuka chat, p_seen menandakan
-- menerima pesan baru. Nilai waktu selalu diambil yang terbaru (greatest),
-- jadi centang tidak pernah mundur. Peserta klaim non-teknis diblok
-- di dalam fungsi karena security definer melewati RLS.
create or replace function public.upsert_chat_read(
  p_claim_id uuid,
  p_read boolean,
  p_seen boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
begin
  if not public.is_claim_participant(p_claim_id) then
    return;
  end if;

  insert into public.chat_reads (claim_id, user_id, last_seen_at, last_read_at)
  values (
    p_claim_id,
    auth.uid(),
    case when p_seen then v_now end,
    case when p_read then v_now end
  )
  on conflict (claim_id, user_id) do update set
    last_seen_at = case
      when p_seen then greatest(coalesce(public.chat_reads.last_seen_at, to_timestamp(0)), v_now)
      else public.chat_reads.last_seen_at
    end,
    last_read_at = case
      when p_read then greatest(coalesce(public.chat_reads.last_read_at, to_timestamp(0)), v_now)
      else public.chat_reads.last_read_at
    end,
    updated_at = v_now;
end;
$$;

-- Update klien realtime menerima kedua-tanda (centang) tanpa refresh.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'chat_reads'
  ) then
    execute 'alter publication supabase_realtime add table public.chat_reads';
  end if;
end;
$$;

-- Verifikasi
select tablename, policyname, cmd from pg_policies where tablename = 'chat_reads' order by policyname;
select schemaname, tablename from pg_publication_tables where tablename in ('chat_messages', 'chat_reads');
