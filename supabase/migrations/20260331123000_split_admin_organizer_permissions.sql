-- Split permissions: admin is read-only for events/guests; organizer can mutate.

create or replace function public.is_organizer()
returns boolean
language sql
stable
set search_path = public
as $$
  select coalesce(public.current_profile_role() = 'organizer', false);
$$;

-- Events: read by admin/organizer, mutate by organizer only.
drop policy if exists "events_insert_management" on public.events;
drop policy if exists "events_update_management" on public.events;
drop policy if exists "events_delete_management" on public.events;

create policy "events_insert_management"
on public.events
for insert
to authenticated
with check (public.is_organizer());

create policy "events_update_management"
on public.events
for update
to authenticated
using (public.is_organizer())
with check (public.is_organizer());

create policy "events_delete_management"
on public.events
for delete
to authenticated
using (public.is_organizer());

-- Guests: read by admin/organizer, mutate by organizer only.
drop policy if exists "guests_insert_management" on public.guests;
drop policy if exists "guests_update_management" on public.guests;
drop policy if exists "guests_delete_management" on public.guests;

create policy "guests_insert_management"
on public.guests
for insert
to authenticated
with check (public.is_organizer());

create policy "guests_update_management"
on public.guests
for update
to authenticated
using (public.is_organizer())
with check (public.is_organizer());

create policy "guests_delete_management"
on public.guests
for delete
to authenticated
using (public.is_organizer());

-- Dispatch queue actions are operational and organizer-only.
drop policy if exists "dispatch_queue_insert_management" on public.dispatch_queue;
drop policy if exists "dispatch_queue_update_management" on public.dispatch_queue;
drop policy if exists "dispatch_queue_delete_management" on public.dispatch_queue;

create policy "dispatch_queue_insert_management"
on public.dispatch_queue
for insert
to authenticated
with check (public.is_organizer());

create policy "dispatch_queue_update_management"
on public.dispatch_queue
for update
to authenticated
using (public.is_organizer())
with check (public.is_organizer());

create policy "dispatch_queue_delete_management"
on public.dispatch_queue
for delete
to authenticated
using (public.is_organizer());
