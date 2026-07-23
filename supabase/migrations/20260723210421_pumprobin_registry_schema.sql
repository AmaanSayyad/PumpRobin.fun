-- PumpRobin.fun Supabase schema
-- Run once in Supabase → SQL Editor (https://supabase.com/dashboard)

create table if not exists public.pumprobin_tokens (
  address text primary key,
  bonding_curve text not null,
  name text not null,
  symbol text not null,
  image_uri text not null default '',
  description text not null default '',
  creator text not null,
  created_at timestamptz not null default now(),
  virtual_eth_reserves double precision not null default 0,
  virtual_token_reserves double precision not null default 0,
  real_eth_reserves double precision not null default 0,
  real_token_reserves double precision not null default 0,
  graduated boolean not null default false,
  source text not null default 'registry',
  tx_hash text,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.pumprobin_trades (
  id text primary key,
  token_address text not null references public.pumprobin_tokens(address) on delete cascade,
  trader text not null,
  is_buy boolean not null,
  eth_amount double precision not null,
  token_amount double precision not null,
  price double precision not null,
  fee_eth double precision not null default 0,
  timestamp timestamptz not null default now()
);

create index if not exists pumprobin_trades_token_idx
  on public.pumprobin_trades (token_address, timestamp desc);

create table if not exists public.pumprobin_platform (
  id int primary key default 1 check (id = 1),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.pumprobin_platform (id, data)
values (1, '{}'::jsonb)
on conflict (id) do nothing;

-- Public launchpad: allow anon read/write (tighten later with RLS policies if needed)
alter table public.pumprobin_tokens enable row level security;
alter table public.pumprobin_trades enable row level security;
alter table public.pumprobin_platform enable row level security;

drop policy if exists "pumprobin_tokens_public" on public.pumprobin_tokens;
create policy "pumprobin_tokens_public" on public.pumprobin_tokens
  for all using (true) with check (true);

drop policy if exists "pumprobin_trades_public" on public.pumprobin_trades;
create policy "pumprobin_trades_public" on public.pumprobin_trades
  for all using (true) with check (true);

drop policy if exists "pumprobin_platform_public" on public.pumprobin_platform;
create policy "pumprobin_platform_public" on public.pumprobin_platform
  for all using (true) with check (true);
