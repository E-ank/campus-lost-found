-- =====================================================================
-- TABEL PUSH SUBSCRIPTIONS (BACKGROUND WEB PUSH)
-- Menyimpan endpoint Web Push perangkat untuk notifikasi saat web ditutup
-- =====================================================================

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  role text not null default 'USER',
  endpoint text not null unique,
  subscription jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

-- Izinkan service role mengelola seluruh langganan push
drop policy if exists push_subscriptions_all on public.push_subscriptions;
create policy push_subscriptions_all on public.push_subscriptions
  for all using (true) with check (true);
