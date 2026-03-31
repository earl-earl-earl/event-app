-- Ensure pgcrypto is available and digest() resolves inside security-definer function.

create extension if not exists pgcrypto;

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
set search_path = public, extensions
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
      else encode(digest(p_token::text, 'sha256'::text), 'hex')
    end,
    coalesce(p_payload, '{}'::jsonb)
  );
end;
$$;
