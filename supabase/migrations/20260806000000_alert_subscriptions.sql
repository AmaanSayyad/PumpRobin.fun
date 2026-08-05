-- Alert subscriptions (manual Telegram/Discord fulfillment by ops)
create table if not exists public.pumprobin_alert_subs (
  id text primary key,
  wallet text not null,
  telegram text,
  discord text,
  email text,
  tx_hash text not null,
  paid_eth double precision not null default 0,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  notes text
);

create index if not exists pumprobin_alert_subs_wallet_idx
  on public.pumprobin_alert_subs (wallet, created_at desc);

create index if not exists pumprobin_alert_subs_status_idx
  on public.pumprobin_alert_subs (status);

alter table public.pumprobin_alert_subs enable row level security;

drop policy if exists "pumprobin_alert_subs_public" on public.pumprobin_alert_subs;
create policy "pumprobin_alert_subs_public" on public.pumprobin_alert_subs
  for all using (true) with check (true);
