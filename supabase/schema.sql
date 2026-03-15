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
  created_at   timestamptz not null default now(),
  -- Duration tracking (feeds future auto-episode detection)
  onset_date   date,                                        -- when symptom actually began (null = not set / point-in-time log)
  is_resolved  boolean not null default false,             -- true once symptom is resolved
  resolved_at  timestamptz                                  -- when it was marked resolved
);

-- Migration: add columns if table already exists
alter table public.symptom_entries
  add column if not exists onset_date  date,
  add column if not exists is_resolved boolean not null default false,
  add column if not exists resolved_at timestamptz;

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

-- ============================================================
-- MEDICATION TRACKING TABLES
-- ============================================================

create table if not exists public.medications (
  id              uuid primary key default gen_random_uuid(),
  person_id       uuid not null references public.people(id) on delete cascade,
  family_id       uuid not null references public.families(id) on delete cascade,
  medication_name text not null,
  dosage          text,                                          -- e.g. "500mg", "10ml"
  frequency       text not null default 'as_needed'
                    check (frequency in (
                      'once_daily', 'twice_daily', 'three_daily',
                      'four_daily', 'every_8_hours', 'every_12_hours',
                      'as_needed', 'other'
                    )),
  frequency_notes text,                                          -- free text for "other" or details
  med_type        text not null default 'otc'
                    check (med_type in ('prescribed', 'otc')),
  prescriber      text,                                          -- doctor name, only if prescribed
  start_date      date,                                          -- when started taking
  end_date        date,                                          -- planned end date (optional)
  is_active       boolean not null default true,                 -- false = completed/discontinued
  discontinued_at timestamptz,                                   -- when marked inactive
  notes           text,
  created_by      uuid references auth.users(id) on delete set null,
  logged_at       timestamptz not null default now(),            -- server-set, for ordering
  created_at      timestamptz not null default now()
);

create table if not exists public.medication_doses (
  id              uuid primary key default gen_random_uuid(),
  medication_id   uuid not null references public.medications(id) on delete cascade,
  family_id       uuid not null references public.families(id) on delete cascade,
  taken_at        timestamptz not null,                          -- when the dose was taken
  notes           text,
  created_by      uuid references auth.users(id) on delete set null,
  logged_at       timestamptz not null default now(),
  created_at      timestamptz not null default now()
);

-- Indexes
create index if not exists medications_family_logged
  on public.medications (family_id, logged_at desc);

create index if not exists medications_person
  on public.medications (person_id);

create index if not exists medication_doses_medication
  on public.medication_doses (medication_id, taken_at desc);

create index if not exists medication_doses_family
  on public.medication_doses (family_id, taken_at desc);

-- Grants
grant all on table public.medications      to anon, authenticated, service_role;
grant all on table public.medication_doses to anon, authenticated, service_role;

-- RLS
alter table public.medications      enable row level security;
alter table public.medication_doses enable row level security;

-- Drop existing medication policies if re-running
do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('medications', 'medication_doses')
  loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- Policies: medications
create policy "medications_select" on public.medications
  for select to authenticated
  using (public.is_family_member(family_id));

create policy "medications_insert" on public.medications
  for insert to authenticated
  with check (public.is_family_member(family_id));

create policy "medications_update" on public.medications
  for update to authenticated
  using (public.is_family_member(family_id));

create policy "medications_delete" on public.medications
  for delete to authenticated
  using (public.is_family_member(family_id));

-- Policies: medication_doses
create policy "medication_doses_select" on public.medication_doses
  for select to authenticated
  using (public.is_family_member(family_id));

create policy "medication_doses_insert" on public.medication_doses
  for insert to authenticated
  with check (public.is_family_member(family_id));

create policy "medication_doses_update" on public.medication_doses
  for update to authenticated
  using (public.is_family_member(family_id));

create policy "medication_doses_delete" on public.medication_doses
  for delete to authenticated
  using (public.is_family_member(family_id));

-- ============================================================
-- PUSH NOTIFICATIONS (PoC)
-- ============================================================

create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  family_id  uuid not null references public.families(id) on delete cascade,
  endpoint   text not null unique,
  auth_key   text not null,
  p256dh_key text not null,
  created_at timestamptz not null default now()
);

grant all on public.push_subscriptions to authenticated, anon, service_role;
