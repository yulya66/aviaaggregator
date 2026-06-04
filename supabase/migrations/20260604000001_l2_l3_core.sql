-- 20260604000001_l2_l3_core.sql
-- Shared tables for L2 (deals) + L3 (anomalies), price history, and cron observability.
-- These are "read by all, written only by service-role" (RLS: public SELECT, no write policy).

-- ── price_snapshots: foundation for L3 medians ────────────────────────────────
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
create index price_snapshots_pair_idx
  on public.price_snapshots (origin_iata, destination_iata, depart_date);
create index price_snapshots_observed_idx
  on public.price_snapshots (observed_at);

-- ── deals: L2 feed ────────────────────────────────────────────────────────────
create table public.deals (
  id               uuid        primary key,
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

-- ── anomalies: L3 ─────────────────────────────────────────────────────────────
create table public.anomalies (
  id                uuid        primary key,
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

-- ── cron_runs: observability ──────────────────────────────────────────────────
create table public.cron_runs (
  id            bigserial   primary key,
  job           text        not null,
  started_at    timestamptz not null,
  finished_at   timestamptz,
  api_calls     int         not null default 0,
  rows_inserted int         not null default 0,
  error         text
);

create index cron_runs_job_started_idx
  on public.cron_runs (job, started_at desc);

-- ── RLS: read all, write service-role only ────────────────────────────────────
alter table public.price_snapshots enable row level security;
alter table public.deals           enable row level security;
alter table public.anomalies       enable row level security;
alter table public.cron_runs       enable row level security;

create policy "price_snapshots_select_all" on public.price_snapshots for select using (true);
create policy "deals_select_all"           on public.deals           for select using (true);
create policy "anomalies_select_all"       on public.anomalies       for select using (true);
create policy "cron_runs_select_all"       on public.cron_runs       for select using (true);
-- No INSERT/UPDATE/DELETE policies: only the service-role key (which bypasses RLS) writes.

-- ── RPC: bulk upsert snapshots, keeping the daily minimum price ────────────────
create or replace function public.record_snapshots(p_rows jsonb)
returns void language sql security definer set search_path = public as $$
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

-- ── RPC: anomaly candidates for one origin (set-based, single round-trip) ──────
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
           stddev_samp(ps.price_rub)                                 as stddev,
           count(*)                                                  as n
    from public.price_snapshots ps
    where ps.origin_iata = p_origin
      and ps.destination_iata = l.destination_iata
      and date_trunc('month', ps.depart_date) = date_trunc('month', l.depart_date)
      and ps.observed_at > now() - interval '30 days'
  ) s;
$$;
