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
