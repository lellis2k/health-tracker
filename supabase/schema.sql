-- Health Tracker Database Schema
-- Run this entire file in the Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- It is safe to run multiple times (idempotent).

-- ============================================================
-- TABLES
-- ============================================================

create table if not exists public.families (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.family_members (
  id         uuid primary key default gen_random_uuid(),
  family_id  uuid not null references public.families(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null default 'member' check (role in ('admin', 'member')),
  created_at timestamptz not null default now(),
  unique (family_id, user_id)
);

-- People whose symptoms are tracked. May or may not have an auth account.
create table if not exists public.people (
  id           uuid primary key default gen_random_uuid(),
  family_id    uuid not null references public.families(id) on delete cascade,
  user_id      uuid references auth.users(id) on delete set null, -- null for non-auth members
  display_name text not null,
  created_at   timestamptz not null default now()
);

create table if not exists public.symptom_entries (
  id           uuid primary key default gen_random_uuid(),
  person_id    uuid not null references public.people(id) on delete cascade,
  family_id    uuid not null references public.families(id) on delete cascade,
  symptom_name text not null,
  severity     int  not null check (severity between 1 and 5),
  notes        text,
  logged_at    timestamptz not null default now(),
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);

-- Useful index for the main query pattern
create index if not exists symptom_entries_family_logged
  on public.symptom_entries (family_id, logged_at desc);

create index if not exists people_family
  on public.people (family_id);

create index if not exists family_members_user
  on public.family_members (user_id);

-- ============================================================
-- GRANTS
-- Supabase does not always apply default privileges to manually-created tables.
-- Explicitly grant table-level permissions so RLS policies can function correctly.
-- ============================================================

grant all on table public.families        to anon, authenticated, service_role;
grant all on table public.family_members  to anon, authenticated, service_role;
grant all on table public.people          to anon, authenticated, service_role;
grant all on table public.symptom_entries to anon, authenticated, service_role;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.families        enable row level security;
alter table public.family_members  enable row level security;
alter table public.people          enable row level security;
alter table public.symptom_entries enable row level security;

-- Drop ALL existing policies on all four tables (handles any leftover from prior runs).
do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('families', 'family_members', 'people', 'symptom_entries')
  loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- ============================================================
-- SECURITY-DEFINER HELPERS
-- These functions query family_members while bypassing RLS,
-- breaking the infinite-recursion cycle that occurs when RLS
-- policies reference the same table they protect.
-- ============================================================

create or replace function public.is_family_member(p_family_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.family_members
    where family_id = p_family_id
      and user_id   = auth.uid()
  );
$$;

create or replace function public.is_family_admin(p_family_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.family_members
    where family_id = p_family_id
      and user_id   = auth.uid()
      and role      = 'admin'
  );
$$;

grant execute on function public.is_family_member(uuid) to authenticated;
grant execute on function public.is_family_admin(uuid)  to authenticated;

-- ---- families ----

create policy "families_select" on public.families
  for select to authenticated
  using (public.is_family_member(id));

create policy "families_insert" on public.families
  for insert to authenticated
  with check (true);

create policy "families_update" on public.families
  for update to authenticated
  using (public.is_family_admin(id));

-- ---- family_members ----

create policy "family_members_select" on public.family_members
  for select to authenticated
  using (public.is_family_member(family_id));

create policy "family_members_insert" on public.family_members
  for insert to authenticated
  with check (true);

-- ---- people ----
-- INSERT uses is_family_member — safe because family_members is created
-- before people during first-time setup (see dashboard/page.tsx).

create policy "people_select" on public.people
  for select to authenticated
  using (public.is_family_member(family_id));

create policy "people_insert" on public.people
  for insert to authenticated
  with check (public.is_family_member(family_id));

create policy "people_update" on public.people
  for update to authenticated
  using (public.is_family_member(family_id));

-- ---- symptom_entries ----

create policy "entries_select" on public.symptom_entries
  for select to authenticated
  using (public.is_family_member(family_id));

create policy "entries_insert" on public.symptom_entries
  for insert to authenticated
  with check (public.is_family_member(family_id));

create policy "entries_update" on public.symptom_entries
  for update to authenticated
  using (public.is_family_member(family_id));

create policy "entries_delete" on public.symptom_entries
  for delete to authenticated
  using (public.is_family_member(family_id));
