create extension if not exists pgcrypto;

create table if not exists public.admin_users (
  email text primary key,
  created_at timestamptz not null default now()
);

create table if not exists public.tournament_results (
  id uuid primary key default gen_random_uuid(),
  month date not null,
  participant_name text not null,
  placement integer not null check (placement > 0),
  points integer not null check (points >= 0),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  constraint tournament_results_month_participant_key unique (month, participant_name)
);

create index if not exists tournament_results_month_idx
  on public.tournament_results (month desc);

alter table public.admin_users enable row level security;
alter table public.tournament_results enable row level security;

create or replace function public.is_admin_user()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.admin_users
    where email = auth.jwt() ->> 'email'
  );
$$;

drop policy if exists "Public can read admin users" on public.admin_users;
create policy "Public can read admin users"
  on public.admin_users
  for select
  using (true);

drop policy if exists "Admins can manage admin users" on public.admin_users;
create policy "Admins can manage admin users"
  on public.admin_users
  for all
  using (public.is_admin_user())
  with check (public.is_admin_user());

drop policy if exists "Public can read tournament results" on public.tournament_results;
create policy "Public can read tournament results"
  on public.tournament_results
  for select
  using (true);

drop policy if exists "Admins can insert tournament results" on public.tournament_results;
create policy "Admins can insert tournament results"
  on public.tournament_results
  for insert
  to authenticated
  with check (public.is_admin_user());

drop policy if exists "Admins can update tournament results" on public.tournament_results;
create policy "Admins can update tournament results"
  on public.tournament_results
  for update
  to authenticated
  using (public.is_admin_user())
  with check (public.is_admin_user());

drop policy if exists "Admins can delete tournament results" on public.tournament_results;
create policy "Admins can delete tournament results"
  on public.tournament_results
  for delete
  to authenticated
  using (public.is_admin_user());

insert into public.admin_users (email)
values ('organizer@titancupseries.com')
on conflict (email) do nothing;
