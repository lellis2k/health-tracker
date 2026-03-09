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
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.families        enable row level security;
alter table public.family_members  enable row level security;
alter table public.people          enable row level security;
alter table public.symptom_entries enable row level security;

-- Helper: is the current user a member of a given family?
-- (used in policies below)

-- ---- families ----

drop policy if exists "family members can read their family"   on public.families;
drop policy if exists "authenticated users can create families" on public.families;
drop policy if exists "family admins can update their family"  on public.families;

create policy "family members can read their family"
  on public.families for select to authenticated
  using (
    exists (
      select 1 from public.family_members fm
      where fm.family_id = families.id
        and fm.user_id   = auth.uid()
    )
  );

create policy "authenticated users can create families"
  on public.families for insert to authenticated
  with check (true);

create policy "family admins can update their family"
  on public.families for update to authenticated
  using (
    exists (
      select 1 from public.family_members fm
      where fm.family_id = families.id
        and fm.user_id   = auth.uid()
        and fm.role      = 'admin'
    )
  );

-- ---- family_members ----

drop policy if exists "family members can read members"  on public.family_members;
drop policy if exists "users can join or admins can add" on public.family_members;

create policy "family members can read members"
  on public.family_members for select to authenticated
  using (
    exists (
      select 1 from public.family_members fm2
      where fm2.family_id = family_members.family_id
        and fm2.user_id   = auth.uid()
    )
  );

create policy "users can join or admins can add"
  on public.family_members for insert to authenticated
  with check (
    -- The user is adding themselves (signup flow)
    user_id = auth.uid()
    or
    -- Or an existing admin is adding someone
    exists (
      select 1 from public.family_members fm2
      where fm2.family_id = family_members.family_id
        and fm2.user_id   = auth.uid()
        and fm2.role      = 'admin'
    )
  );

-- ---- people ----

drop policy if exists "family members can read people"   on public.people;
drop policy if exists "family members can insert people" on public.people;
drop policy if exists "family members can update people" on public.people;

create policy "family members can read people"
  on public.people for select to authenticated
  using (
    exists (
      select 1 from public.family_members fm
      where fm.family_id = people.family_id
        and fm.user_id   = auth.uid()
    )
  );

create policy "family members can insert people"
  on public.people for insert to authenticated
  with check (
    exists (
      select 1 from public.family_members fm
      where fm.family_id = people.family_id
        and fm.user_id   = auth.uid()
    )
  );

create policy "family members can update people"
  on public.people for update to authenticated
  using (
    exists (
      select 1 from public.family_members fm
      where fm.family_id = people.family_id
        and fm.user_id   = auth.uid()
    )
  );

-- ---- symptom_entries ----

drop policy if exists "family members can read entries"   on public.symptom_entries;
drop policy if exists "family members can insert entries" on public.symptom_entries;
drop policy if exists "family members can update entries" on public.symptom_entries;
drop policy if exists "family members can delete entries" on public.symptom_entries;

create policy "family members can read entries"
  on public.symptom_entries for select to authenticated
  using (
    exists (
      select 1 from public.family_members fm
      where fm.family_id = symptom_entries.family_id
        and fm.user_id   = auth.uid()
    )
  );

create policy "family members can insert entries"
  on public.symptom_entries for insert to authenticated
  with check (
    exists (
      select 1 from public.family_members fm
      where fm.family_id = symptom_entries.family_id
        and fm.user_id   = auth.uid()
    )
  );

create policy "family members can update entries"
  on public.symptom_entries for update to authenticated
  using (
    exists (
      select 1 from public.family_members fm
      where fm.family_id = symptom_entries.family_id
        and fm.user_id   = auth.uid()
    )
  );

create policy "family members can delete entries"
  on public.symptom_entries for delete to authenticated
  using (
    exists (
      select 1 from public.family_members fm
      where fm.family_id = symptom_entries.family_id
        and fm.user_id   = auth.uid()
    )
  );
