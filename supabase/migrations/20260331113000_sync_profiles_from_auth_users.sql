-- Auto-sync public.profiles rows from auth.users lifecycle events.

alter table public.profiles
  alter column role set default 'organizer'::public.profile_role;

create or replace function public.sync_profile_from_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role_text text;
  v_role public.profile_role;
  v_full_name text;
  v_phone_number text;
begin
  v_role_text := lower(
    coalesce(
      new.raw_app_meta_data ->> 'role',
      new.raw_user_meta_data ->> 'role',
      'organizer'
    )
  );

  if v_role_text = 'admin' then
    v_role := 'admin';
  else
    v_role := 'organizer';
  end if;

  v_full_name := nullif(
    trim(
      coalesce(
        new.raw_user_meta_data ->> 'full_name',
        new.raw_user_meta_data ->> 'name',
        ''
      )
    ),
    ''
  );

  v_phone_number := nullif(
    trim(
      coalesce(
        new.raw_user_meta_data ->> 'phone_number',
        new.phone,
        ''
      )
    ),
    ''
  );

  if v_full_name is not null and char_length(v_full_name) < 2 then
    v_full_name := null;
  elsif v_full_name is not null and char_length(v_full_name) > 160 then
    v_full_name := left(v_full_name, 160);
  end if;

  if v_phone_number is not null and char_length(v_phone_number) < 7 then
    v_phone_number := null;
  elsif v_phone_number is not null and char_length(v_phone_number) > 30 then
    v_phone_number := left(v_phone_number, 30);
  end if;

  insert into public.profiles (
    id,
    role,
    full_name,
    phone_number,
    is_active
  )
  values (
    new.id,
    v_role,
    v_full_name,
    v_phone_number,
    true
  )
  on conflict (id) do update
    set role = excluded.role,
        full_name = coalesce(excluded.full_name, public.profiles.full_name),
        phone_number = coalesce(excluded.phone_number, public.profiles.phone_number),
        is_active = true,
        updated_at = timezone('utc', now());

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_sync_profile on auth.users;
create trigger on_auth_user_created_sync_profile
after insert on auth.users
for each row
execute function public.sync_profile_from_auth_user();

drop trigger if exists on_auth_user_updated_sync_profile on auth.users;
create trigger on_auth_user_updated_sync_profile
after update of raw_app_meta_data, raw_user_meta_data, phone on auth.users
for each row
execute function public.sync_profile_from_auth_user();

-- Backfill profiles for already-existing auth users missing profile rows.
insert into public.profiles (
  id,
  role,
  full_name,
  phone_number,
  is_active
)
select
  u.id,
  case
    when lower(coalesce(u.raw_app_meta_data ->> 'role', u.raw_user_meta_data ->> 'role', 'organizer')) = 'admin'
      then 'admin'::public.profile_role
    else 'organizer'::public.profile_role
  end as role,
  case
    when char_length(trim(coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', ''))) between 2 and 160
      then trim(coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name'))
    else null
  end as full_name,
  case
    when char_length(trim(coalesce(u.raw_user_meta_data ->> 'phone_number', u.phone, ''))) between 7 and 30
      then trim(coalesce(u.raw_user_meta_data ->> 'phone_number', u.phone))
    else null
  end as phone_number,
  true as is_active
from auth.users u
left join public.profiles p
  on p.id = u.id
where p.id is null;
