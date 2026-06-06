-- Cloud bootstrap: run this once in Supabase SQL Editor (Dashboard -> SQL Editor -> New query).
-- Applies all migrations + demo seed. Generated 2026-06-06.


-- ===== 20260521000001_initial.sql =====
-- 20260521000001_initial.sql
-- Profiles table (extension of auth.users) + RLS + auto-create trigger

create table public.profiles (
  user_id           uuid        primary key references auth.users(id) on delete cascade,
  role              text        not null default 'user' check (role in ('user','admin')),
  notify_anomalies  boolean     not null default false,
  notify_digest     boolean     not null default false,
  has_schengen      boolean     not null default false,
  timezone          text        not null default 'Europe/Moscow',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Auto-update updated_at
create or replace function public.tg_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.tg_set_updated_at();

-- Auto-create profile when a new auth.users row is inserted
create or replace function public.tg_create_profile_for_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (user_id) values (new.id) on conflict do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.tg_create_profile_for_new_user();

-- RLS
alter table public.profiles enable row level security;

create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = user_id);

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- ===== 20260604000001_l2_l3_core.sql =====
-- 20260604000001_l2_l3_core.sql
-- Shared tables for L2 (deals) + L3 (anomalies), price history, and cron observability.
-- These are "read by all, written only by service-role" (RLS: public SELECT, no write policy).

-- в”Ђв”Ђ price_snapshots: foundation for L3 medians в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
create table public.price_snapshots (
  id               bigserial   primary key,
  origin_iata      text        not null,
  destination_iata text        not null,
  depart_date      date        not null,
  return_date      date,
  price_rub        int         not null,
  airline          text,
  transfers        smallint    not null default 0,
  observed_on      date        not null default (now() at time zone 'utc')::date,
  observed_at      timestamptz not null default now()
);

-- One row per (origin, destination, depart_date) per UTC day; upsert keeps the daily minimum.
create unique index price_snapshots_daily_uniq
  on public.price_snapshots (origin_iata, destination_iata, depart_date, observed_on);
-- Covers anomaly_candidates' lateral stats filter (origin + destination + depart_date + observed_at)
-- and any (origin_iata, destination_iata, depart_date) prefix lookup.
create index price_snapshots_stats_idx
  on public.price_snapshots (origin_iata, destination_iata, depart_date, observed_at);
-- Single-column observed_at index is used by the weekly cleanup cron (Plan 6) that deletes old rows.
create index price_snapshots_observed_idx
  on public.price_snapshots (observed_at);

-- в”Ђв”Ђ deals: L2 feed в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
create table public.deals (
  id               uuid        primary key, -- supplied by cron (deterministic UUIDv5); intentionally no default
  origin_iata      text        not null,
  destination_iata text        not null,
  depart_date      date        not null,
  return_date      date,
  price_rub        int         not null,
  airline          text,
  transfers        smallint    not null default 0,
  deep_link        text        not null,
  first_seen_at    timestamptz not null default now(),
  last_seen_at     timestamptz not null default now(),
  is_active        boolean     not null default true
);

create unique index deals_route_uniq
  on public.deals (origin_iata, destination_iata, depart_date);
create index deals_active_recent_idx
  on public.deals (is_active, last_seen_at desc);

-- в”Ђв”Ђ anomalies: L3 в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
create table public.anomalies (
  id                uuid        primary key, -- supplied by cron (deterministic UUIDv5); intentionally no default
  origin_iata       text        not null,
  destination_iata  text        not null,
  depart_date       date        not null,
  return_date       date,
  price_rub         int         not null,
  median_price_rub  int         not null,
  discount_pct      numeric     not null,
  z_score           numeric,
  airline           text,
  transfers         smallint    not null default 0,
  deep_link         text        not null,
  detected_at       timestamptz not null default now(),
  is_active         boolean     not null default true
);

create unique index anomalies_route_uniq
  on public.anomalies (origin_iata, destination_iata, depart_date);
create index anomalies_detected_idx
  on public.anomalies (detected_at desc, discount_pct desc);

-- в”Ђв”Ђ cron_runs: observability в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
create table public.cron_runs (
  id            bigserial   primary key,
  job           text        not null,
  started_at    timestamptz not null,
  finished_at   timestamptz,
  api_calls     int         not null default 0,
  rows_inserted int         not null default 0,
  error         text        -- observability only; publicly readable, so cron code MUST NOT log secrets here
);

create index cron_runs_job_started_idx
  on public.cron_runs (job, started_at desc);

-- в”Ђв”Ђ RLS: read all, write service-role only в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
alter table public.price_snapshots enable row level security;
alter table public.deals           enable row level security;
alter table public.anomalies       enable row level security;
alter table public.cron_runs       enable row level security;

create policy "price_snapshots_select_all" on public.price_snapshots for select using (true);
create policy "deals_select_all"           on public.deals           for select using (true);
create policy "anomalies_select_all"       on public.anomalies       for select using (true);
create policy "cron_runs_select_all"       on public.cron_runs       for select using (true);
-- No INSERT/UPDATE/DELETE policies: only the service-role key (which bypasses RLS) writes.

-- в”Ђв”Ђ RPC: bulk upsert snapshots, keeping the daily minimum price в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
create or replace function public.record_snapshots(p_rows jsonb)
returns void language sql security definer set search_path = public as $$
  -- NOTE: observed_on is always server-derived (UTC today); callers must not pass it in p_rows.
  insert into public.price_snapshots
    (origin_iata, destination_iata, depart_date, return_date, price_rub, airline, transfers)
  select r.origin_iata, r.destination_iata, r.depart_date, r.return_date,
         r.price_rub, r.airline, coalesce(r.transfers, 0)
  from jsonb_to_recordset(p_rows) as r(
    origin_iata text, destination_iata text, depart_date date, return_date date,
    price_rub int, airline text, transfers smallint
  )
  on conflict (origin_iata, destination_iata, depart_date, observed_on)
  do update set price_rub   = least(public.price_snapshots.price_rub, excluded.price_rub),
                observed_at = now();
$$;

-- в”Ђв”Ђ RPC: anomaly candidates for one origin (set-based, single round-trip) в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
-- For each (destination, depart_date) seen in the last 24h for p_origin, return its
-- latest price plus the 30-day median/stddev/count over the same depart-month.
create or replace function public.anomaly_candidates(p_origin text)
returns table (
  destination_iata text,
  depart_date      date,
  price_rub        int,
  airline          text,
  transfers        smallint,
  median           numeric,
  stddev           numeric,
  n                bigint
) language sql stable security definer set search_path = public as $$
  with latest as (
    select distinct on (destination_iata, depart_date)
      destination_iata, depart_date, price_rub, airline, transfers
    from public.price_snapshots
    where origin_iata = p_origin
      and observed_at > now() - interval '1 day'
    order by destination_iata, depart_date, observed_at desc
  )
  select l.destination_iata, l.depart_date, l.price_rub, l.airline, l.transfers,
         s.median, s.stddev, s.n
  from latest l
  cross join lateral (
    select percentile_cont(0.5) within group (order by ps.price_rub) as median,
           stddev_samp(ps.price_rub)::numeric                        as stddev,
           count(*)                                                  as n
    from public.price_snapshots ps
    where ps.origin_iata = p_origin
      and ps.destination_iata = l.destination_iata
      and date_trunc('month', ps.depart_date) = date_trunc('month', l.depart_date)
      and ps.observed_at > now() - interval '30 days'
  ) s;
$$;


-- ===== 20260605000001_l1_saved_searches.sql =====
-- 20260605000001_l1_saved_searches.sql
-- L1: per-user saved searches (tracked routes with a price threshold). Owner-only RLS.

create table public.saved_searches (
  id               uuid        primary key default gen_random_uuid(),
  user_id          uuid        not null references auth.users(id) on delete cascade,
  origin_iata      text        not null,
  destination_iata text,        -- null = "anywhere" (not yet polled in this plan; see runPollL1)
  date_from        date        not null,
  date_to          date        not null,
  max_price_rub    int         not null,
  notify_email     boolean     not null default false, -- stored now; used by the Email plan
  created_at       timestamptz not null default now()
);

create index saved_searches_user_idx on public.saved_searches (user_id);

alter table public.saved_searches enable row level security;

create policy "saved_searches_select_own"
  on public.saved_searches for select using (auth.uid() = user_id);

create policy "saved_searches_insert_own"
  on public.saved_searches for insert with check (auth.uid() = user_id);

create policy "saved_searches_update_own"
  on public.saved_searches for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "saved_searches_delete_own"
  on public.saved_searches for delete using (auth.uid() = user_id);


-- ===== seed.sql (demo data) =====
-- seed.sql вЂ” demo data for trying the product without a Travelpayouts token.
-- Auto-loaded after migrations on `supabase db reset`. Safe to re-run (ON CONFLICT DO NOTHING).
-- deep_link uses a DEMO marker; these are not real bookings.

-- в”Ђв”Ђ L2 deals (home feed) в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
insert into public.deals
  (id, origin_iata, destination_iata, depart_date, return_date, price_rub, airline, transfers, deep_link, is_active)
values
  (gen_random_uuid(), 'EKB', 'AER', '2026-09-12', null,  4200, 'U6', 0, 'https://www.aviasales.ru/search/EKB1209AER1?marker=DEMO.l2_demo_', true),
  (gen_random_uuid(), 'EKB', 'IST', '2026-10-05', null, 11800, 'TK', 0, 'https://www.aviasales.ru/search/EKB0510IST1?marker=DEMO.l2_demo_', true),
  (gen_random_uuid(), 'MOW', 'TBS', '2026-09-20', null,  9500, 'A9', 1, 'https://www.aviasales.ru/search/MOW2009TBS1?marker=DEMO.l2_demo_', true),
  (gen_random_uuid(), 'MOW', 'AYT', '2026-09-15', null,  8900, 'PC', 0, 'https://www.aviasales.ru/search/MOW1509AYT1?marker=DEMO.l2_demo_', true),
  (gen_random_uuid(), 'LED', 'EVN', '2026-10-10', null, 10300, 'RM', 1, 'https://www.aviasales.ru/search/LED1010EVN1?marker=DEMO.l2_demo_', true),
  (gen_random_uuid(), 'MOW', 'DXB', '2026-11-01', null, 16500, 'FZ', 0, 'https://www.aviasales.ru/search/MOW0111DXB1?marker=DEMO.l2_demo_', true)
on conflict (origin_iata, destination_iata, depart_date) do nothing;

-- в”Ђв”Ђ L3 anomalies (anomaly engine output) в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
-- One has discount_pct >= 50 to show the red highlight on /anomalies and the home badge.
insert into public.anomalies
  (id, origin_iata, destination_iata, depart_date, return_date, price_rub, median_price_rub, discount_pct, z_score, airline, transfers, deep_link, is_active)
values
  (gen_random_uuid(), 'EVN', 'FCO', '2026-10-12', null,  5000, 18000, 72.2, -3.25, 'PC', 1, 'https://www.aviasales.ru/search/EVN1210FCO1?marker=DEMO.l3_demo_', true),
  (gen_random_uuid(), 'TBS', 'BCN', '2026-10-20', null,  8800, 17500, 49.7, -2.10, 'A9', 1, 'https://www.aviasales.ru/search/TBS2010BCN1?marker=DEMO.l3_demo_', true),
  (gen_random_uuid(), 'IST', 'BKK', '2026-11-05', null, 19900, 31000, 35.8, -1.55, 'TK', 0, 'https://www.aviasales.ru/search/IST0511BKK1?marker=DEMO.l3_demo_', true)
on conflict (origin_iata, destination_iata, depart_date) do nothing;

