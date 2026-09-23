-- 20260923000001_anomalies_freshness.sql
-- /anomalies filters by depart_date and orders by discount_pct desc. Neither existing
-- index helps that: anomalies_route_uniq leads with origin_iata, anomalies_detected_idx
-- with detected_at. On top of that L3 only ever set is_active to true, so rows for
-- departures already in the past piled up — 896 of 1230 live rows on 2026-09-23.

-- Covers the page query. Partial: once the sweep below runs, only current rows stay
-- indexed, so the index shrinks with the working set instead of the whole table.
create index if not exists anomalies_active_depart_idx
  on public.anomalies (depart_date, discount_pct desc)
  where is_active;

-- One-off sweep of the backlog. L3 keeps it clean from now on (see src/lib/jobs/l3.ts).
-- The cutoff is the Yekaterinburg date, the same one /anomalies uses for its lower
-- bound, so this retires exactly the rows the page can no longer show.
update public.anomalies
   set is_active = false
 where is_active
   and depart_date < (now() at time zone 'Asia/Yekaterinburg')::date;
