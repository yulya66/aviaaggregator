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
