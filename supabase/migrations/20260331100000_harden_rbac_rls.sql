-- Harden RBAC/RLS and expand profiles metadata.

-- Ensure enum exists when this migration is run independently.
do $$
begin
  if not exists (
    select 1
      from pg_type t
      join pg_namespace n on n.oid = t.typnamespace
     where t.typname = 'profile_role'
       and n.nspname = 'public'
  ) then
    create type public.profile_role as enum ('admin', 'organizer');
  end if;
end;
$$;

alter table public.profiles
  add column if not exists full_name text,
  add column if not exists phone_number text,
  add column if not exists is_active boolean not null default true,
  add column if not exists created_by uuid references auth.users(id) on delete set null;

create index if not exists profiles_is_active_idx on public.profiles(is_active);
create index if not exists profiles_created_by_idx on public.profiles(created_by);

-- Add constraints once to keep migration idempotent.
do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conname = 'profiles_full_name_length_check'
       and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_full_name_length_check
      check (full_name is null or char_length(trim(full_name)) between 2 and 160);
  end if;

  if not exists (
    select 1
      from pg_constraint
     where conname = 'profiles_phone_number_length_check'
       and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_phone_number_length_check
      check (phone_number is null or char_length(trim(phone_number)) between 7 and 30);
  end if;
end;
$$;

create or replace function public.current_profile_role()
returns public.profile_role
language sql
stable
set search_path = public
as $$
  select p.role
    from public.profiles p
   where p.id = auth.uid()
     and p.is_active = true
   limit 1;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
set search_path = public
as $$
  select coalesce(public.current_profile_role() = 'admin', false);
$$;

create or replace function public.is_organizer_or_admin()
returns boolean
language sql
stable
set search_path = public
as $$
  select coalesce(public.current_profile_role() in ('admin', 'organizer'), false);
$$;

alter table public.events enable row level security;
alter table public.guests enable row level security;
alter table public.scan_logs enable row level security;
alter table public.dispatch_queue enable row level security;
alter table public.verify_rate_limits enable row level security;
alter table public.profiles enable row level security;

alter table public.events force row level security;
alter table public.guests force row level security;
alter table public.scan_logs force row level security;
alter table public.dispatch_queue force row level security;
alter table public.verify_rate_limits force row level security;
alter table public.profiles force row level security;

drop policy if exists "events_select_authenticated" on public.events;
drop policy if exists "events_read_management" on public.events;
drop policy if exists "events_insert_management" on public.events;
drop policy if exists "events_update_management" on public.events;
drop policy if exists "events_delete_management" on public.events;

create policy "events_read_management"
on public.events
for select
to authenticated
using (public.is_organizer_or_admin());

create policy "events_insert_management"
on public.events
for insert
to authenticated
with check (public.is_organizer_or_admin());

create policy "events_update_management"
on public.events
for update
to authenticated
using (public.is_organizer_or_admin())
with check (public.is_organizer_or_admin());

create policy "events_delete_management"
on public.events
for delete
to authenticated
using (public.is_organizer_or_admin());

drop policy if exists "guests_select_authenticated" on public.guests;
drop policy if exists "guests_read_management" on public.guests;
drop policy if exists "guests_insert_management" on public.guests;
drop policy if exists "guests_update_management" on public.guests;
drop policy if exists "guests_delete_management" on public.guests;

create policy "guests_read_management"
on public.guests
for select
to authenticated
using (public.is_organizer_or_admin());

create policy "guests_insert_management"
on public.guests
for insert
to authenticated
with check (public.is_organizer_or_admin());

create policy "guests_update_management"
on public.guests
for update
to authenticated
using (public.is_organizer_or_admin())
with check (public.is_organizer_or_admin());

create policy "guests_delete_management"
on public.guests
for delete
to authenticated
using (public.is_organizer_or_admin());

drop policy if exists "scan_logs_select_authenticated" on public.scan_logs;
drop policy if exists "scan_logs_read_management" on public.scan_logs;

create policy "scan_logs_read_management"
on public.scan_logs
for select
to authenticated
using (public.is_organizer_or_admin());

drop policy if exists "dispatch_queue_select_authenticated" on public.dispatch_queue;
drop policy if exists "dispatch_queue_read_management" on public.dispatch_queue;
drop policy if exists "dispatch_queue_insert_management" on public.dispatch_queue;
drop policy if exists "dispatch_queue_update_management" on public.dispatch_queue;
drop policy if exists "dispatch_queue_delete_management" on public.dispatch_queue;

create policy "dispatch_queue_read_management"
on public.dispatch_queue
for select
to authenticated
using (public.is_organizer_or_admin());

create policy "dispatch_queue_insert_management"
on public.dispatch_queue
for insert
to authenticated
with check (public.is_organizer_or_admin());

create policy "dispatch_queue_update_management"
on public.dispatch_queue
for update
to authenticated
using (public.is_organizer_or_admin())
with check (public.is_organizer_or_admin());

create policy "dispatch_queue_delete_management"
on public.dispatch_queue
for delete
to authenticated
using (public.is_organizer_or_admin());

drop policy if exists "verify_rate_limits_select_authenticated" on public.verify_rate_limits;

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_admin_read_all" on public.profiles;
drop policy if exists "profiles_admin_insert" on public.profiles;
drop policy if exists "profiles_admin_update" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (auth.uid() = id and is_active = true);

create policy "profiles_admin_read_all"
on public.profiles
for select
to authenticated
using (public.is_admin());

create policy "profiles_admin_insert"
on public.profiles
for insert
to authenticated
with check (public.is_admin());

create policy "profiles_admin_update"
on public.profiles
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());
