-- Fix ambiguous checked_in_at reference in verify_guest_check_in.

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

  update public.guests as g
     set checked_in = true,
         checked_in_at = coalesce(g.checked_in_at, v_now),
         entry_count = g.entry_count + 1
   where g.id = v_guest.id
   returning g.* into v_guest;

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
