-- QR Event Check-In schema for Supabase/PostgreSQL.
-- Run this file in Supabase SQL Editor (or as a migration) before starting the app.

create extension if not exists pgcrypto;

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  date timestamptz not null,
  location text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.guests (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  email text not null,
  phone_number text not null,
  qr_token text not null unique,
  checked_in boolean not null default false,
  checked_in_at timestamptz,
  entry_count integer not null default 0 check (entry_count >= 0),
  max_entries integer not null default 1 check (max_entries > 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists guests_event_id_idx on public.guests(event_id);
create index if not exists guests_event_checked_idx on public.guests(event_id, checked_in);
create index if not exists guests_event_email_idx on public.guests(event_id, lower(email));

create table if not exists public.scan_logs (
  id bigserial primary key,
  event_id uuid references public.events(id) on delete set null,
  guest_id uuid references public.guests(id) on delete set null,
  scanned_at timestamptz not null default timezone('utc', now()),
  success boolean not null,
  reason text not null,
  scanner_id text,
  scanned_by text,
  source_ip inet,
  token_hash text,
  payload jsonb not null default '{}'::jsonb
);

create index if not exists scan_logs_event_scanned_idx on public.scan_logs(event_id, scanned_at desc);
create index if not exists scan_logs_guest_scanned_idx on public.scan_logs(guest_id, scanned_at desc);

create table if not exists public.verify_rate_limits (
  identifier text primary key,
  window_started_at timestamptz not null,
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists verify_rate_limits_updated_idx on public.verify_rate_limits(updated_at);

create table if not exists public.dispatch_queue (
  id bigserial primary key,
  guest_id uuid not null references public.guests(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  channel text not null check (channel in ('email', 'sms')),
  destination text not null,
  ticket_link text not null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'sent', 'failed')),
  attempts integer not null default 0 check (attempts >= 0),
  last_error text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists dispatch_queue_status_created_idx on public.dispatch_queue(status, created_at);

create or replace function public.touch_dispatch_queue_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists dispatch_queue_set_updated_at on public.dispatch_queue;
create trigger dispatch_queue_set_updated_at
before update on public.dispatch_queue
for each row
execute function public.touch_dispatch_queue_updated_at();

create or replace function public.log_scan_attempt(
  p_success boolean,
  p_reason text,
  p_event_id uuid default null,
  p_guest_id uuid default null,
  p_token text default null,
  p_scanner_id text default null,
  p_scanned_by text default null,
  p_source_ip inet default null,
  p_payload jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.scan_logs (
    event_id,
    guest_id,
    success,
    reason,
    scanner_id,
    scanned_by,
    source_ip,
    token_hash,
    payload
  )
  values (
    p_event_id,
    p_guest_id,
    p_success,
    p_reason,
    p_scanner_id,
    p_scanned_by,
    p_source_ip,
    case
      when p_token is null or length(trim(p_token)) = 0 then null
      else encode(digest(p_token, 'sha256'), 'hex')
    end,
    coalesce(p_payload, '{}'::jsonb)
  );
end;
$$;

create or replace function public.enforce_verify_rate_limit(
  p_identifier text,
  p_window_seconds integer,
  p_max_requests integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_record public.verify_rate_limits%rowtype;
  v_now timestamptz := timezone('utc', now());
begin
  if coalesce(length(trim(p_identifier)), 0) = 0 then
    return false;
  end if;

  if p_window_seconds <= 0 or p_max_requests <= 0 then
    return false;
  end if;

  insert into public.verify_rate_limits (identifier, window_started_at, request_count, updated_at)
  values (p_identifier, v_now, 0, v_now)
  on conflict do nothing;

  select *
    into v_record
    from public.verify_rate_limits
   where identifier = p_identifier
   for update;

  if v_record.window_started_at + make_interval(secs => p_window_seconds) <= v_now then
    update public.verify_rate_limits
       set window_started_at = v_now,
           request_count = 1,
           updated_at = v_now
     where identifier = p_identifier;

    return true;
  end if;

  if v_record.request_count >= p_max_requests then
    return false;
  end if;

  update public.verify_rate_limits
     set request_count = request_count + 1,
         updated_at = v_now
   where identifier = p_identifier;

  return true;
end;
$$;

create or replace function public.verify_guest_check_in(
  p_guest_id uuid,
  p_event_id uuid,
  p_token text,
  p_scanner_id text default null,
  p_scanned_by text default null,
  p_source_ip inet default null
)
returns table (
  success boolean,
  code text,
  message text,
  guest_id uuid,
  event_id uuid,
  guest_name text,
  metadata jsonb,
  entry_count integer,
  max_entries integer,
  checked_in_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_guest public.guests%rowtype;
  v_now timestamptz := timezone('utc', now());
  v_guest_name text;
begin
  select *
    into v_guest
    from public.guests
   where id = p_guest_id
   for update;

  if not found then
    perform public.log_scan_attempt(
      false,
      'guest_not_found',
      p_event_id,
      p_guest_id,
      p_token,
      p_scanner_id,
      p_scanned_by,
      p_source_ip,
      '{}'::jsonb
    );

    return query
    select false,
           'guest_not_found',
           'Guest not found.',
           null::uuid,
           p_event_id,
           null::text,
           '{}'::jsonb,
           0,
           0,
           null::timestamptz;
    return;
  end if;

  v_guest_name = trim(v_guest.first_name || ' ' || v_guest.last_name);

  if v_guest.event_id <> p_event_id then
    perform public.log_scan_attempt(
      false,
      'event_mismatch',
      v_guest.event_id,
      v_guest.id,
      p_token,
      p_scanner_id,
      p_scanned_by,
      p_source_ip,
      jsonb_build_object('payload_event_id', p_event_id)
    );

    return query
    select false,
           'event_mismatch',
           'Event mismatch.',
           v_guest.id,
           v_guest.event_id,
           v_guest_name,
           v_guest.metadata,
           v_guest.entry_count,
           v_guest.max_entries,
           v_guest.checked_in_at;
    return;
  end if;

  if v_guest.qr_token <> p_token then
    perform public.log_scan_attempt(
      false,
      'token_mismatch',
      v_guest.event_id,
      v_guest.id,
      p_token,
      p_scanner_id,
      p_scanned_by,
      p_source_ip,
      '{}'::jsonb
    );

    return query
    select false,
           'invalid_token',
           'Token does not match guest record.',
           v_guest.id,
           v_guest.event_id,
           v_guest_name,
           v_guest.metadata,
           v_guest.entry_count,
           v_guest.max_entries,
           v_guest.checked_in_at;
    return;
  end if;

  if v_guest.checked_in = true and v_guest.max_entries = 1 then
    perform public.log_scan_attempt(
      false,
      'already_checked_in',
      v_guest.event_id,
      v_guest.id,
      p_token,
      p_scanner_id,
      p_scanned_by,
      p_source_ip,
      jsonb_build_object('entry_count', v_guest.entry_count, 'max_entries', v_guest.max_entries)
    );

    return query
    select false,
           'already_checked_in',
           'Guest already checked in.',
           v_guest.id,
           v_guest.event_id,
           v_guest_name,
           v_guest.metadata,
           v_guest.entry_count,
           v_guest.max_entries,
           v_guest.checked_in_at;
    return;
  end if;

  if v_guest.entry_count >= v_guest.max_entries then
    perform public.log_scan_attempt(
      false,
      'entry_limit_reached',
      v_guest.event_id,
      v_guest.id,
      p_token,
      p_scanner_id,
      p_scanned_by,
      p_source_ip,
      jsonb_build_object('entry_count', v_guest.entry_count, 'max_entries', v_guest.max_entries)
    );

    return query
    select false,
           'entry_limit_reached',
           'Entry limit reached.',
           v_guest.id,
           v_guest.event_id,
           v_guest_name,
           v_guest.metadata,
           v_guest.entry_count,
           v_guest.max_entries,
           v_guest.checked_in_at;
    return;
  end if;

  update public.guests
     set checked_in = true,
         checked_in_at = coalesce(checked_in_at, v_now),
         entry_count = entry_count + 1
   where id = v_guest.id
   returning * into v_guest;

  perform public.log_scan_attempt(
    true,
    'success',
    v_guest.event_id,
    v_guest.id,
    p_token,
    p_scanner_id,
    p_scanned_by,
    p_source_ip,
    jsonb_build_object('entry_count', v_guest.entry_count, 'max_entries', v_guest.max_entries)
  );

  return query
  select true,
         'ok',
         'Check-in successful.',
         v_guest.id,
         v_guest.event_id,
         trim(v_guest.first_name || ' ' || v_guest.last_name),
         v_guest.metadata,
         v_guest.entry_count,
         v_guest.max_entries,
         v_guest.checked_in_at;
end;
$$;

create or replace function public.claim_dispatch_jobs(p_limit integer default 100)
returns table (
  id bigint,
  channel text,
  destination text,
  ticket_link text,
  attempts integer,
  guest_first_name text,
  guest_last_name text,
  event_name text,
  event_date timestamptz,
  event_location text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with locked_jobs as (
    select dq.id
      from public.dispatch_queue dq
     where dq.status = 'pending'
     order by dq.created_at asc
     limit least(greatest(p_limit, 1), 500)
     for update skip locked
  ),
  updated_jobs as (
    update public.dispatch_queue dq
       set status = 'processing',
           attempts = dq.attempts + 1,
           updated_at = timezone('utc', now())
      from locked_jobs
     where dq.id = locked_jobs.id
    returning dq.*
  )
  select uj.id,
         uj.channel,
         uj.destination,
         uj.ticket_link,
         uj.attempts,
         g.first_name,
         g.last_name,
         e.name,
         e.date,
         e.location
    from updated_jobs uj
    join public.guests g on g.id = uj.guest_id
    join public.events e on e.id = uj.event_id;
end;
$$;

alter table public.events enable row level security;
alter table public.guests enable row level security;
alter table public.scan_logs enable row level security;
alter table public.dispatch_queue enable row level security;
alter table public.verify_rate_limits enable row level security;

drop policy if exists "events_select_authenticated" on public.events;
create policy "events_select_authenticated"
on public.events
for select
to authenticated
using (true);

drop policy if exists "guests_select_authenticated" on public.guests;
create policy "guests_select_authenticated"
on public.guests
for select
to authenticated
using (true);

drop policy if exists "scan_logs_select_authenticated" on public.scan_logs;
create policy "scan_logs_select_authenticated"
on public.scan_logs
for select
to authenticated
using (true);

drop policy if exists "dispatch_queue_select_authenticated" on public.dispatch_queue;
create policy "dispatch_queue_select_authenticated"
on public.dispatch_queue
for select
to authenticated
using (true);

-- Expose guests changes to Supabase Realtime for dashboard updates.
do $$
begin
  if not exists (
    select 1
      from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'guests'
  ) then
    execute 'alter publication supabase_realtime add table public.guests';
  end if;
end;
$$;
