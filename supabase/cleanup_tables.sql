-- Clear Health Tracker app data while keeping schema, RLS policies, and auth users.

begin;

truncate table
  public.symptom_entries,
  public.people,
  public.family_members,
  public.families
restart identity cascade;

commit;

-- Sanity check: all counts should be 0
select 'families' as table_name, count(*) as row_count from public.families
union all
select 'family_members', count(*) from public.family_members
union all
select 'people', count(*) from public.people
union all
select 'symptom_entries', count(*) from public.symptom_entries;
