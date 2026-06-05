-- seed.sql — demo data for trying the product without a Travelpayouts token.
-- Auto-loaded after migrations on `supabase db reset`. Safe to re-run (ON CONFLICT DO NOTHING).
-- deep_link uses a DEMO marker; these are not real bookings.

-- ── L2 deals (home feed) ──────────────────────────────────────────────────────
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

-- ── L3 anomalies (anomaly engine output) ──────────────────────────────────────
-- One has discount_pct >= 50 to show the red highlight on /anomalies and the home badge.
insert into public.anomalies
  (id, origin_iata, destination_iata, depart_date, return_date, price_rub, median_price_rub, discount_pct, z_score, airline, transfers, deep_link, is_active)
values
  (gen_random_uuid(), 'EVN', 'FCO', '2026-10-12', null,  5000, 18000, 72.2, -3.25, 'PC', 1, 'https://www.aviasales.ru/search/EVN1210FCO1?marker=DEMO.l3_demo_', true),
  (gen_random_uuid(), 'TBS', 'BCN', '2026-10-20', null,  8800, 17500, 49.7, -2.10, 'A9', 1, 'https://www.aviasales.ru/search/TBS2010BCN1?marker=DEMO.l3_demo_', true),
  (gen_random_uuid(), 'IST', 'BKK', '2026-11-05', null, 19900, 31000, 35.8, -1.55, 'TK', 0, 'https://www.aviasales.ru/search/IST0511BKK1?marker=DEMO.l3_demo_', true)
on conflict (origin_iata, destination_iata, depart_date) do nothing;
